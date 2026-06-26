"""Freshservice (ITSM) REST API v2 client."""

import asyncio
from base64 import b64encode
from typing import Any

import httpx

RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504]


class FreshserviceClient:
    def __init__(self, domain: str, api_key: str):
        if not domain or not domain.strip():
            raise ValueError("Freshservice domain is required")
        if not api_key or not api_key.strip():
            raise ValueError("Freshservice api_key is required")

        domain = domain.strip().rstrip("/")
        self.domain = domain
        self.base_url = f"https://{domain}/api/v2"
        credentials = b64encode(f"{api_key}:X".encode()).decode()
        self.headers = {
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json",
        }

    def _ticket_url(self, ticket_id: int) -> str:
        return f"https://{self.domain}/a/tickets/{ticket_id}"

    async def _request(
        self,
        method: str,
        url: str,
        json_data: dict | None = None,
        params: dict | None = None,
        max_attempts: int = 3,
    ) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            for attempt in range(max_attempts):
                resp = await client.request(
                    method, url, headers=self.headers, json=json_data, params=params
                )
                if resp.status_code in RETRYABLE_STATUS_CODES and attempt < max_attempts - 1:
                    retry_after = resp.headers.get("Retry-After")
                    delay = int(retry_after) if retry_after else (attempt + 1) * 2
                    await asyncio.sleep(delay)
                    continue
                resp.raise_for_status()
                return resp.json()
        # Should not reach here, but just in case
        raise httpx.HTTPStatusError("Max retries exceeded", request=resp.request, response=resp)

    # ── Tier 1 Actions ───────────────────────────────────────────────

    async def create_ticket(self, data: dict[str, Any]) -> dict:
        result = await self._request("POST", f"{self.base_url}/tickets", json_data=data)
        ticket = result.get("ticket", {})
        return {
            "id": ticket["id"],
            "subject": ticket.get("subject", ""),
            "url": self._ticket_url(ticket["id"]),
        }

    async def update_ticket(self, ticket_id: int, data: dict[str, Any]) -> dict:
        await self._request("PUT", f"{self.base_url}/tickets/{ticket_id}", json_data=data)
        return {"updated": True, "id": ticket_id}

    async def get_ticket(self, ticket_id: int) -> dict:
        result = await self._request("GET", f"{self.base_url}/tickets/{ticket_id}")
        return result.get("ticket", {})

    async def list_tickets(self, params: dict[str, Any]) -> list:
        query_params: dict[str, Any] = {}
        if params.get("per_page"):
            query_params["per_page"] = params["per_page"]
        if params.get("page"):
            query_params["page"] = params["page"]

        if params.get("filter"):
            query_params["query"] = params["filter"]
            result = await self._request(
                "GET", f"{self.base_url}/tickets/filter", params=query_params
            )
        else:
            result = await self._request(
                "GET", f"{self.base_url}/tickets", params=query_params
            )
        return result.get("tickets", [])

    async def close_ticket(self, ticket_id: int, close_notes: str = "") -> dict:
        await self._request(
            "PUT", f"{self.base_url}/tickets/{ticket_id}", json_data={"status": 5}
        )
        if close_notes:
            await self.add_ticket_note(ticket_id, close_notes, private=True)
        return {"closed": True, "id": ticket_id}

    async def create_service_request(
        self, catalog_item_id: int, data: dict[str, Any]
    ) -> dict:
        result = await self._request(
            "POST",
            f"{self.base_url}/service_catalog/items/{catalog_item_id}/place_request",
            json_data=data,
        )
        sr = result.get("service_request", {})
        return {
            "id": sr["id"],
            "subject": sr.get("subject", ""),
        }

    async def add_ticket_note(
        self, ticket_id: int, body: str, private: bool = True
    ) -> dict:
        result = await self._request(
            "POST",
            f"{self.base_url}/tickets/{ticket_id}/notes",
            json_data={"body": body, "private": private},
        )
        conversation = result.get("conversation", {})
        return {"id": conversation["id"], "body": conversation.get("body", "")}
