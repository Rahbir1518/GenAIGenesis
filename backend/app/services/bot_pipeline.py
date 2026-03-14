"""Bot answering pipeline — classify → search → evaluate → answer/route → stream SSE."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator

from app.services import ai
from app.services.context_engine import (
    find_matching_nodes,
    find_all_nodes_for_agents,
    staleness_decay,
    upsert_tree_node,
)
from app.services.supabase import get_supabase
from app.services import moorcheh as moorcheh_service

logger = logging.getLogger(__name__)

DEFAULT_THRESHOLD = 0.82


# ---------------------------------------------------------------------------
# SSE Helper
# ---------------------------------------------------------------------------

def sse_event(event: str, data: dict) -> str:
    """Format an SSE event string."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


# ---------------------------------------------------------------------------
# Main Pipeline
# ---------------------------------------------------------------------------

async def ask_pipeline(
    question_type: str,
    workspace_id: str,
    question_text: str,
    asked_by: str,
    confidence_threshold: float = DEFAULT_THRESHOLD,
) -> AsyncGenerator[str, None]:
    """Run the full ask pipeline, yielding SSE events.
    
    Events emitted:
      - "status": pipeline progress updates
      - "traversal": node being visited (id, label, confidence)
      - "result": final answer or routing info
      - "error": error message
    """
    sb = get_supabase()
    if question_type:
        given_classification = {"question_type": question_type}
    else:
        given_classification = await ai.classify_question(question_text)

    try:
        # ----- Step 1: Classify -----
        yield sse_event("status", {"step": "classify", "message": "Classifying question..."})
        await asyncio.sleep(0.1)  # Let the event flush

        classification = given_classification
        is_who_knows = classification.get("is_who_knows", False)
        domains = classification.get("domains", [])
        question_type = classification.get("question_type", "capability")
        urgency = classification.get("urgency", "normal")
        topic = classification.get("topic", question_text[:50])

        yield sse_event("status", {
            "step": "classify_done",
            "message": f"Classified as {question_type}",
            "domains": domains,
            "is_who_knows": is_who_knows,
        })

        # ----- Engineering fast-path via Moorcheh PR index -----
        if question_type == "engineering" and not is_who_knows:
            yield sse_event("status", {"step": "moorcheh_sync", "message": "Syncing PR data into Moorcheh..."})
            try:
                result = await asyncio.to_thread(
                    moorcheh_service.engineering_search_pipeline_sync,
                    workspace_id,
                    question_text,
                )
                moorcheh_answer = result.get("answer", "")
                moorcheh_sources = result.get("sources", [])

                if moorcheh_answer and moorcheh_answer.strip():
                    yield sse_event("status", {"step": "moorcheh_search", "message": "Searching PR knowledge base..."})

                    # Emit source traversal events for the frontend
                    for i, src in enumerate(moorcheh_sources[:5]):
                        yield sse_event("traversal", {
                            "index": i,
                            "node_id": src.get("id", f"moorcheh-{i}"),
                            "label": src.get("text", src.get("id", "PR"))[:80],
                            "summary": src.get("text", "")[:200],
                            "confidence": round(src.get("score", 0.9), 2),
                            "effective_confidence": round(src.get("score", 0.9), 2),
                            "similarity": round(src.get("score", 0.9), 3),
                            "owner_name": "",
                            "node_type": "pr_context",
                            "agent_name": "Moorcheh Engineering",
                            "parent_label": None,
                        })
                        await asyncio.sleep(0.3)

                    question_record = _record_question(
                        sb, workspace_id, asked_by, question_text,
                        question_type, domains, urgency,
                        [], moorcheh_answer, 0.90, False, None,
                    )
                    _update_analytics(sb, workspace_id, auto_answered=True)

                    yield sse_event("result", {
                        "type": "answer",
                        "answer": moorcheh_answer,
                        "confidence": 0.90,
                        "source_node": {
                            "id": "moorcheh",
                            "label": "GitHub PR Knowledge Base",
                            "agent_name": "Moorcheh Engineering",
                        },
                        "question_id": question_record.get("id") if question_record else None,
                    })
                    return
            except Exception as moorcheh_err:
                logger.warning("Moorcheh engineering path failed, falling back: %s", moorcheh_err)
                yield sse_event("status", {"step": "moorcheh_fallback", "message": "PR search unavailable, using context tree..."})

        # ----- Step 2: Vector Search -----
        yield sse_event("status", {"step": "search", "message": "Searching context tree..."})

        question_embedding = await ai.generate_embedding(question_text)

        # Get all agents for workspace
        agents_resp = (
            sb.table("agents")
            .select("id, name, type")
            .eq("workspace_id", workspace_id)
            .execute()
        )
        agents = agents_resp.data or []

        all_matches = []
        traversed_node_ids = []

        for agent in agents:
            matches = await find_matching_nodes(
                question_embedding,
                agent["id"],
                threshold=0.30,  # Low threshold to show traversal
                limit=8,
            )
            for m in matches:
                m["agent_name"] = agent["name"]
                m["agent_type"] = agent["type"]

            all_matches.extend(matches)

        # Sort by similarity
        all_matches.sort(key=lambda x: x.get("similarity", 0), reverse=True)

        # ----- Step 3: Emit Traversal Events -----
        for i, node in enumerate(all_matches[:8]):
            traversed_node_ids.append(node["id"])
            yield sse_event("traversal", {
                "index": i,
                "node_id": node["id"],
                "label": node.get("label", "Unknown"),
                "summary": node.get("summary", "")[:100],
                "confidence": round(node.get("confidence", 0), 2),
                "effective_confidence": round(node.get("effective_confidence", 0), 2),
                "similarity": round(node.get("similarity", 0), 3),
                "owner_name": node.get("owner_name", "Unknown"),
                "node_type": node.get("node_type", "module"),
                "agent_name": node.get("agent_name", ""),
                "parent_label": None,
            })
            await asyncio.sleep(0.5)  # Stagger for animation

        # ----- Step 4: Evaluate Confidence & Decide -----
        if not all_matches:
            # No matches at all
            yield sse_event("status", {"step": "decide", "message": "No matching context found"})

            question_record = _record_question(
                sb, workspace_id, asked_by, question_text,
                question_type, domains, urgency,
                traversed_node_ids, None, 0.0, True, None,
            )

            yield sse_event("result", {
                "type": "no_context",
                "answer": "I don't have any information about this topic in the context tree yet. As more conversations happen and knowledge is added, I'll be able to help!",
                "confidence": 0,
                "question_id": question_record.get("id") if question_record else None,
            })
            return

        best_match = all_matches[0]
        best_confidence = best_match.get("effective_confidence", 0)

        # ----- "Who knows?" query -----
        if is_who_knows:
            yield sse_event("status", {"step": "experts", "message": "Finding experts..."})

            experts = await ai.find_experts(topic, all_matches[:5])
            
            # If AI didn't return good experts, build from nodes
            if not experts:
                seen_owners = {}
                for node in all_matches:
                    oid = node.get("owner_id")
                    if oid and oid not in seen_owners:
                        seen_owners[oid] = {
                            "owner_id": oid,
                            "owner_name": node.get("owner_name", "Unknown"),
                            "domain": node.get("label", ""),
                            "confidence": round(node.get("effective_confidence", 0), 2),
                            "reason": f"Owns knowledge about {node.get('label', 'this area')}",
                        }
                experts = list(seen_owners.values())[:3]

            question_record = _record_question(
                sb, workspace_id, asked_by, question_text,
                "ownership", domains, urgency,
                traversed_node_ids, f"Found {len(experts)} experts", best_confidence, False, None,
            )

            yield sse_event("result", {
                "type": "who_knows",
                "experts": experts,
                "topic": topic,
                "question_id": question_record.get("id") if question_record else None,
            })
            return

        # ----- Direct answer vs route -----
        if best_confidence >= confidence_threshold:
            # High confidence — direct answer
            yield sse_event("status", {"step": "answer", "message": "Generating answer..."})

            answer_text = await ai.generate_answer(question_text, all_matches[:5])

            question_record = _record_question(
                sb, workspace_id, asked_by, question_text,
                question_type, domains, urgency,
                traversed_node_ids, answer_text, best_confidence, False, None,
            )

            # Increment interrupt counter (auto-answered)
            _update_analytics(sb, workspace_id, auto_answered=True)

            yield sse_event("result", {
                "type": "answer",
                "answer": answer_text,
                "confidence": round(best_confidence, 2),
                "source_node": {
                    "id": best_match["id"],
                    "label": best_match.get("label", ""),
                    "agent_name": best_match.get("agent_name", ""),
                },
                "question_id": question_record.get("id") if question_record else None,
            })

        elif best_confidence >= 0.50:
            # Medium confidence — answer with caveat
            yield sse_event("status", {"step": "answer", "message": "Generating answer with caveat..."})

            answer_text = await ai.generate_answer(question_text, all_matches[:5])

            question_record = _record_question(
                sb, workspace_id, asked_by, question_text,
                question_type, domains, urgency,
                traversed_node_ids, answer_text, best_confidence, False, None,
            )

            _update_analytics(sb, workspace_id, auto_answered=True)

            yield sse_event("result", {
                "type": "answer_caveat",
                "answer": answer_text,
                "confidence": round(best_confidence, 2),
                "caveat": "This answer is based on limited context. The information may be incomplete or outdated.",
                "source_node": {
                    "id": best_match["id"],
                    "label": best_match.get("label", ""),
                    "agent_name": best_match.get("agent_name", ""),
                },
                "question_id": question_record.get("id") if question_record else None,
            })

        else:
            # Low confidence — route to owner
            yield sse_event("status", {"step": "route", "message": "Routing to expert..."})

            # Find the best owner
            route_to = None
            route_name = "the team"
            for node in all_matches:
                if node.get("owner_id"):
                    route_to = node["owner_id"]
                    route_name = node.get("owner_name", "Unknown")
                    break

            question_record = _record_question(
                sb, workspace_id, asked_by, question_text,
                question_type, domains, urgency,
                traversed_node_ids, None, best_confidence, True, route_to,
            )

            # Increment ping count for routed member
            if route_to:
                try:
                    sb.table("workspace_members").update({
                        "ping_count_today": sb.table("workspace_members")
                        .select("ping_count_today")
                        .eq("id", route_to)
                        .execute()
                        .data[0]["ping_count_today"] + 1
                    }).eq("id", route_to).execute()
                except Exception:
                    pass

            _update_analytics(sb, workspace_id, auto_answered=False)

            yield sse_event("result", {
                "type": "route",
                "confidence": round(best_confidence, 2),
                "routed_to": {
                    "id": route_to,
                    "name": route_name,
                    "domain": best_match.get("label", "this area"),
                },
                "suggested_message": f"Hey {route_name}, someone is asking: {question_text}",
                "question_id": question_record.get("id") if question_record else None,
            })

    except Exception as e:
        logger.exception("Bot pipeline error")
        yield sse_event("error", {"message": f"An error occurred: {str(e)}"})


