"""Tests for action_executor Freshservice dispatch — RED phase."""

import httpx
import pytest
import respx

from services.action_executor import execute_action
from clients.client_factory import clear_client_cache


CREDS = {"domain": "acme.freshservice.com", "api_key": "secret123"}
BASE = "https://acme.freshservice.com/api/v2"


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_client_cache()
    yield
    clear_client_cache()


class TestActionExecutorFreshservice:
    async def test_create_ticket(self):
        with respx.mock:
            respx.post(f"{BASE}/tickets").mock(
                return_value=httpx.Response(201, json={"ticket": {"id": 1, "subject": "Test"}})
            )
            result = await execute_action(
                "freshservice", "create_ticket",
                {"subject": "Test", "description": "Desc", "email": "u@x.com", "priority": 2, "status": 2},
                CREDS,
            )
            assert result.success is True
            assert result.result["id"] == 1

    async def test_update_ticket(self):
        with respx.mock:
            respx.put(f"{BASE}/tickets/5").mock(
                return_value=httpx.Response(200, json={"ticket": {"id": 5, "status": 3}})
            )
            result = await execute_action(
                "freshservice", "update_ticket",
                {"ticket_id": 5, "status": 3},
                CREDS,
            )
            assert result.success is True
            assert result.result["updated"] is True

    async def test_get_ticket(self):
        with respx.mock:
            respx.get(f"{BASE}/tickets/5").mock(
                return_value=httpx.Response(200, json={"ticket": {"id": 5, "subject": "VPN"}})
            )
            result = await execute_action(
                "freshservice", "get_ticket",
                {"ticket_id": 5},
                CREDS,
            )
            assert result.success is True
            assert result.result["id"] == 5

    async def test_list_tickets(self):
        with respx.mock:
            respx.get(f"{BASE}/tickets").mock(
                return_value=httpx.Response(200, json={"tickets": [{"id": 1}]})
            )
            result = await execute_action(
                "freshservice", "list_tickets", {}, CREDS,
            )
            assert result.success is True
            assert len(result.result) == 1

    async def test_close_ticket(self):
        with respx.mock:
            respx.put(f"{BASE}/tickets/10").mock(
                return_value=httpx.Response(200, json={"ticket": {"id": 10, "status": 5}})
            )
            result = await execute_action(
                "freshservice", "close_ticket",
                {"ticket_id": 10},
                CREDS,
            )
            assert result.success is True
            assert result.result["closed"] is True

    async def test_create_service_request(self):
        with respx.mock:
            respx.post(f"{BASE}/service_catalog/items/7/place_request").mock(
                return_value=httpx.Response(200, json={"service_request": {"id": 99, "subject": "Laptop"}})
            )
            result = await execute_action(
                "freshservice", "create_service_request",
                {"catalog_item_id": 7, "email": "u@x.com"},
                CREDS,
            )
            assert result.success is True
            assert result.result["id"] == 99

    async def test_add_ticket_note(self):
        with respx.mock:
            respx.post(f"{BASE}/tickets/1/notes").mock(
                return_value=httpx.Response(201, json={"conversation": {"id": 50, "body": "note"}})
            )
            result = await execute_action(
                "freshservice", "add_ticket_note",
                {"ticket_id": 1, "body": "note"},
                CREDS,
            )
            assert result.success is True
            assert result.result["id"] == 50

    async def test_unknown_action_returns_failure(self):
        result = await execute_action(
            "freshservice", "nonexistent_action", {}, CREDS,
        )
        assert result.success is False
        assert "Unknown" in result.error

    async def test_missing_credentials_returns_failure(self):
        result = await execute_action(
            "freshservice", "create_ticket",
            {"subject": "Test", "description": "Desc", "email": "u@x.com", "priority": 2, "status": 2},
            {"domain": "acme.freshservice.com"},  # missing api_key
        )
        assert result.success is False
