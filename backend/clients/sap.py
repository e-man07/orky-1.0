"""SAP REST API client (OData / RFC)."""

import httpx
from typing import Any


class SAPClient:
    def __init__(self, base_url: str, username: str, password: str):
        self.base_url = base_url.rstrip("/")
        self.auth = (username, password)
        self.headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def create_purchase_order(self, params: dict[str, Any]) -> dict:
        async with httpx.AsyncClient() as client:
            body = {
                "VendorId": params["vendor_id"],
                "Items": params.get("items", []),
            }
            if params.get("delivery_date"):
                body["DeliveryDate"] = params["delivery_date"]

            resp = await client.post(
                f"{self.base_url}/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/PurchaseOrders",
                json=body, auth=self.auth, headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_material_stock(self, params: dict[str, Any]) -> dict:
        async with httpx.AsyncClient() as client:
            material_id = params["material_id"]
            query_params = {}
            if params.get("plant"):
                query_params["$filter"] = f"Plant eq '{params['plant']}'"

            resp = await client.get(
                f"{self.base_url}/sap/opu/odata/sap/API_MATERIAL_STOCK_SRV/MaterialStock('{material_id}')",
                params=query_params, auth=self.auth, headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def post_financial_document(self, params: dict[str, Any]) -> dict:
        async with httpx.AsyncClient() as client:
            body = {
                "CompanyCode": params["company_code"],
                "DocumentType": params["document_type"],
            }
            if params.get("posting_date"):
                body["PostingDate"] = params["posting_date"]

            resp = await client.post(
                f"{self.base_url}/sap/opu/odata/sap/API_JOURNALENTRYITEMBASIC_SRV/JournalEntryItems",
                json=body, auth=self.auth, headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()
