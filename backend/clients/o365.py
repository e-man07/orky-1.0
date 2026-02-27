"""Office 365 / Microsoft Graph API client."""

import httpx
from typing import Any


class O365Client:
    def __init__(self, tenant_id: str, client_id: str, client_secret: str):
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.client_secret = client_secret
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
                    "scope": "https://graph.microsoft.com/.default",
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

    async def send_email(self, params: dict[str, Any]) -> dict:
        headers = await self._headers()
        async with httpx.AsyncClient() as client:
            body = {
                "message": {
                    "subject": params["subject"],
                    "body": {"contentType": "Text", "content": params["body"]},
                    "toRecipients": [
                        {"emailAddress": {"address": params["to"]}}
                    ],
                }
            }
            resp = await client.post(
                "https://graph.microsoft.com/v1.0/me/sendMail",
                json=body, headers=headers,
            )
            resp.raise_for_status()
            return {"sent": True, "to": params["to"]}

    async def create_event(self, params: dict[str, Any]) -> dict:
        headers = await self._headers()
        async with httpx.AsyncClient() as client:
            body = {
                "subject": params["subject"],
                "start": {"dateTime": params["start"], "timeZone": "UTC"},
                "end": {"dateTime": params["end"], "timeZone": "UTC"},
            }
            if params.get("attendees"):
                body["attendees"] = [
                    {"emailAddress": {"address": email}, "type": "required"}
                    for email in params["attendees"]
                ]

            resp = await client.post(
                "https://graph.microsoft.com/v1.0/me/events",
                json=body, headers=headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def search_emails(self, params: dict[str, Any]) -> dict:
        headers = await self._headers()
        top = params.get("top", 10)
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://graph.microsoft.com/v1.0/me/messages",
                params={"$search": f'"{params["query"]}"', "$top": top},
                headers=headers,
            )
            resp.raise_for_status()
            return resp.json()
