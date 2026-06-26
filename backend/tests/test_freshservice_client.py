"""Tests for FreshserviceClient — written BEFORE implementation (TDD RED phase)."""

import base64
import httpx
import pytest
import respx


# ── Constructor tests ───────────────────────────────────────────────────


class TestConstructor:
    def test_base_url_format(self, fs_client):
        assert fs_client.base_url == "https://testcorp.freshservice.com/api/v2"

    def test_auth_header_basic_base64(self, fs_client):
        expected = base64.b64encode(b"test-api-key-123:X").decode()
        assert fs_client.headers["Authorization"] == f"Basic {expected}"

    def test_content_type_json(self, fs_client):
        assert fs_client.headers["Content-Type"] == "application/json"

    def test_trailing_slash_stripped(self):
        from clients.freshservice import FreshserviceClient
        c = FreshserviceClient("testcorp.freshservice.com/", "key")
        assert not c.base_url.endswith("/")

    def test_empty_domain_raises(self):
        from clients.freshservice import FreshserviceClient
        with pytest.raises(ValueError, match="domain"):
            FreshserviceClient("", "key")

    def test_empty_api_key_raises(self):
        from clients.freshservice import FreshserviceClient
        with pytest.raises(ValueError, match="api_key"):
            FreshserviceClient("corp.freshservice.com", "")


# ── _ticket_url ─────────────────────────────────────────────────────────


class TestTicketUrl:
    def test_returns_browser_url(self, fs_client):
        url = fs_client._ticket_url(42)
        assert url == "https://testcorp.freshservice.com/a/tickets/42"


# ── _request retry logic ────────────────────────────────────────────────


class TestRequestRetry:
    @pytest.mark.parametrize("status_code", [429, 500, 502, 503, 504])
    async def test_retries_on_retryable_status(self, fs_client, mock_api, status_code):
        route = mock_api.get("https://testcorp.freshservice.com/api/v2/test")
        route.side_effect = [
            httpx.Response(status_code),
            httpx.Response(200, json={"ok": True}),
        ]
        result = await fs_client._request("GET", f"{fs_client.base_url}/test", max_attempts=2)
        assert result == {"ok": True}

    async def test_raises_after_max_retries(self, fs_client, mock_api):
        mock_api.get("https://testcorp.freshservice.com/api/v2/test").mock(
            return_value=httpx.Response(500)
        )
        with pytest.raises(httpx.HTTPStatusError):
            await fs_client._request("GET", f"{fs_client.base_url}/test", max_attempts=2)

    async def test_respects_retry_after_header(self, fs_client, mock_api):
        route = mock_api.get("https://testcorp.freshservice.com/api/v2/test")
        route.side_effect = [
            httpx.Response(429, headers={"Retry-After": "0"}),
            httpx.Response(200, json={"ok": True}),
        ]
        result = await fs_client._request("GET", f"{fs_client.base_url}/test", max_attempts=2)
        assert result == {"ok": True}

    async def test_raises_immediately_on_401(self, fs_client, mock_api):
        mock_api.get("https://testcorp.freshservice.com/api/v2/test").mock(
            return_value=httpx.Response(401)
        )
        with pytest.raises(httpx.HTTPStatusError):
            await fs_client._request("GET", f"{fs_client.base_url}/test", max_attempts=3)

    async def test_raises_immediately_on_404(self, fs_client, mock_api):
        mock_api.get("https://testcorp.freshservice.com/api/v2/test").mock(
            return_value=httpx.Response(404)
        )
        with pytest.raises(httpx.HTTPStatusError):
            await fs_client._request("GET", f"{fs_client.base_url}/test", max_attempts=3)

    async def test_no_retry_on_400(self, fs_client, mock_api):
        mock_api.get("https://testcorp.freshservice.com/api/v2/test").mock(
            return_value=httpx.Response(400)
        )
        with pytest.raises(httpx.HTTPStatusError):
            await fs_client._request("GET", f"{fs_client.base_url}/test", max_attempts=3)


# ── create_ticket ────────────────────────────────────────────────────────


class TestCreateTicket:
    async def test_sends_post_returns_id_subject_url(self, fs_client, mock_api):
        mock_api.post("https://testcorp.freshservice.com/api/v2/tickets").mock(
            return_value=httpx.Response(201, json={
                "ticket": {"id": 1, "subject": "Laptop issue"}
            })
        )
        result = await fs_client.create_ticket({
            "subject": "Laptop issue",
            "description": "Screen flickering",
            "email": "user@example.com",
            "priority": 2,
            "status": 2,
        })
        assert result["id"] == 1
        assert result["subject"] == "Laptop issue"
        assert "url" in result


# ── update_ticket ────────────────────────────────────────────────────────


