"""WhatsApp Business API client."""

import httpx
from typing import Any


class WhatsAppClient:
    def __init__(self, phone_number_id: str, access_token: str):
        self.phone_number_id = phone_number_id
        self.access_token = access_token
        self.base_url = f"https://graph.facebook.com/v18.0/{phone_number_id}"
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

    async def send_message(self, params: dict[str, Any]) -> dict:
        async with httpx.AsyncClient() as client:
            body = {
                "messaging_product": "whatsapp",
                "to": params["to"],
                "type": "text",
                "text": {"body": params["message"]},
            }
            resp = await client.post(
                f"{self.base_url}/messages", json=body, headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def send_template(self, params: dict[str, Any]) -> dict:
        async with httpx.AsyncClient() as client:
            components = []
            if params.get("parameters"):
                components.append({
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": p} for p in params["parameters"]
                    ],
                })

            body = {
                "messaging_product": "whatsapp",
                "to": params["to"],
                "type": "template",
                "template": {
                    "name": params["template_name"],
                    "language": {"code": "en_US"},
                    "components": components,
                },
            }
            resp = await client.post(
                f"{self.base_url}/messages", json=body, headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()
