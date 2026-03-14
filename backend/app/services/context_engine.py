"""Context extraction engine — processes messages into tree nodes (the Memory system)."""

from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import Any

from app.services.supabase import get_supabase
from app.services import ai

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Staleness Decay
# ---------------------------------------------------------------------------

def staleness_decay(raw_confidence: float, updated_at: str | datetime) -> float:
    """Apply staleness decay: effective = raw × e^(−days/14)."""
    if isinstance(updated_at, str):
        # Parse ISO timestamp
        updated_at = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    days = (now - updated_at).total_seconds() / 86400
    return raw_confidence * math.exp(-days / 14)


# ---------------------------------------------------------------------------
# Vector Similarity Search
# ---------------------------------------------------------------------------

async def find_matching_nodes(
    embedding: list[float],
    agent_id: str,
    threshold: float = 0.60,
    limit: int = 10,
) -> list[dict]:
    """Find tree nodes matching an embedding via cosine similarity.
    
    Uses Python-side computation since we may not have the pgvector
    RPC function set up. Falls back gracefully.
    """
    sb = get_supabase()

    # Get all nodes for this agent
    resp = (
        sb.table("tree_nodes")
        .select("*, workspace_members(display_name)")
        .eq("agent_id", agent_id)
        .execute()
    )
    nodes = resp.data if hasattr(resp, "data") else []

    if not nodes:
        return []

    results = []
    for node in nodes:
        node_emb = node.get("embedding")
        if not node_emb:
            continue

        # Parse embedding if string
        if isinstance(node_emb, str):
            try:
                import json
                node_emb = json.loads(node_emb)
            except Exception:
                continue

        # Cosine similarity
        sim = _cosine_similarity(embedding, node_emb)
        if sim >= threshold:
            effective_conf = staleness_decay(
                node.get("confidence", 0.5),
                node.get("updated_at", datetime.now(timezone.utc).isoformat()),
            )
            owner_info = node.get("workspace_members") or {}
            results.append({
                **node,
                "similarity": sim,
                "effective_confidence": effective_conf,
                "owner_name": owner_info.get("display_name", "Unknown"),
            })

    # Sort by similarity descending
    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results[:limit]


async def find_all_nodes_for_agents(
    workspace_id: str,
) -> list[dict]:
    """Get all tree nodes for all agents in a workspace."""
    sb = get_supabase()

    # Get agents for workspace
    agents_resp = (
        sb.table("agents")
        .select("id")
        .eq("workspace_id", workspace_id)
        .execute()
    )
    agent_ids = [a["id"] for a in (agents_resp.data or [])]
    if not agent_ids:
        return []

    all_nodes = []
    for aid in agent_ids:
        resp = (
            sb.table("tree_nodes")
            .select("*, workspace_members(display_name)")
            .eq("agent_id", aid)
            .execute()
        )
        nodes = resp.data or []
        for node in nodes:
            effective_conf = staleness_decay(
                node.get("confidence", 0.5),
                node.get("updated_at", datetime.now(timezone.utc).isoformat()),
            )
            owner_info = node.get("workspace_members") or {}
            all_nodes.append({
                **node,
                "effective_confidence": effective_conf,
                "owner_name": owner_info.get("display_name", "Unknown"),
            })

    return all_nodes


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# ---------------------------------------------------------------------------
# Tree Node Upsert
# ---------------------------------------------------------------------------

async def upsert_tree_node(
    agent_id: str,
    fact: dict,
    source: str = "chat",
    source_ref: str | None = None,
    owner_id: str | None = None,
) -> dict:
    """Create or update a tree node from an extracted fact."""
    sb = get_supabase()

    # Generate embedding for the fact
    embed_text = f"{fact.get('label', '')} {fact.get('summary', '')}"
    embedding = await ai.generate_embedding(embed_text)

    # Check for existing similar nodes
    existing = await find_matching_nodes(embedding, agent_id, threshold=0.80, limit=1)

    if existing:
        # Update existing node
        node = existing[0]
        update_data: dict[str, Any] = {
            "summary": fact.get("summary", node.get("summary", "")),
            "confidence": min(1.0, node.get("confidence", 0.5) + 0.15),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "embedding": embedding,
        }
        if owner_id:
            update_data["owner_id"] = owner_id

        resp = (
            sb.table("tree_nodes")
            .update(update_data)
            .eq("id", node["id"])
            .execute()
        )
        return (resp.data or [node])[0]
    else:
        # Find or create parent domain node
        parent_id = await _ensure_domain_node(agent_id, fact.get("domain", "general"))

        # Create new node
        insert_data = {
            "agent_id": agent_id,
            "parent_id": parent_id,
            "node_type": "module",
            "label": fact.get("label", "Unknown"),
            "summary": fact.get("summary", ""),
            "embedding": embedding,
            "confidence": 0.7,
            "source": source,
            "owner_id": owner_id,
        }
        if source_ref:
            insert_data["source_ref"] = source_ref

        resp = sb.table("tree_nodes").insert(insert_data).execute()
        return (resp.data or [insert_data])[0]