class TestUpdateTicket:
    async def test_sends_put_returns_updated(self, fs_client, mock_api):
        mock_api.put("https://testcorp.freshservice.com/api/v2/tickets/1").mock(
            return_value=httpx.Response(200, json={
                "ticket": {"id": 1, "status": 3}
            })
        )
        result = await fs_client.update_ticket(1, {"status": 3})
        assert result["updated"] is True
        assert result["id"] == 1


# ── get_ticket ───────────────────────────────────────────────────────────


class TestGetTicket:
    async def test_sends_get_returns_ticket(self, fs_client, mock_api):
        mock_api.get("https://testcorp.freshservice.com/api/v2/tickets/42").mock(
            return_value=httpx.Response(200, json={
                "ticket": {"id": 42, "subject": "VPN issue", "status": 2}
            })
        )
        result = await fs_client.get_ticket(42)
        assert result["id"] == 42
        assert result["subject"] == "VPN issue"


# ── list_tickets ─────────────────────────────────────────────────────────


class TestListTickets:
    async def test_basic_list(self, fs_client, mock_api):
        mock_api.get("https://testcorp.freshservice.com/api/v2/tickets").mock(
            return_value=httpx.Response(200, json={
                "tickets": [{"id": 1}, {"id": 2}]
            })
        )
        result = await fs_client.list_tickets({})
        assert len(result) == 2

    async def test_with_filter_uses_filter_endpoint(self, fs_client, mock_api):
        mock_api.get("https://testcorp.freshservice.com/api/v2/tickets/filter").mock(
            return_value=httpx.Response(200, json={
                "tickets": [{"id": 5}]
            })
        )
        result = await fs_client.list_tickets({"filter": '"priority:3 AND status:2"'})
        assert len(result) == 1

    async def test_pagination_params(self, fs_client, mock_api):
        route = mock_api.get("https://testcorp.freshservice.com/api/v2/tickets")
        route.mock(return_value=httpx.Response(200, json={"tickets": []}))
        await fs_client.list_tickets({"per_page": 50, "page": 2})
        request = route.calls[0].request
        assert "per_page=50" in str(request.url)
        assert "page=2" in str(request.url)


# ── close_ticket ─────────────────────────────────────────────────────────


class TestCloseTicket:
    async def test_sets_status_5(self, fs_client, mock_api):
        route = mock_api.put("https://testcorp.freshservice.com/api/v2/tickets/10")
        route.mock(return_value=httpx.Response(200, json={"ticket": {"id": 10, "status": 5}}))
        result = await fs_client.close_ticket(10)
        assert result["closed"] is True
        assert result["id"] == 10

    async def test_close_with_note(self, fs_client, mock_api):
        mock_api.put("https://testcorp.freshservice.com/api/v2/tickets/10").mock(
            return_value=httpx.Response(200, json={"ticket": {"id": 10, "status": 5}})
        )
        mock_api.post("https://testcorp.freshservice.com/api/v2/tickets/10/notes").mock(
            return_value=httpx.Response(201, json={"conversation": {"id": 99}})
        )
        result = await fs_client.close_ticket(10, close_notes="Fixed the issue")
        assert result["closed"] is True


# ── create_service_request ───────────────────────────────────────────────


class TestCreateServiceRequest:
    async def test_posts_to_catalog(self, fs_client, mock_api):
        mock_api.post(
            "https://testcorp.freshservice.com/api/v2/service_catalog/items/5/place_request"
        ).mock(
            return_value=httpx.Response(200, json={
                "service_request": {"id": 77, "subject": "New laptop"}
            })
        )
        result = await fs_client.create_service_request(5, {
            "email": "user@example.com",
            "quantity": 1,
        })
        assert result["id"] == 77


# ── add_ticket_note ──────────────────────────────────────────────────────


class TestAddTicketNote:
    async def test_posts_note_private_default(self, fs_client, mock_api):
        route = mock_api.post("https://testcorp.freshservice.com/api/v2/tickets/1/notes")
        route.mock(return_value=httpx.Response(201, json={
            "conversation": {"id": 55, "body": "Internal note"}
        }))
        result = await fs_client.add_ticket_note(1, "Internal note")
        assert result["id"] == 55
        # Check that private=True was sent in body
        import json
        body = json.loads(route.calls[0].request.content)
        assert body["private"] is True

    async def test_public_note(self, fs_client, mock_api):
        route = mock_api.post("https://testcorp.freshservice.com/api/v2/tickets/1/notes")
        route.mock(return_value=httpx.Response(201, json={
            "conversation": {"id": 56, "body": "Public note"}
        }))
        result = await fs_client.add_ticket_note(1, "Public note", private=False)
        import json
        body = json.loads(route.calls[0].request.content)
        assert body["private"] is False
