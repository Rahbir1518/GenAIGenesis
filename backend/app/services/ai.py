"""Gemini AI wrapper — extraction, embeddings, answering."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from google import genai
from google.genai import types

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------
_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


MODEL = "gemini-2.5-flash"
EMBED_MODEL = "gemini-embedding-001"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_json(text: str) -> Any:
    """Best-effort parse JSON from Gemini's response (may be wrapped in markdown)."""
    # Strip markdown code fences
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON array or object
        match = re.search(r"[\[{].*[\]}]", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return None


# ---------------------------------------------------------------------------
# Embeddings
# ---------------------------------------------------------------------------

async def generate_embedding(text: str) -> list[float]:
    """Generate a 768-dim embedding using Gemini text-embedding-004."""
    client = _get_client()
    result = client.models.embed_content(
        model=EMBED_MODEL,
        contents=text,
    )
    return list(result.embeddings[0].values)


# ---------------------------------------------------------------------------
# Context Extraction
# ---------------------------------------------------------------------------

EXTRACTION_PROMPT = """You are a knowledge extraction engine for a workspace chat system.
Analyze the following chat message and extract structured facts that would be useful for a knowledge base.

For each fact, return:
- "domain": the high-level domain (e.g., "authentication", "api", "database", "deployment", "frontend", "billing")
- "label": a short label for this knowledge node (3-8 words)
- "summary": a detailed summary of the fact (1-3 sentences)
- "owner_hint": if the message author seems to be an expert on this, return "yes", otherwise "no"

Agent type: {agent_type}
Message author: {author_name}

Return a JSON array of extracted facts. If the message is just casual chat with no useful knowledge, return an empty array [].

Message:
\"\"\"{message_text}\"\"\"
"""


async def extract_context(
    message_text: str,
    agent_type: str = "engineering",
    author_name: str = "Unknown",
) -> list[dict]:
    """Extract structured facts from a chat message."""
    client = _get_client()

    prompt = EXTRACTION_PROMPT.format(
        agent_type=agent_type,
        author_name=author_name,
        message_text=message_text,
    )

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.1,
            max_output_tokens=2048,
        ),
    )

    parsed = _parse_json(response.text)
    if isinstance(parsed, list):
        return parsed
    return []


# ---------------------------------------------------------------------------
# Question Classification
# ---------------------------------------------------------------------------

CLASSIFY_PROMPT = """You are a question classifier for a workspace knowledge system.
Classify the following question and extract information about it.

Return a JSON object with:
- "question_type": one of "sales", "engineering", "general", "onboarding"
- "domains": array of relevant domain strings (e.g., ["authentication", "api"])
- "is_who_knows": boolean — true if the user is asking "who knows about X" or "who owns X"
- "topic": the core topic being asked about (2-5 words)
- "urgency": one of "normal", "high", "critical"

Question:
\"\"\"{question_text}\"\"\"
"""


async def classify_question(question_text: str) -> dict:
    """Classify a question and extract domains."""
    
    client = _get_client()

    response = client.models.generate_content(
        model=MODEL,
        contents=CLASSIFY_PROMPT.format(question_text=question_text),
        config=types.GenerateContentConfig(
            temperature=0.0,
            max_output_tokens=512,
        ),
    )

    parsed = _parse_json(response.text)
    if isinstance(parsed, dict):
        return parsed
    return {
        "question_type": "capability",
        "domains": [],
        "is_who_knows": False,
        "topic": question_text[:50],
        "urgency": "normal",
    }


# ---------------------------------------------------------------------------
# Answer Generation
# ---------------------------------------------------------------------------

ANSWER_PROMPT = """You are ContextBridge, an AI assistant for a workspace.
Answer the user's question using ONLY the context provided from the knowledge tree.

Context nodes (sorted by relevance):
{context_json}

Rules:
1. Base your answer strictly on the provided context nodes.
2. If the context is sufficient (confidence is high), give a direct, clear answer.
3. If the context is partial, answer but note the uncertainty.
4. Reference which domain/node the information comes from.
5. Keep answers concise (2-4 sentences max).
6. If context is completely insufficient, say you don't have enough information.

Question: \"\"\"{question_text}\"\"\"
"""

WHO_KNOWS_PROMPT = """You are ContextBridge, an AI assistant analyzing knowledge ownership.
Based on the following knowledge tree nodes and their owners, identify the top experts on the given topic.

Context nodes:
{context_json}

Topic: \"\"\"{topic}\"\"\"

Return a JSON object with:
- "experts": array of objects with "owner_id", "owner_name", "domain", "confidence", "reason" (1 sentence why they're an expert)

Sort by confidence descending, max 3 experts.
"""


async def generate_answer(
    question_text: str,
    context_nodes: list[dict],
) -> str:
    """Generate an answer from context nodes."""
    client = _get_client()

    # Build context for the prompt
    context_json = json.dumps([
        {
            "label": n.get("label", ""),
            "summary": n.get("summary", ""),
            "domain": n.get("domain", ""),
            "confidence": n.get("effective_confidence", n.get("confidence", 0)),
            "owner": n.get("owner_name", "Unknown"),
            "last_updated": n.get("updated_at", ""),
        }
        for n in context_nodes
    ], indent=2)

    response = client.models.generate_content(
        model=MODEL,
        contents=ANSWER_PROMPT.format(
            context_json=context_json,
            question_text=question_text,
        ),
        config=types.GenerateContentConfig(
            temperature=0.2,
            max_output_tokens=1024,
        ),
    )

    return response.text.strip()


async def find_experts(
    topic: str,
    context_nodes: list[dict],
) -> list[dict]:
    """Find top experts on a topic from context nodes."""
    client = _get_client()

    context_json = json.dumps([
        {
            "label": n.get("label", ""),
            "summary": n.get("summary", ""),
            "domain": n.get("domain", ""),
            "confidence": n.get("effective_confidence", n.get("confidence", 0)),
            "owner_id": n.get("owner_id", ""),
            "owner_name": n.get("owner_name", "Unknown"),
        }
        for n in context_nodes
    ], indent=2)

    response = client.models.generate_content(
        model=MODEL,
        contents=WHO_KNOWS_PROMPT.format(
            context_json=context_json,
            topic=topic,
        ),
        config=types.GenerateContentConfig(
            temperature=0.0,
            max_output_tokens=1024,
        ),
    )

    parsed = _parse_json(response.text)
    if isinstance(parsed, dict) and "experts" in parsed:
        return parsed["experts"]
    return []
