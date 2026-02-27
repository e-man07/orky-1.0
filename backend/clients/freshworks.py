"""FreshWorks (Freshdesk) REST API client."""

import httpx
from typing import Any
from base64 import b64encode


class FreshWorksClient:
    def __init__(self, domain: str, api_key: str):
        self.base_url = f"https://{domain}.freshdesk.com/api/v2"
        credentials = b64encode(f"{api_key}:X".encode()).decode()
        self.headers = {
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json",
        }

    async def create_ticket(self, params: dict[str, Any]) -> dict:
        async with httpx.AsyncClient() as client:
            body = {
                "subject": params["subject"],
                "email": params["email"],
            }
            if params.get("description"):
                body["description"] = params["description"]
            if params.get("priority") is not None:
                body["priority"] = params["priority"]
            body.setdefault("status", 2)  # Open

            resp = await client.post(
                f"{self.base_url}/tickets", json=body, headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def update_ticket(self, params: dict[str, Any]) -> dict:
        ticket_id = params["ticket_id"]
        async with httpx.AsyncClient() as client:
            body = {}
            if params.get("status") is not None:
                body["status"] = params["status"]
            if params.get("priority") is not None:
                body["priority"] = params["priority"]

            resp = await client.put(
                f"{self.base_url}/tickets/{ticket_id}", json=body, headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def list_tickets(self, params: dict[str, Any]) -> dict:
        async with httpx.AsyncClient() as client:
            query_params = {}
            if params.get("filter"):
                query_params["filter"] = params["filter"]
            if params.get("page"):
                query_params["page"] = params["page"]

            resp = await client.get(
                f"{self.base_url}/tickets", params=query_params, headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()
