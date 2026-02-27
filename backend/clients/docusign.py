"""DocuSign eSignature REST API client."""

import httpx
from typing import Any


class DocuSignClient:
    def __init__(self, base_url: str, account_id: str, access_token: str):
        self.base_url = base_url.rstrip("/")
        self.account_id = account_id
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

    async def send_envelope(self, params: dict[str, Any]) -> dict:
        async with httpx.AsyncClient() as client:
            body = {
                "emailSubject": f"Please sign: {params['document_name']}",
                "recipients": {
                    "signers": [
                        {
                            "email": params["signer_email"],
                            "name": params["signer_name"],
                            "recipientId": "1",
                            "routingOrder": "1",
                        }
                    ]
                },
                "status": "sent",
            }
            resp = await client.post(
                f"{self.base_url}/restapi/v2.1/accounts/{self.account_id}/envelopes",
                json=body, headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_envelope_status(self, params: dict[str, Any]) -> dict:
        envelope_id = params["envelope_id"]
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/restapi/v2.1/accounts/{self.account_id}/envelopes/{envelope_id}",
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()
