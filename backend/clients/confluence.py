"""Confluence REST API client."""

import httpx
from typing import Any
from base64 import b64encode


class ConfluenceClient:
    def __init__(self, base_url: str, email: str, api_token: str):
        self.base_url = base_url.rstrip("/")
        credentials = b64encode(f"{email}:{api_token}".encode()).decode()
        self.headers = {
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def create_page(self, params: dict[str, Any]) -> dict:
        async with httpx.AsyncClient() as client:
            body = {
                "type": "page",
                "title": params["title"],
                "space": {"key": params["space_key"]},
                "body": {
                    "storage": {
                        "value": params["body"],
                        "representation": "storage",
                    }
                },
            }
            resp = await client.post(
                f"{self.base_url}/rest/api/content", json=body, headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def update_page(self, params: dict[str, Any]) -> dict:
        page_id = params["page_id"]
        async with httpx.AsyncClient() as client:
            # Get current version
            get_resp = await client.get(
                f"{self.base_url}/rest/api/content/{page_id}", headers=self.headers,
            )
            get_resp.raise_for_status()
            current = get_resp.json()
            version = current["version"]["number"] + 1

            body = {
                "type": "page",
                "title": params.get("title", current["title"]),
                "version": {"number": version},
                "body": {
                    "storage": {
                        "value": params.get("body", ""),
                        "representation": "storage",
                    }
                },
            }
            resp = await client.put(
                f"{self.base_url}/rest/api/content/{page_id}",
                json=body, headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def search_content(self, params: dict[str, Any]) -> dict:
        limit = params.get("limit", 25)
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/rest/api/content/search",
                params={"cql": params["cql"], "limit": limit},
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()
