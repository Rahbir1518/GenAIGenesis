import hmac
import hashlib
import httpx
import json
import asyncio

async def test_local_webhook():
    url = "http://localhost:8000/api/github" # Adjust path to your router prefix
    secret = "genaigenesis" # Match GITHUB_WEBHOOK_SECRET in .env
    
    payload = {
        "action": "opened",
        "repository": {"full_name": "owner/repo"}, # Match a repo in your DB
        "pull_request": {
            "node_id": "test_node_123",
            "number": 1,
            "title": "Test PR",
            "body": "Testing the summary integration",
            "diff_url": "https://patch-diff.githubusercontent.com/raw/owner/repo/pull/1.diff",
            "user": {"login": "testuser"}
        }
    }
    
    body = json.dumps(payload).encode('utf-8')
    signature = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    
    headers = {
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": signature,
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, content=body, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")

if __name__ == "__main__":
    asyncio.run(test_local_webhook())