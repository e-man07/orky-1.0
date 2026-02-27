import time
import httpx


class SharePointClient:
    GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"

    def __init__(self, tenant_id: str, client_id: str, client_secret: str, site_url: str | None = None):
        if not tenant_id or not client_id or not client_secret:
            raise ValueError("SharePoint tenant_id, client_id, and client_secret are required")
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.client_secret = client_secret
        self.site_url = site_url
        self.token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
        self._access_token: str | None = None
        self._token_expires_at: float = 0

    async def _get_access_token(self) -> str:
        if self._access_token and time.time() < self._token_expires_at:
            return self._access_token

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                self.token_url,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "scope": "https://graph.microsoft.com/.default",
                    "grant_type": "client_credentials",
                },
            )
            if not resp.is_success:
                raise Exception(f"SharePoint auth failed {resp.status_code}: {resp.text}")
            data = resp.json()

        self._access_token = data["access_token"]
        self._token_expires_at = time.time() + (data["expires_in"] - 300)
        return self._access_token

    async def _headers(self) -> dict:
        token = await self._get_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def _get_site_id(self, site_url: str | None = None) -> str:
        url = site_url or self.site_url
        if not url:
            raise ValueError("Site URL is required")

        site_path = url.replace("https://", "").replace("http://", "")
        if ":/" not in site_path and "/" in site_path:
            parts = site_path.split("/", 1)
            site_path = f"{parts[0]}:/{parts[1]}"

        headers = await self._headers()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{self.GRAPH_BASE_URL}/sites/{site_path}", headers=headers)
            if not resp.is_success:
                raise Exception(f"Failed to get site: {resp.status_code}")
            return resp.json()["id"]

    async def list_files(self, site_url: str | None = None, folder_path: str | None = None) -> list[dict]:
        site_id = await self._get_site_id(site_url)
        headers = await self._headers()

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{self.GRAPH_BASE_URL}/sites/{site_id}/drives", headers=headers)
            if not resp.is_success:
                raise Exception(f"Failed to get drives: {resp.status_code}")
            drives = resp.json()
            drive_id = drives.get("value", [{}])[0].get("id")
            if not drive_id:
                raise Exception("No drives found")

            if folder_path:
                path = folder_path.strip("/")
                url = f"{self.GRAPH_BASE_URL}/sites/{site_id}/drives/{drive_id}/root:/{path}:/children"
            else:
                url = f"{self.GRAPH_BASE_URL}/sites/{site_id}/drives/{drive_id}/root/children"

            resp = await client.get(url, headers=headers)
            if not resp.is_success:
                raise Exception(f"Failed to list files: {resp.status_code}")
            data = resp.json()

        return [
            {
                "name": f["name"],
                "size": f.get("size"),
                "web_url": f.get("webUrl"),
                "last_modified": f.get("lastModifiedDateTime"),
                "is_folder": bool(f.get("folder")),
            }
            for f in data.get("value", [])
        ]

    async def upload_file(self, file_name: str, file_content: str, site_url: str | None = None, folder_path: str | None = None) -> dict:
        site_id = await self._get_site_id(site_url)
        token = await self._get_access_token()

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(
                f"{self.GRAPH_BASE_URL}/sites/{site_id}/drives",
                headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            )
            drives = resp.json()
            drive_id = drives.get("value", [{}])[0].get("id")
            if not drive_id:
                raise Exception("No drives found")

            path = f"{folder_path.strip('/')}/{file_name}" if folder_path else file_name
            url = f"{self.GRAPH_BASE_URL}/sites/{site_id}/drives/{drive_id}/root:/{path}:/content"

            resp = await client.put(
                url,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/octet-stream"},
                content=file_content.encode(),
            )
            if not resp.is_success:
                raise Exception(f"Failed to upload file: {resp.status_code}")
            data = resp.json()

        return {"name": data["name"], "web_url": data.get("webUrl"), "size": data.get("size"), "uploaded": True}

    async def search_files(self, query: str, site_url: str | None = None, limit: int = 25) -> list[dict]:
        await self._get_site_id(site_url)  # ensure authenticated
        headers = await self._headers()

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.GRAPH_BASE_URL}/search/query",
                headers=headers,
                json={
                    "requests": [{
                        "entityTypes": ["driveItem"],
                        "query": {"queryString": query},
                        "from": 0,
                        "size": limit,
                    }],
                },
            )
            if not resp.is_success:
                raise Exception(f"SharePoint search failed: {resp.status_code}")
            data = resp.json()

        results = []
        for container in data.get("value", [{}])[0].get("hitsContainers", []):
            results.extend(container.get("hits", []))
        return [
            {
                "name": hit.get("resource", {}).get("name"),
                "web_url": hit.get("resource", {}).get("webUrl"),
                "summary": hit.get("summary"),
            }
            for hit in results
        ]
