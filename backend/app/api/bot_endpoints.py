"""Bot & AI endpoints — /ask (SSE), /respond, /process-messages, /bootstrap."""

from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.auth import get_current_user_id
from app.services.supabase import get_supabase
from app.services.bot_pipeline import ask_pipeline, handle_response
from app.services.context_engine import process_message, bootstrap_agent

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────

def _rows(response) -> list[dict]:
    if hasattr(response, "data"):
        return response.data
    raise HTTPException(status_code=500, detail="Unexpected Supabase response")


# ── Ask — SSE streaming endpoint ────────────────────────────────────────

class AskBody(BaseModel):
    workspace_id: str
    question: str
    asked_by: str  # workspace_member id
    question_type: str | None = None


@router.post("/ask", tags=["bot"])
async def ask_bot(body: AskBody, user_id: str = Depends(get_current_user_id)):
    """Ask the bot a question. Returns an SSE stream with traversal and result events."""

    # Look up workspace settings for custom threshold
    sb = get_supabase()
    threshold = 0.82

    try:
        agents_resp = (
            sb.table("agents")
            .select("*")
            .eq("workspace_id", body.workspace_id)
            .limit(1)
            .execute()
        )
        if agents_resp.data:
            config = agents_resp.data[0].get("config") or {}
            if isinstance(config, dict):
                threshold = config.get("confidence_threshold", 0.82)
    except Exception:
        pass

    async def event_stream():
        async for event in ask_pipeline(
            question_type=body.question_type,
            workspace_id=body.workspace_id,
            question_text=body.question,
            asked_by=body.asked_by,
            confidence_threshold=threshold,
        ):
            yield event

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Respond — engineer answers a routed question ────────────────────────

class RespondBody(BaseModel):
    response_text: str
    responder_member_id: str


@router.post("/respond/{question_id}", tags=["bot"])
async def respond_to_question(
    question_id: UUID,
    body: RespondBody,
    user_id: str = Depends(get_current_user_id),
):
    """Engineer responds to a routed question. Answer feeds back into the context tree."""
    result = await handle_response(
        question_id=str(question_id),
        response_text=body.response_text,
        responder_member_id=body.responder_member_id,
    )
    return result


# ── Process Messages — trigger context extraction ───────────────────────

@router.post("/process-messages", tags=["bot"])
async def trigger_process_messages(
    workspace_id: str = Query(...),
    user_id: str = Depends(get_current_user_id),
):
    """Manually trigger processing of unprocessed messages."""
    sb = get_supabase()

    resp = (
        sb.table("messages")
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("processed", False)
        .order("created_at", desc=False)
        .limit(20)
        .execute()
    )
    messages = _rows(resp)
    processed = 0

    for msg in messages:
        try:
            await process_message(msg["id"])
            processed += 1
        except Exception as e:
            logger.error(f"Failed to process message {msg['id']}: {e}")

    return {"processed": processed, "total": len(messages)}


# ── Bootstrap Agent — initial tree build ────────────────────────────────

@router.post("/agents/{agent_id}/bootstrap", tags=["bot"])
async def trigger_bootstrap(
    agent_id: UUID,
    user_id: str = Depends(get_current_user_id),
):
    """Bootstrap an agent by scanning existing messages."""
    sb = get_supabase()

    # Get agent to find workspace_id
    agent_resp = sb.table("agents").select("*").eq("id", str(agent_id)).execute()
    if not agent_resp.data:
        raise HTTPException(404, "Agent not found")

    agent = agent_resp.data[0]
    workspace_id = agent["workspace_id"]

    nodes_created = await bootstrap_agent(str(agent_id), workspace_id)
    return {"nodes_created": nodes_created, "agent_id": str(agent_id)}


# ── Get all tree nodes for traversal display ────────────────────────────

@router.get("/agents/{agent_id}/tree/all", tags=["tree"])
async def get_all_tree_nodes(
    agent_id: UUID,
    _user_id: str = Depends(get_current_user_id),
):
    """Get ALL tree nodes for an agent (not just roots), with staleness info."""
    sb = get_supabase()

    resp = (
        sb.table("tree_nodes")
        .select("*, workspace_members(display_name)")
        .eq("agent_id", str(agent_id))
        .order("created_at", desc=False)
        .execute()
    )
    nodes = _rows(resp)

    from app.services.context_engine import staleness_decay
    from datetime import datetime, timezone

    for node in nodes:
        effective = staleness_decay(
            node.get("confidence", 0.5),
            node.get("updated_at", datetime.now(timezone.utc).isoformat()),
        )
        node["effective_confidence"] = round(effective, 3)
        owner_info = node.get("workspace_members") or {}
        node["owner_name"] = owner_info.get("display_name", None)
        # Remove embedding from response (too large)
        node.pop("embedding", None)

    return nodes


