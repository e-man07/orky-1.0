"""Tests for client_factory Freshservice support — RED phase."""

import pytest
from clients.client_factory import get_client, clear_client_cache


CREDS = {"domain": "acme.freshservice.com", "api_key": "secret123"}


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_client_cache()
    yield
    clear_client_cache()


class TestClientFactoryFreshservice:
    def test_returns_freshservice_client(self):
        from clients.freshservice import FreshserviceClient
        client = get_client("freshservice", CREDS)
        assert isinstance(client, FreshserviceClient)

    def test_passes_domain_correctly(self):
        client = get_client("freshservice", CREDS)
        assert "acme.freshservice.com" in client.base_url

    def test_passes_api_key_correctly(self):
        import base64
        client = get_client("freshservice", CREDS)
        expected = base64.b64encode(b"secret123:X").decode()
        assert f"Basic {expected}" == client.headers["Authorization"]

    def test_caches_by_credentials(self):
        c1 = get_client("freshservice", CREDS)
        c2 = get_client("freshservice", CREDS)
        assert c1 is c2

    def test_different_creds_different_instance(self):
        c1 = get_client("freshservice", CREDS)
        c2 = get_client("freshservice", {"domain": "other.freshservice.com", "api_key": "other"})
        assert c1 is not c2

    def test_missing_domain_raises(self):
        with pytest.raises(KeyError):
            get_client("freshservice", {"api_key": "key"})

    def test_missing_api_key_raises(self):
        with pytest.raises(KeyError):
            get_client("freshservice", {"domain": "x.freshservice.com"})
