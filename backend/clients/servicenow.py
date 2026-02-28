import asyncio
from base64 import b64encode
import httpx

RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504]


class ServiceNowClient:
    def __init__(self, instance: str, username: str, password: str):
        if not instance or not instance.strip():
            raise ValueError("ServiceNow instance URL is required")
        if not username or not username.strip():
            raise ValueError("ServiceNow username is required")
        if not password or not password.strip():
            raise ValueError("ServiceNow password is required")

        instance = instance.strip()
        if "/api/" in instance:
            instance = instance.split("/api/")[0]
        if not instance.startswith("http://") and not instance.startswith("https://"):
            instance = f"https://{instance}"
        instance = instance.rstrip("/")

        self.instance = instance
        self.username = username.strip()
        self.password = password.strip()
        self.base_url = f"{instance}/api/now/table"
        auth = b64encode(f"{self.username}:{self.password}".encode()).decode()
        self.headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Basic {auth}",
        }

    async def _request(self, method: str, url: str, json_data: dict | None = None, params: dict | None = None, max_attempts: int = 3) -> dict:
        last_error = None
        async with httpx.AsyncClient(timeout=30) as client:
            for attempt in range(max_attempts):
                try:
                    resp = await client.request(method, url, headers=self.headers, json=json_data, params=params)
                    if resp.status_code in RETRYABLE_STATUS_CODES and attempt < max_attempts - 1:
                        await asyncio.sleep((attempt + 1) * 2)
                        continue
                    resp.raise_for_status()
                    return resp.json()
                except Exception as e:
                    last_error = e
                    if attempt < max_attempts - 1:
                        await asyncio.sleep((attempt + 1) * 2)
                        continue
                    raise
        raise last_error

    def _ticket_url(self, sys_id: str, table: str = "incident") -> str:
        return f"{self.instance}/{table}.do?sys_id={sys_id}"

    async def create_incident(self, data: dict) -> dict:
        result = await self._request("POST", f"{self.base_url}/incident", json_data=data)
        record = result.get("result", {})
        sys_id = record.get("sys_id")
        if not sys_id:
            raise Exception("No sys_id in ServiceNow response")
        return {"sys_id": sys_id, "number": record.get("number", sys_id), "url": self._ticket_url(sys_id)}

    async def update_incident(self, sys_id: str, data: dict) -> dict:
        await self._request("PATCH", f"{self.base_url}/incident/{sys_id}", json_data=data)
        return {"updated": True, "sys_id": sys_id}

    async def close_incident(self, sys_id: str, close_notes: str) -> dict:
        await self.update_incident(sys_id, {
            "state": "7",
            "close_code": "Closed/Resolved by Caller",
            "close_notes": close_notes,
        })
        return {"closed": True, "sys_id": sys_id}

    async def get_incident(self, sys_id: str) -> dict:
        result = await self._request("GET", f"{self.base_url}/incident/{sys_id}")
        return result.get("result", {})

    async def search_incidents(self, query: str | None = None, limit: int = 10) -> list:
        params = {"sysparm_limit": str(limit)}
        if query:
            params["sysparm_query"] = query
        result = await self._request("GET", f"{self.base_url}/incident", params=params)
        return result.get("result", [])

    # ── RITM (Requested Items) ──────────────────────────────

    async def create_ritm(self, data: dict) -> dict:
        result = await self._request("POST", f"{self.base_url}/sc_req_item", json_data=data)
        record = result.get("result", {})
        sys_id = record.get("sys_id")
        if not sys_id:
            raise Exception("No sys_id in ServiceNow RITM response")
        return {
            "sys_id": sys_id,
            "number": record.get("number", sys_id),
            "url": self._ticket_url(sys_id, "sc_req_item"),
        }

    async def close_ritm(self, sys_id: str, close_notes: str) -> dict:
        await self._request("PATCH", f"{self.base_url}/sc_req_item/{sys_id}", json_data={
            "state": "3",
            "close_notes": close_notes,
        })
        return {"closed": True, "sys_id": sys_id}

    # ── HR / Employee Lookup ─────────────────────────────────

    BAND_LIMITS = {
        "Associate": {"band": "L1", "monthly_mobile_limit": 800},
        "Senior Associate": {"band": "L2", "monthly_mobile_limit": 1000},
        "Analyst": {"band": "L3", "monthly_mobile_limit": 1200},
        "Senior Analyst": {"band": "L4", "monthly_mobile_limit": 1500},
        "Lead": {"band": "L5", "monthly_mobile_limit": 2000},
        "Manager": {"band": "L6", "monthly_mobile_limit": 2500},
        "Senior Manager": {"band": "L7", "monthly_mobile_limit": 3000},
        "Director": {"band": "L8", "monthly_mobile_limit": 4000},
        "Vice President": {"band": "L9", "monthly_mobile_limit": 5000},
        "Senior Vice President": {"band": "L10", "monthly_mobile_limit": 6000},
    }

    async def get_user_record(self, params: dict) -> dict:
        """Query sys_user table by email to verify employment type."""
        email = params["employee_email"]
        result = await self._request(
            "GET",
            f"{self.base_url}/sys_user",
            params={"sysparm_query": f"email={email}", "sysparm_limit": "1"},
        )
        records = result.get("result", [])
        if not records:
            return {"found": False, "employee_email": email, "error": "Employee not found"}
        user = records[0]
        emp_type = user.get("u_employment_type") or user.get("employment_type") or "FTE"
        return {
            "found": True,
            "employee_email": email,
            "sys_id": user.get("sys_id"),
            "name": user.get("name", ""),
            "employment_type": emp_type,
            "active": user.get("active", "true") == "true",
            "department": user.get("department", {}).get("display_value", "") if isinstance(user.get("department"), dict) else user.get("department", ""),
            "title": user.get("title", ""),
        }

    async def get_hr_profile(self, params: dict) -> dict:
        """Fetch HR profile with designation, band, and reimbursement limit."""
        email = params["employee_email"]
        result = await self._request(
            "GET",
            f"{self.base_url}/sys_user",
            params={"sysparm_query": f"email={email}", "sysparm_limit": "1"},
        )
        records = result.get("result", [])
        if not records:
            return {"found": False, "employee_email": email, "error": "Employee not found"}
        user = records[0]
        title = user.get("title", "Associate")
        band_info = self.BAND_LIMITS.get(title, {"band": "L1", "monthly_mobile_limit": 800})
        return {
            "found": True,
            "employee_email": email,
            "name": user.get("name", ""),
            "designation": title,
            "band": band_info["band"],
            "department": user.get("department", {}).get("display_value", "") if isinstance(user.get("department"), dict) else user.get("department", ""),
            "monthly_mobile_limit": band_info["monthly_mobile_limit"],
        }
