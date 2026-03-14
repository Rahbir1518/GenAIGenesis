"""Moorcheh-powered engineering search — indexes GitHub PRs per workspace."""

from __future__ import annotations

import logging
import time
from typing import Any

from moorcheh_sdk import MoorchehClient

from app.core.config import settings
from app.services.supabase import get_supabase

logger = logging.getLogger(__name__)

# Namespace naming convention: "ws-{workspace_id}-engineering"
_NS_PREFIX = "ws-eng-"


def _namespace_name(workspace_id: str) -> str:
    """Deterministic Moorcheh namespace for a workspace's engineering data."""
    clean_id = workspace_id.replace("-", "")
    return f"{_NS_PREFIX}{clean_id}"


def _get_client() -> MoorchehClient:
    return MoorchehClient(api_key=settings.moorcheh_api_key)


# ---------------------------------------------------------------------------
# Fetch PRs from Supabase
# ---------------------------------------------------------------------------

def _fetch_prs(workspace_id: str) -> list[dict]:
    """Return all github_pull_requests rows for a workspace."""
    sb = get_supabase()
    resp = (
        sb.table("github_pull_requests")
        .select("id, pr_number, title, body, author_username, state, summary")
        .eq("workspace_id", workspace_id)
        .execute()
    )
    return resp.data or []


# ---------------------------------------------------------------------------
# Build document text per PR
# ---------------------------------------------------------------------------

def _pr_to_document(pr: dict) -> dict:
    """Convert a PR row into a Moorcheh text document."""
    parts = [
        f"PR #{pr['pr_number']}: {pr['title']}",
        f"Author: {pr['author_username']}",
        f"State: {pr['state']}",
    ]
    if pr.get("summary"):
        parts.append(f"Summary: {pr['summary']}")
    if pr.get("body"):
        # Truncate very long bodies to stay within upload limits
        body = pr["body"][:2000]
        parts.append(f"Description: {body}")

    return {
        "id": str(pr["id"]),
        "text": "\n".join(parts),
    }


# ---------------------------------------------------------------------------
# Ensure namespace exists (create if missing)
# ---------------------------------------------------------------------------

def _ensure_namespace(client: MoorchehClient, ns_name: str) -> None:
    """Create the namespace if it doesn't already exist."""
    try:
        existing = client.namespaces.list()
        names = [n.get("name") or n for n in (existing if isinstance(existing, list) else existing.get("namespaces", []))]
        if ns_name in names:
            return
    except Exception:
        pass  # list may not be supported the same way; try creating

    try:
        client.namespaces.create(namespace_name=ns_name, type="text")
        logger.info("Created Moorcheh namespace %s", ns_name)
    except Exception as exc:
        # 409 / already-exists is fine
        if "already" in str(exc).lower() or "exists" in str(exc).lower() or "409" in str(exc):
            logger.debug("Namespace %s already exists", ns_name)
        else:
            raise


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def sync_workspace_prs(workspace_id: str) -> int:
    """Index (or re-index) all PRs for a workspace into Moorcheh.

    Returns the number of documents uploaded.
    """
    prs = _fetch_prs(workspace_id)
    if not prs:
        logger.info("No PRs found for workspace %s — skipping sync", workspace_id)
        return 0

    docs = [_pr_to_document(pr) for pr in prs]
    ns_name = _namespace_name(workspace_id)

    with _get_client() as client:
        _ensure_namespace(client, ns_name)

        # Upload in batches of 50
        batch_size = 50
        for i in range(0, len(docs), batch_size):
            batch = docs[i : i + batch_size]
            client.documents.upload(namespace_name=ns_name, documents=batch)
            logger.info(
                "Uploaded batch %d–%d to %s",
                i, min(i + batch_size, len(docs)), ns_name,
            )

    logger.info("Synced %d PRs to Moorcheh namespace %s", len(docs), ns_name)
    return len(docs)


def search_engineering_context(
    workspace_id: str,
    query: str,
    top_k: int = 5,
) -> list[dict]:
    """Semantic search over the workspace's indexed PRs.

    Returns a list of result dicts from Moorcheh.
    """
    ns_name = _namespace_name(workspace_id)

    with _get_client() as client:
        _ensure_namespace(client, ns_name)

        results = client.similarity_search.query(
            namespaces=[ns_name],
            query=query,
            top_k=top_k,
        )

    # Normalise to a list
    if isinstance(results, dict):
        return results.get("results", results.get("matches", [results]))
    if isinstance(results, list):
        return results
    return [results]


def generate_engineering_answer(
    workspace_id: str,
    query: str,
) -> str:
    """Use Moorcheh's generative answer endpoint for a grounded response."""
    ns_name = _namespace_name(workspace_id)

    with _get_client() as client:
        _ensure_namespace(client, ns_name)

        answer = client.answer.generate(
            namespace=ns_name,
            query=query,
        )

    if isinstance(answer, dict):
        return answer.get("answer", answer.get("text", str(answer)))
    return str(answer)


async def engineering_search_pipeline(
    workspace_id: str,
    question_text: str,
) -> dict[str, Any]:
    """Full engineering pipeline: sync PRs → search → generate answer.

    Returns {"answer": str, "sources": list[dict], "synced_count": int}.
    """
    return engineering_search_pipeline_sync(workspace_id, question_text)


def engineering_search_pipeline_sync(
    workspace_id: str,
    question_text: str,
) -> dict[str, Any]:
    """Synchronous version of the engineering pipeline (runs in a thread)."""
    # 1. Sync PRs into Moorcheh (idempotent)
    synced = sync_workspace_prs(workspace_id)

    if synced == 0:
        # Check if we already have data from a prior sync by trying search
        try:
            results = search_engineering_context(workspace_id, question_text, top_k=1)
            if not results:
                return {
                    "answer": "No GitHub pull requests found for this workspace. "
                              "Connect a GitHub repo and sync PRs first.",
                    "sources": [],
                    "synced_count": 0,
                }
        except Exception:
            return {
                "answer": "No GitHub pull requests found for this workspace. "
                          "Connect a GitHub repo and sync PRs first.",
                "sources": [],
                "synced_count": 0,
            }

    # Small delay to let Moorcheh finish indexing new documents
    if synced > 0:
        time.sleep(2)

    # 2. Semantic search for relevant PRs
    sources = search_engineering_context(workspace_id, question_text, top_k=5)

    # 3. Generate grounded answer
    answer = generate_engineering_answer(workspace_id, question_text)

    return {
        "answer": answer,
        "sources": sources,
        "synced_count": synced,
    }
