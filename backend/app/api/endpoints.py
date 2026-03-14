"""API routes that expose Supabase-backed resources."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import get_current_user_id
from app.services.supabase import get_supabase

router = APIRouter()

# ── helpers ──────────────────────────────────────────────────────────────

def _rows(response) -> list[dict]:
    """Extract rows from a Supabase response, raising on error."""
    if hasattr(response, "data"):
        return response.data
    raise HTTPException(status_code=500, detail="Unexpected Supabase response")


# ── Auth info ────────────────────────────────────────────────────────────


@router.get("/me", tags=["auth"])
async def get_me(user_id: str = Depends(get_current_user_id)):
    """Return the current Clerk user ID and their workspace memberships."""
    sb = get_supabase()
    resp = (
        sb.table("workspace_members")
        .select("*, workspaces(*)")
        .eq("user_id", user_id)
        .execute()
    )
    return {"user_id": user_id, "memberships": _rows(resp)}


# ── Workspaces ───────────────────────────────────────────────────────────

class WorkspaceCreate(BaseModel):
    name: str
    slug: str
    display_name: str | None = None
    github_repo: str | None = None
    settings: dict[str, Any] = {}


class WorkspaceUpdate(BaseModel):
    name: str | None = None
    github_repo: str | None = None
    settings: dict[str, Any] | None = None


@router.get("/workspaces", tags=["workspaces"])
async def list_workspaces(user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    # Only return workspaces the user is a member of
    resp = (
        sb.table("workspace_members")
        .select("workspace_id, workspaces(*)")
        .eq("user_id", user_id)
        .execute()
    )
    rows = _rows(resp)
    return [r["workspaces"] for r in rows if r.get("workspaces")]


@router.get("/workspaces/{workspace_id}", tags=["workspaces"])
async def get_workspace(
    workspace_id: UUID,
    user_id: str = Depends(get_current_user_id),
):
    sb = get_supabase()
    resp = sb.table("workspaces").select("*").eq("id", str(workspace_id)).execute()
    rows = _rows(resp)
    if not rows:
        raise HTTPException(404, "Workspace not found")
    return rows[0]


@router.post("/workspaces", tags=["workspaces"], status_code=201)
async def create_workspace(
    body: WorkspaceCreate,
    user_id: str = Depends(get_current_user_id),
):
    sb = get_supabase()
    display_name = body.display_name or user_id
    data = body.model_dump(exclude={"display_name"})
    data["owner_id"] = user_id  # automatically set from Clerk token
    resp = sb.table("workspaces").insert(data).execute()
    workspace = _rows(resp)[0]

    # Auto-add the creator as an admin member
    sb.table("workspace_members").insert({
        "workspace_id": workspace["id"],
        "user_id": user_id,
        "role": "admin",
        "display_name": display_name,
    }).execute()

    return workspace


class JoinBody(BaseModel):
    slug: str
    display_name: str | None = None


@router.post("/workspace/join", tags=["workspaces"], status_code=201)
async def join_workspace(
    body: JoinBody,
    user_id: str = Depends(get_current_user_id),
):
    sb = get_supabase()
    # Look up workspace by slug
    resp = sb.table("workspaces").select("*").eq("slug", body.slug).execute()
    rows = _rows(resp)
    if not rows:
        raise HTTPException(404, "Workspace not found")
    workspace = rows[0]

    # Check if already a member
    existing = (
        sb.table("workspace_members")
        .select("id")
        .eq("workspace_id", workspace["id"])
        .eq("user_id", user_id)
        .execute()
    )
    if _rows(existing):
        raise HTTPException(409, "Already a member of this workspace")

    # Add as member
    display_name = body.display_name or user_id
    sb.table("workspace_members").insert({
        "workspace_id": workspace["id"],
        "user_id": user_id,
        "role": "viewer",
        "display_name": display_name,
    }).execute()

    return workspace


@router.patch("/workspaces/{workspace_id}", tags=["workspaces"])
async def update_workspace(
    workspace_id: UUID,
    body: WorkspaceUpdate,
    user_id: str = Depends(get_current_user_id),
):
    sb = get_supabase()
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(400, "Nothing to update")
    resp = sb.table("workspaces").update(payload).eq("id", str(workspace_id)).execute()
    rows = _rows(resp)
    if not rows:
        raise HTTPException(404, "Workspace not found")
    return rows[0]


@router.delete("/workspaces/{workspace_id}", tags=["workspaces"], status_code=204)
async def delete_workspace(
    workspace_id: UUID,
    user_id: str = Depends(get_current_user_id),
):
    sb = get_supabase()
    sb.table("workspaces").delete().eq("id", str(workspace_id)).execute()


# ── Workspace Members ────────────────────────────────────────────────────

class MemberCreate(BaseModel):
    user_id: str
    role: str
    display_name: str
    github_username: str | None = None
    slack_id: str | None = None


class MemberUpdate(BaseModel):
    role: str | None = None
    display_name: str | None = None
    github_username: str | None = None
    slack_id: str | None = None


@router.get("/workspaces/{workspace_id}/members", tags=["members"])
async def list_members(workspace_id: UUID, _user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    resp = (
        sb.table("workspace_members")
        .select("*")
        .eq("workspace_id", str(workspace_id))
        .execute()
    )
    return _rows(resp)


@router.post("/workspaces/{workspace_id}/members", tags=["members"], status_code=201)
async def create_member(workspace_id: UUID, body: MemberCreate, _user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    data = body.model_dump()
    data["workspace_id"] = str(workspace_id)
    resp = sb.table("workspace_members").insert(data).execute()
    return _rows(resp)[0]


@router.patch("/members/{member_id}", tags=["members"])
async def update_member(member_id: UUID, body: MemberUpdate, _user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(400, "Nothing to update")
    resp = (
        sb.table("workspace_members")
        .update(payload)
        .eq("id", str(member_id))
        .execute()
    )
    rows = _rows(resp)
    if not rows:
        raise HTTPException(404, "Member not found")
    return rows[0]


@router.delete("/members/{member_id}", tags=["members"], status_code=204)
async def delete_member(member_id: UUID, _user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    sb.table("workspace_members").delete().eq("id", str(member_id)).execute()


# ── Agents ───────────────────────────────────────────────────────────────

class AgentCreate(BaseModel):
    type: str
    name: str
    extraction_prompt: str
    domain_scope: list[str] = []


class AgentUpdate(BaseModel):
    name: str | None = None
    extraction_prompt: str | None = None
    domain_scope: list[str] | None = None


@router.get("/workspaces/{workspace_id}/agents", tags=["agents"])
async def list_agents(workspace_id: UUID, _user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    resp = (
        sb.table("agents")
        .select("*")
        .eq("workspace_id", str(workspace_id))
        .execute()
    )
    return _rows(resp)


@router.post("/workspaces/{workspace_id}/agents", tags=["agents"], status_code=201)
async def create_agent(workspace_id: UUID, body: AgentCreate, _user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    data = body.model_dump()
    data["workspace_id"] = str(workspace_id)
    resp = sb.table("agents").insert(data).execute()
    return _rows(resp)[0]


@router.patch("/agents/{agent_id}", tags=["agents"])
async def update_agent(agent_id: UUID, body: AgentUpdate, _user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(400, "Nothing to update")
    resp = sb.table("agents").update(payload).eq("id", str(agent_id)).execute()
    rows = _rows(resp)
    if not rows:
        raise HTTPException(404, "Agent not found")
    return rows[0]


@router.delete("/agents/{agent_id}", tags=["agents"], status_code=204)
async def delete_agent(agent_id: UUID, _user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    sb.table("agents").delete().eq("id", str(agent_id)).execute()


# ── Messages ─────────────────────────────────────────────────────────────

class MessageCreate(BaseModel):
    channel: str
    sender_id: UUID | None = None
    content: str


@router.get("/workspaces/{workspace_id}/messages", tags=["messages"])
async def list_messages(workspace_id: UUID, channel: str | None = None, limit: int = 50, _user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    q = (
        sb.table("messages")
        .select("*, workspace_members(display_name)")
        .eq("workspace_id", str(workspace_id))
        .order("created_at", desc=True)
        .limit(limit)
    )
    if channel:
        q = q.eq("channel", channel)
    resp = q.execute()
    return _rows(resp)


@router.post("/workspaces/{workspace_id}/messages", tags=["messages"], status_code=201)
async def create_message(workspace_id: UUID, body: MessageCreate, _user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    data = body.model_dump(mode="json")
    data["workspace_id"] = str(workspace_id)

    # Auto-resolve sender_id from the authenticated user's membership
    if not data.get("sender_id"):
        member_resp = (
            sb.table("workspace_members")
            .select("id")
            .eq("workspace_id", str(workspace_id))
            .eq("user_id", _user_id)
            .limit(1)
            .execute()
        )
        member_rows = _rows(member_resp)
        if member_rows:
            data["sender_id"] = member_rows[0]["id"]

    resp = sb.table("messages").insert(data).execute()
    return _rows(resp)[0]


# ── Tree Nodes ───────────────────────────────────────────────────────────

@router.get("/agents/{agent_id}/tree", tags=["tree"])
async def list_tree_nodes(agent_id: UUID, parent_id: UUID | None = None, _user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    q = sb.table("tree_nodes").select("*").eq("agent_id", str(agent_id))
    if parent_id:
        q = q.eq("parent_id", str(parent_id))
    else:
        q = q.is_("parent_id", "null")
    resp = q.execute()
    return _rows(resp)


@router.get("/agents/{agent_id}/tree/staleness", tags=["tree"])
async def list_tree_nodes_with_staleness(agent_id: UUID, _user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    resp = (
        sb.table("tree_nodes_with_staleness")
        .select("*")
        .eq("agent_id", str(agent_id))
        .execute()
    )
    return _rows(resp)


# ── Questions ────────────────────────────────────────────────────────────

class QuestionCreate(BaseModel):
    asked_by: UUID
    question_text: str
    classified_domains: list[str] = []
    question_type: str | None = None
    urgency: str = "normal"


class FeedbackBody(BaseModel):
    feedback: str  # 'thumbs_up' | 'thumbs_down'


@router.get("/workspaces/{workspace_id}/questions", tags=["questions"])
async def list_questions(workspace_id: UUID, limit: int = 50, _user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    resp = (
        sb.table("questions")
        .select("*")
        .eq("workspace_id", str(workspace_id))
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return _rows(resp)


@router.post("/workspaces/{workspace_id}/questions", tags=["questions"], status_code=201)
async def create_question(workspace_id: UUID, body: QuestionCreate, _user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    data = body.model_dump(mode="json")
    data["workspace_id"] = str(workspace_id)
    resp = sb.table("questions").insert(data).execute()
    return _rows(resp)[0]


@router.post("/questions/{question_id}/feedback", tags=["questions"])
async def submit_feedback(question_id: UUID, body: FeedbackBody, _user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    resp = sb.rpc("apply_feedback", {
        "p_question_id": str(question_id),
        "p_feedback": body.feedback,
    }).execute()
    return {"ok": True}


# ── Analytics ────────────────────────────────────────────────────────────

@router.get("/workspaces/{workspace_id}/analytics", tags=["analytics"])
async def list_analytics(workspace_id: UUID, limit: int = 30, _user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    resp = (
        sb.table("analytics_daily")
        .select("*")
        .eq("workspace_id", str(workspace_id))
        .order("date", desc=True)
        .limit(limit)
        .execute()
    )
    return _rows(resp)


# ── Sales Records ────────────────────────────────────────────────────────

class SalesRecordCreate(BaseModel):
    title: str
    raw_text: str
    source_type: str = "manual"
    metadata: dict[str, Any] = {}


@router.get("/workspaces/{workspace_id}/sales-records", tags=["sales"])
async def list_sales_records(
    workspace_id: UUID,
    limit: int = 50,
    _user_id: str = Depends(get_current_user_id),
):
    sb = get_supabase()
    resp = (
        sb.table("sales_records")
        .select("*")
        .eq("workspace_id", str(workspace_id))
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return _rows(resp)


@router.post("/workspaces/{workspace_id}/sales-records", tags=["sales"], status_code=201)
async def create_sales_record(
    workspace_id: UUID,
    body: SalesRecordCreate,
    _user_id: str = Depends(get_current_user_id),
):
    """Create a sales record and extract context into the knowledge tree."""
    sb = get_supabase()
    data = body.model_dump()
    data["workspace_id"] = str(workspace_id)
    resp = sb.table("sales_records").insert(data).execute()
    record = _rows(resp)[0]

    # Process in background — extract facts into tree_nodes
    from app.services.context_engine import process_sales_record
    try:
        await process_sales_record(record["id"])
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Sales record processing failed: {e}")

    return record


@router.get("/sales-records/{record_id}", tags=["sales"])
async def get_sales_record(
    record_id: UUID,
    _user_id: str = Depends(get_current_user_id),
):
    sb = get_supabase()
    resp = sb.table("sales_records").select("*").eq("id", str(record_id)).execute()
    rows = _rows(resp)
    if not rows:
        raise HTTPException(404, "Sales record not found")
    return rows[0]


# ── Onboarding Sessions ─────────────────────────────────────────────────

class OnboardingCreate(BaseModel):
    user_name: str | None = None
    role: str | None = None
    raw_responses: dict[str, Any] = {}
    goals: list[str] = []


class OnboardingUpdate(BaseModel):
    raw_responses: dict[str, Any] | None = None
    goals: list[str] | None = None
    status: str | None = None


@router.get("/workspaces/{workspace_id}/onboarding", tags=["onboarding"])
async def list_onboarding_sessions(
    workspace_id: UUID,
    _user_id: str = Depends(get_current_user_id),
):
    sb = get_supabase()
    resp = (
        sb.table("onboarding_sessions")
        .select("*")
        .eq("workspace_id", str(workspace_id))
        .order("created_at", desc=True)
        .execute()
    )
    return _rows(resp)


@router.post("/workspaces/{workspace_id}/onboarding", tags=["onboarding"], status_code=201)
async def create_onboarding_session(
    workspace_id: UUID,
    body: OnboardingCreate,
    user_id: str = Depends(get_current_user_id),
):
    """Start an onboarding session for a new workspace member."""
    sb = get_supabase()
    data = body.model_dump()
    data["workspace_id"] = str(workspace_id)
    data["user_id"] = user_id
    resp = sb.table("onboarding_sessions").insert(data).execute()
    return _rows(resp)[0]


@router.patch("/onboarding/{session_id}", tags=["onboarding"])
async def update_onboarding_session(
    session_id: UUID,
    body: OnboardingUpdate,
    _user_id: str = Depends(get_current_user_id),
):
    sb = get_supabase()
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(400, "Nothing to update")
    payload["updated_at"] = "now()"
    resp = (
        sb.table("onboarding_sessions")
        .update(payload)
        .eq("id", str(session_id))
        .execute()
    )
    rows = _rows(resp)
    if not rows:
        raise HTTPException(404, "Onboarding session not found")
    return rows[0]


@router.post("/onboarding/{session_id}/complete", tags=["onboarding"])
async def complete_onboarding(
    session_id: UUID,
    _user_id: str = Depends(get_current_user_id),
):
    """Complete onboarding: generate AI persona and extract expertise into tree."""
    from app.services.context_engine import process_onboarding_session
    result = await process_onboarding_session(str(session_id))
    return result
