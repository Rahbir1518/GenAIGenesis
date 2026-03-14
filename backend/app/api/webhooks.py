import hmac
import hashlib
import json
import logging
import httpx
from typing import Optional

from fastapi import APIRouter, Header, Request, HTTPException, BackgroundTasks

from app.core.config import settings
from app.services.supabase import get_supabase
from app.services.ai import _get_client, MODEL


router = APIRouter()
logger = logging.getLogger(__name__)

def verify_signature(payload_body: bytes, secret_token: str, signature_header: str) -> bool:
    """Verify that the payload was sent from GitHub by validating SHA256."""
    if not signature_header:
        return False
    hash_object = hmac.new(secret_token.encode('utf-8'), msg=payload_body, digestmod=hashlib.sha256)
    expected_signature = "sha256=" + hash_object.hexdigest()
    return hmac.compare_digest(expected_signature, signature_header)

async def summarize_and_store_pr(workspace_id: str, pr_data: dict, diff_url: str):
    """Background task focused only on the github_pull_requests table."""
    try:
        sb = get_supabase()
        
        # 1. Fetch Diff
        async with httpx.AsyncClient(follow_redirects=True) as client:
            headers = {"Authorization": f"token {settings.github_access_token}"} if settings.github_access_token else {}
            resp = await client.get(diff_url, headers=headers)
            resp.raise_for_status()
            diff_text = resp.text[:20000]

        # 2. Generate Summary
        client = _get_client()
        prompt = f"Summarize the technical changes in this PR:\nTitle: {pr_data.get('title')}\nDiff:\n{diff_text}"
        
        response = client.models.generate_content(model=MODEL, contents=prompt)
        summary = response.text

        # 3. Prepare Record
        pr_record = {
            "workspace_id": str(workspace_id),
            "github_node_id": pr_data.get("node_id"),
            "pr_number": pr_data.get("number"),
            "title": pr_data.get("title"),
            "body": pr_data.get("body"),
            "author_username": pr_data.get("user", {}).get("login", "unknown"),
            "state": "merged" if pr_data.get("merged") else pr_data.get("state", "open"),
            "diff_url": diff_url,
            "summary": summary
        }

        # 4. Upsert into Table
        # NOTE: 'on_conflict' MUST match your UNIQUE constraint in SQL
        res = sb.table("github_pull_requests").upsert(
            pr_record, 
            on_conflict="github_node_id" 
        ).execute()
        
        logger.info(f"✅ PR #{pr_data.get('number')} saved to Supabase")

    except Exception as e:
        logger.exception(f"❌ Background Task Failed: {e}")


@router.post("/github")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_github_event: str = Header(None)
):
    print("This got here")
    """Receive GitHub Webhooks, verify signature, and process PRs asynchronously."""
    
    # Extract signature header (Note: FastAPI headers are usually lowercased and underscores converted from dashes)
    signature_header = request.headers.get("x-hub-signature-256")
    
    # 1. Verify Signature
    if not settings.github_webhook_secret:
        raise HTTPException(status_code=500, detail="GitHub Webhook Secret not configured")

    payload_body = await request.body()
    if not verify_signature(payload_body, settings.github_webhook_secret, signature_header):
        raise HTTPException(status_code=401, detail="Invalid signature")

    # 2. Parse Payload
    try:
        payload = json.loads(payload_body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    # 3. Filter Event Types (Noise reduction)
    if x_github_event != "pull_request":
        print("THIS IS NOT A PR")
        return {"status": "ignored", "reason": "Not a pull_request event"}

    action = payload.get("action")
    if action not in ["opened", "synchronize", "closed"]:
        print("THIS ONE DONT MATTER")
        return {"status": "ignored", "reason": f"Action '{action}' ignored"}

    # 4. Resolve Workspace ID from Repository Full Name
    repository = payload.get("repository", {})
    full_name = repository.get("full_name")
    print(f"Repo: {repository}")
    print(f"Full Name: {full_name}")
    
    if not full_name:
        return {"status": "ignored", "reason": "No repository full_name found"}

    sb = get_supabase()
    # Find workspaces whose github_repo field ends with or contains the full_name.
    # ILIKE '%owner/repo%' handles urls like 'https://github.com/owner/repo' OR just 'owner/repo'.
    workspaces_resp = sb.table("workspaces").select("id, github_repo").ilike("github_repo", f"%{full_name}%").execute()

    if not workspaces_resp.data:
         return {"status": "ignored", "reason": f"No workspace found for repo {full_name}"}
         
    # Take the first matched workspace
    workspace_id = workspaces_resp.data[0]['id']
    
    pr_data = payload.get("pull_request", {})
    diff_url = pr_data.get("diff_url")
    
    if not diff_url:
        return {"status": "ignored", "reason": "No diff_url found"}

    # 5. Dispatch Background Task
    background_tasks.add_task(summarize_and_store_pr, workspace_id, pr_data, diff_url)

    # 6. Return fast response
    return {"status": "accepted"}
