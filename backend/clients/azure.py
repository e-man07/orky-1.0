"""Azure REST API client (ARM / Log Analytics)."""

import httpx
from typing import Any


class AzureClient:
    def __init__(self, tenant_id: str, client_id: str, client_secret: str, subscription_id: str):
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.client_secret = client_secret
        self.subscription_id = subscription_id
        self._access_token: str | None = None

    async def _get_token(self) -> str:
        if self._access_token:
            return self._access_token

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "scope": "https://management.azure.com/.default",
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

    async def list_vms(self, params: dict[str, Any]) -> dict:
        headers = await self._headers()
        resource_group = params.get("resource_group")
        async with httpx.AsyncClient() as client:
            if resource_group:
                url = f"https://management.azure.com/subscriptions/{self.subscription_id}/resourceGroups/{resource_group}/providers/Microsoft.Compute/virtualMachines?api-version=2023-09-01"
            else:
                url = f"https://management.azure.com/subscriptions/{self.subscription_id}/providers/Microsoft.Compute/virtualMachines?api-version=2023-09-01"

            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            return resp.json()

    async def create_vm(self, params: dict[str, Any]) -> dict:
        headers = await self._headers()
        rg = params["resource_group"]
        name = params["name"]
        async with httpx.AsyncClient() as client:
            body = {
                "location": "eastus",
                "properties": {
                    "hardwareProfile": {"vmSize": params["size"]},
                    "storageProfile": {
                        "imageReference": {"id": params.get("image", "")},
                    },
                },
            }
            resp = await client.put(
                f"https://management.azure.com/subscriptions/{self.subscription_id}/resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/{name}?api-version=2023-09-01",
                json=body, headers=headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def run_query(self, params: dict[str, Any]) -> dict:
        headers = await self._headers()
        workspace_id = params["workspace_id"]
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://api.loganalytics.io/v1/workspaces/{workspace_id}/query",
                json={"query": params["query"]},
                headers=headers,
            )
            resp.raise_for_status()
            return resp.json()
