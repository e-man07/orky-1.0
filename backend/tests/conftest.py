import pytest
import respx


@pytest.fixture
def base_url():
    return "https://testcorp.freshservice.com/api/v2"


@pytest.fixture
def fs_client():
    from clients.freshservice import FreshserviceClient
    return FreshserviceClient("testcorp.freshservice.com", "test-api-key-123")


@pytest.fixture
def mock_api():
    with respx.mock(assert_all_called=False) as respx_mock:
        yield respx_mock