# ── Update tree node (edit summary) ─────────────────────────────────────

class TreeNodeUpdate(BaseModel):
    summary: str | None = None
    label: str | None = None


@router.patch("/agents/{agent_id}/tree/node/{node_id}", tags=["tree"])
async def update_tree_node(
    agent_id: UUID,
    node_id: UUID,
    body: TreeNodeUpdate,
    _user_id: str = Depends(get_current_user_id),
):
    """Update a tree node's summary. Regenerates embedding and resets confidence."""
    sb = get_supabase()
    from app.services import ai
    from datetime import datetime, timezone

    update_data: dict = {
        "confidence": 1.0,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    if body.summary:
        update_data["summary"] = body.summary
    if body.label:
        update_data["label"] = body.label

    # Regenerate embedding
    embed_text = f"{body.label or ''} {body.summary or ''}"
    if embed_text.strip():
        embedding = await ai.generate_embedding(embed_text)
        update_data["embedding"] = embedding

    resp = (
        sb.table("tree_nodes")
        .update(update_data)
        .eq("id", str(node_id))
        .eq("agent_id", str(agent_id))
        .execute()
    )
    rows = _rows(resp)
    if not rows:
        raise HTTPException(404, "Tree node not found")
    return rows[0]


# ── Routed questions for a member ─────────────────────────────────────

@router.get("/questions/routed-to-me", tags=["questions"])
async def get_routed_questions(
    workspace_id: str = Query(...),
    user_id: str = Depends(get_current_user_id),
):
    """Get questions routed to the current user that haven't been answered yet."""
    sb = get_supabase()

    # Find member for this user
    member_resp = (
        sb.table("workspace_members")
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not member_resp.data:
        return []

    member_id = member_resp.data[0]["id"]

    resp = (
        sb.table("questions")
        .select("*")
        .eq("workspace_id", workspace_id)
        .eq("routed_to", member_id)
        .eq("was_routed", True)
        .is_("answer_text", "null")
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    return _rows(resp)


# ── Engineering / Moorcheh endpoints ────────────────────────────────────

class EngineeringAskBody(BaseModel):
    workspace_id: str
    question: str


@router.post("/engineering/ask", tags=["engineering"])
async def ask_engineering(
    body: EngineeringAskBody,
    user_id: str = Depends(get_current_user_id),
):
    """Ask an engineering question — searches GitHub PR data via Moorcheh."""
    import asyncio
    from app.services.moorcheh import engineering_search_pipeline_sync

    result = await asyncio.to_thread(
        engineering_search_pipeline_sync,
        body.workspace_id,
        body.question,
    )
    return result


@router.post("/engineering/sync-prs", tags=["engineering"])
async def sync_engineering_prs(
    workspace_id: str = Query(...),
    user_id: str = Depends(get_current_user_id),
):
    """Manually trigger syncing workspace PRs into Moorcheh."""
    import asyncio
    from app.services.moorcheh import sync_workspace_prs

    count = await asyncio.to_thread(sync_workspace_prs, workspace_id)
    return {"synced": count, "workspace_id": workspace_id}


# ── Workspace analytics for interrupt counter ───────────────────────────

@router.get("/workspaces/{workspace_id}/interrupt-count", tags=["analytics"])
async def get_interrupt_count(
    workspace_id: UUID,
    _user_id: str = Depends(get_current_user_id),
):
    """Get the total auto-answered count (interrupts saved)."""
    sb = get_supabase()

    resp = (
        sb.table("analytics_daily")
        .select("auto_answered, hours_saved")
        .eq("workspace_id", str(workspace_id))
        .execute()
    )
    rows = _rows(resp)
    total_saved = sum(r.get("auto_answered", 0) for r in rows)
    total_hours = sum(r.get("hours_saved", 0) for r in rows)

    return {
        "interrupts_saved": total_saved,
        "hours_saved": round(total_hours, 1),
    }
