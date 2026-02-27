from base64 import b64encode
import httpx


class JiraClient:
    def __init__(self, base_url: str, email: str, api_token: str):
        self.base_url = base_url.rstrip("/")
        auth = b64encode(f"{email}:{api_token}".encode()).decode()
        self.headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Basic {auth}",
        }

    async def _request(self, method: str, path: str, body: dict | None = None, params: dict | None = None) -> dict | None:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.request(method, f"{self.base_url}{path}", headers=self.headers, json=body, params=params)
            if resp.status_code == 204:
                return None
            if not resp.is_success:
                raise Exception(f"Jira API error {resp.status_code}: {resp.text}")
            return resp.json()

    @staticmethod
    def _to_adf(text: str) -> dict:
        return {
            "type": "doc",
            "version": 1,
            "content": [{"type": "paragraph", "content": [{"type": "text", "text": text}]}],
        }

    async def create_issue(self, params: dict) -> dict:
        fields: dict = {
            "project": {"key": params["project_key"]},
            "summary": params["summary"],
            "issuetype": {"name": params["issue_type"]},
        }
        if params.get("description"):
            fields["description"] = self._to_adf(params["description"])
        if params.get("priority"):
            fields["priority"] = {"name": params["priority"]}
        if params.get("labels"):
            fields["labels"] = params["labels"]

        result = await self._request("POST", "/rest/api/3/issue", {"fields": fields})
        return {"key": result["key"], "id": result["id"], "url": f"{self.base_url}/browse/{result['key']}"}

    async def update_issue(self, issue_key: str, fields: dict) -> dict:
        await self._request("PUT", f"/rest/api/3/issue/{issue_key}", {"fields": fields})
        return {"updated": True, "issue_key": issue_key}

    async def transition_issue(self, issue_key: str, transition_id: str, comment: str | None = None) -> dict:
        body: dict = {"transition": {"id": transition_id}}
        if comment:
            body["update"] = {"comment": [{"add": {"body": self._to_adf(comment)}}]}
        await self._request("POST", f"/rest/api/3/issue/{issue_key}/transitions", body)
        return {"transitioned": True, "issue_key": issue_key}

    async def add_comment(self, issue_key: str, comment: str) -> dict:
        result = await self._request("POST", f"/rest/api/3/issue/{issue_key}/comment", {"body": self._to_adf(comment)})
        return {"comment_id": result["id"], "comment_added": True}

    async def search_issues(self, jql: str, max_results: int = 50) -> list:
        result = await self._request("GET", "/rest/api/3/search", params={"jql": jql, "maxResults": str(max_results)})
        return result.get("issues", [])