# ---------------------------------------------------------------------------
# Response Handler — Engineer answers routed question
# ---------------------------------------------------------------------------

async def handle_response(
    question_id: str,
    response_text: str,
    responder_member_id: str,
) -> dict:
    """Handle an engineer's response to a routed question.
    
    1. Update the question record with the answer
    2. Add the answer as new context to the tree
    3. Notify the original asker via a message (if applicable)
    4. Return the updated question
    """
    sb = get_supabase()

    # Get the question
    q_resp = sb.table("questions").select("*").eq("id", question_id).execute()
    if not q_resp.data:
        raise ValueError(f"Question {question_id} not found")
    question = q_resp.data[0]

    # Update question with answer
    sb.table("questions").update({
        "answer_text": response_text,
        "confidence_score": 1.0,  # Human-provided answer is 100% confidence
    }).eq("id", question_id).execute()

    # Add the response as context to the tree for relevant agents
    workspace_id = question["workspace_id"]
    agents_resp = (
        sb.table("agents")
        .select("id, type")
        .eq("workspace_id", workspace_id)
        .execute()
    )

    for agent in (agents_resp.data or []):
        try:
            fact = {
                "domain": (question.get("classified_domains") or ["general"])[0],
                "label": question["question_text"][:60],
                "summary": response_text,
            }
            await upsert_tree_node(
                agent_id=agent["id"],
                fact=fact,
                source="bot_answer",
                source_ref=question_id,
                owner_id=responder_member_id,
            )
        except Exception as e:
            logger.error(f"Failed to add response to tree: {e}")

    # Notify the original asker by inserting a system message
    try:
        asked_by = question.get("asked_by")
        if asked_by:
            sb.table("messages").insert({
                "workspace_id": workspace_id,
                "channel": "general",
                "content": (
                    f"✅ Your question has been answered!\n\n"
                    f"**Q:** {question['question_text']}\n"
                    f"**A:** {response_text}"
                ),
            }).execute()
    except Exception as e:
        logger.error(f"Failed to notify asker: {e}")

    return {"ok": True, "question_id": question_id}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _record_question(
    sb,
    workspace_id: str,
    asked_by: str,
    question_text: str,
    question_type: str,
    domains: list[str],
    urgency: str,
    traversed_node_ids: list[str],
    answer_text: str | None,
    confidence: float,
    was_routed: bool,
    routed_to: str | None,
) -> dict | None:
    """Insert a question record into the questions table."""
    try:
        data = {
            "workspace_id": workspace_id,
            "asked_by": asked_by,
            "question_text": question_text,
            "question_type": question_type,
            "classified_domains": domains,
            "urgency": urgency,
            "nodes_traversed": traversed_node_ids,
            "answer_text": answer_text,
            "confidence_score": confidence,
            "was_routed": was_routed,
        }
        if routed_to:
            data["routed_to"] = routed_to

        resp = sb.table("questions").insert(data).execute()
        return (resp.data or [{}])[0]
    except Exception as e:
        logger.error(f"Failed to record question: {e}")
        return None


def _update_analytics(sb, workspace_id: str, auto_answered: bool):
    """Update daily analytics counter."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        # Check if today's record exists
        resp = (
            sb.table("analytics_daily")
            .select("*")
            .eq("workspace_id", workspace_id)
            .eq("date", today)
            .execute()
        )
        if resp.data:
            record = resp.data[0]
            update = {}
            if auto_answered:
                update["auto_answered"] = record.get("auto_answered", 0) + 1
                update["hours_saved"] = record.get("hours_saved", 0) + 0.25
            else:
                update["routed"] = record.get("routed", 0) + 1
            sb.table("analytics_daily").update(update).eq("id", record["id"]).execute()
        else:
            sb.table("analytics_daily").insert({
                "workspace_id": workspace_id,
                "date": today,
                "auto_answered": 1 if auto_answered else 0,
                "routed": 0 if auto_answered else 1,
                "hours_saved": 0.25 if auto_answered else 0,
            }).execute()
    except Exception as e:
        logger.error(f"Failed to update analytics: {e}")
