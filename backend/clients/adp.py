"""ADP REST API client."""

import httpx
from typing import Any


class ADPClient:
    def __init__(self, base_url: str, client_id: str, client_secret: str):
        self.base_url = base_url.rstrip("/")
        self.client_id = client_id
        self.client_secret = client_secret
        self._access_token: str | None = None

    async def _get_token(self) -> str:
        if self._access_token:
            return self._access_token

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/auth/oauth/v2/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
            )
            resp.raise_for_status()
            self._access_token = resp.json()["access_token"]
            return self._access_token

    async def _headers(self) -> dict:
        token = await self._get_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    async def get_worker_details(self, params: dict[str, Any]) -> dict:
        headers = await self._headers()
        worker_id = params["worker_id"]
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/hr/v2/workers/{worker_id}",
                headers=headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_payroll_summary(self, params: dict[str, Any]) -> dict:
        headers = await self._headers()
        async with httpx.AsyncClient() as client:
            query_params = {}
            if params.get("pay_period"):
                query_params["payPeriod"] = params["pay_period"]
            if params.get("department"):
                query_params["department"] = params["department"]

            resp = await client.get(
                f"{self.base_url}/payroll/v1/payroll-summary",
                params=query_params, headers=headers,
            )
            resp.raise_for_status()
            return resp.json()