async def _ensure_domain_node(agent_id: str, domain: str) -> str | None:
    """Ensure a domain-level parent node exists, return its ID."""
    sb = get_supabase()

    # Check if domain node exists
    resp = (
        sb.table("tree_nodes")
        .select("id")
        .eq("agent_id", agent_id)
        .eq("node_type", "domain")
        .eq("label", domain.title())
        .execute()
    )
    if resp.data:
        return resp.data[0]["id"]

    # Create domain node (no embedding needed for domain-level)
    domain_embedding = await ai.generate_embedding(f"Domain: {domain}")
    insert_resp = (
        sb.table("tree_nodes")
        .insert({
            "agent_id": agent_id,
            "parent_id": None,
            "node_type": "domain",
            "label": domain.title(),
            "summary": f"Knowledge domain: {domain}",
            "embedding": domain_embedding,
            "confidence": 0.5,
            "source": "chat",
        })
        .execute()
    )
    if insert_resp.data:
        return insert_resp.data[0]["id"]
    return None


# ---------------------------------------------------------------------------
# Process Message
# ---------------------------------------------------------------------------

async def process_message(message_id: str) -> list[dict]:
    """Extract context from a message and upsert tree nodes.
    
    Returns list of created/updated tree nodes.
    """
    sb = get_supabase()

    # Fetch the message
    msg_resp = (
        sb.table("messages")
        .select("*, workspace_members(display_name, id)")
        .eq("id", message_id)
        .execute()
    )
    if not msg_resp.data:
        logger.warning(f"Message {message_id} not found")
        return []

    message = msg_resp.data[0]
    content = message.get("content", "")
    workspace_id = message.get("workspace_id")
    sender = message.get("workspace_members") or {}
    author_name = sender.get("display_name", "Unknown")
    sender_member_id = message.get("sender_id")

    if not content.strip() or len(content.strip()) < 5:
        # Mark as processed — too short to extract
        sb.table("messages").update({"processed": True}).eq("id", message_id).execute()
        return []

    # Get all agents for this workspace
    agents_resp = (
        sb.table("agents")
        .select("*")
        .eq("workspace_id", workspace_id)
        .execute()
    )
    agents = agents_resp.data or []

    if not agents:
        sb.table("messages").update({"processed": True}).eq("id", message_id).execute()
        return []

    created_nodes = []

    for agent in agents:
        # Extract facts
        try:
            facts = await ai.extract_context(
                message_text=content,
                agent_type=agent.get("type", "engineering"),
                author_name=author_name,
            )
        except Exception as e:
            logger.error(f"Extraction failed for message {message_id}: {e}")
            continue

        # Upsert each fact as a tree node
        for fact in facts:
            try:
                owner_id = sender_member_id if fact.get("owner_hint") == "yes" else None
                node = await upsert_tree_node(
                    agent_id=agent["id"],
                    fact=fact,
                    source="chat",
                    source_ref=message_id,
                    owner_id=owner_id,
                )
                created_nodes.append(node)
            except Exception as e:
                logger.error(f"Failed to upsert node: {e}")

    # Mark message as processed
    sb.table("messages").update({
        "processed": True,
        "extracted_context": {"facts_count": len(created_nodes)},
    }).eq("id", message_id).execute()

    return created_nodes


# ---------------------------------------------------------------------------
# Bootstrap Agent  
# ---------------------------------------------------------------------------

async def bootstrap_agent(agent_id: str, workspace_id: str) -> int:
    """Scan all existing messages and build initial tree for an agent.
    
    Returns count of nodes created.
    """
    sb = get_supabase()

    # Get all unprocessed messages (or all messages for bootstrap)
    resp = (
        sb.table("messages")
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("channel", "general")
        .order("created_at", desc=False)
        .limit(200)
        .execute()
    )

    messages = resp.data or []
    total_nodes = 0

    for msg in messages:
        try:
            nodes = await process_message(msg["id"])
            total_nodes += len(nodes)
        except Exception as e:
            logger.error(f"Bootstrap failed for message {msg['id']}: {e}")

    # Update agent's last_scan_at
    sb.table("agents").update({
        "last_scan_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", agent_id).execute()

    return total_nodes
