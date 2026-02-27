"""Workday REST API client."""

import httpx
from typing import Any


class WorkdayClient:
    def __init__(self, base_url: str, tenant: str, username: str, password: str):
        self.base_url = base_url.rstrip("/")
        self.tenant = tenant
        self.auth = (username, password)
        self.headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def get_worker(self, params: dict[str, Any]) -> dict:
        worker_id = params["worker_id"]
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/ccx/api/v1/{self.tenant}/workers/{worker_id}",
                auth=self.auth, headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def create_position(self, params: dict[str, Any]) -> dict:
        async with httpx.AsyncClient() as client:
            body = {
                "title": params["title"],
                "department": params["department"],
            }
            if params.get("location"):
                body["location"] = params["location"]

            resp = await client.post(
                f"{self.base_url}/ccx/api/v1/{self.tenant}/positions",
                json=body, auth=self.auth, headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def submit_time_off(self, params: dict[str, Any]) -> dict:
        async with httpx.AsyncClient() as client:
            body = {
                "worker_id": params["worker_id"],
                "start_date": params["start_date"],
                "end_date": params["end_date"],
            }
            if params.get("type"):
                body["type"] = params["type"]

            resp = await client.post(
                f"{self.base_url}/ccx/api/v1/{self.tenant}/timeOff",
                json=body, auth=self.auth, headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()
