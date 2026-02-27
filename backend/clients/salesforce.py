"""Salesforce REST API client."""

import httpx
from typing import Any


class SalesforceClient:
    def __init__(self, instance_url: str, access_token: str):
        self.instance_url = instance_url.rstrip("/")
        self.access_token = access_token
        self.api_version = "v59.0"
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

    def _url(self, path: str) -> str:
        return f"{self.instance_url}/services/data/{self.api_version}{path}"

    async def create_lead(self, params: dict[str, Any]) -> dict:
        async with httpx.AsyncClient() as client:
            body = {}
            if params.get("first_name"):
                body["FirstName"] = params["first_name"]
            if params.get("last_name"):
                body["LastName"] = params["last_name"]
            if params.get("email"):
                body["Email"] = params["email"]
            if params.get("company"):
                body["Company"] = params["company"]

            resp = await client.post(self._url("/sobjects/Lead"), json=body, headers=self.headers)
            resp.raise_for_status()
            return resp.json()

    async def create_case(self, params: dict[str, Any]) -> dict:
        async with httpx.AsyncClient() as client:
            body = {"Subject": params["subject"]}
            if params.get("description"):
                body["Description"] = params["description"]
            if params.get("priority"):
                body["Priority"] = params["priority"]

            resp = await client.post(self._url("/sobjects/Case"), json=body, headers=self.headers)
            resp.raise_for_status()
            return resp.json()

    async def update_opportunity(self, params: dict[str, Any]) -> dict:
        opp_id = params["opportunity_id"]
        async with httpx.AsyncClient() as client:
            body = {}
            if params.get("stage"):
                body["StageName"] = params["stage"]
            if params.get("amount") is not None:
                body["Amount"] = params["amount"]

            resp = await client.patch(
                self._url(f"/sobjects/Opportunity/{opp_id}"), json=body, headers=self.headers
            )
            resp.raise_for_status()
            return {"id": opp_id, "updated": True}

    async def soql_query(self, params: dict[str, Any]) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                self._url("/query"), params={"q": params["query"]}, headers=self.headers
            )
            resp.raise_for_status()
            return resp.json()
