import json
from typing import Any
from clients.servicenow import ServiceNowClient
from clients.jira import JiraClient
from clients.slack import SlackClient
from clients.aws import AWSClient
from clients.sharepoint import SharePointClient
from clients.snowflake_client import SnowflakeClient
from clients.salesforce import SalesforceClient
from clients.sap import SAPClient
from clients.azure import AzureClient
from clients.workday import WorkdayClient
from clients.o365 import O365Client
from clients.whatsapp import WhatsAppClient
from clients.confluence import ConfluenceClient
from clients.freshworks import FreshWorksClient
from clients.docusign import DocuSignClient
from clients.adp import ADPClient
from clients.tinyfish import TinyfishClient

_client_cache: dict[str, Any] = {}


def get_client(app_slug: str, credentials: dict[str, Any]) -> Any:
    cache_key = f"{app_slug}:{json.dumps(credentials, sort_keys=True)}"
    cached = _client_cache.get(cache_key)
    if cached:
        return cached

    client: Any

    if app_slug == "salesforce":
        client = SalesforceClient(
            credentials["instance_url"],
            credentials["access_token"],
        )
    elif app_slug == "sap":
        client = SAPClient(
            credentials["base_url"],
            credentials["username"],
            credentials["password"],
        )
    elif app_slug == "servicenow":
        client = ServiceNowClient(
            credentials["instance_url"],
            credentials["username"],
            credentials["password"],
        )
    elif app_slug == "aws":
        client = AWSClient(
            credentials["access_key_id"],
            credentials["secret_access_key"],
            credentials.get("region", "us-east-1"),
        )
    elif app_slug == "azure":
        client = AzureClient(
            credentials["tenant_id"],
            credentials["client_id"],
            credentials["client_secret"],
            credentials["subscription_id"],
        )
    elif app_slug == "workday":
        client = WorkdayClient(
            credentials["base_url"],
            credentials["tenant"],
            credentials["username"],
            credentials["password"],
        )
    elif app_slug == "snowflake":
        client = SnowflakeClient(
            account=credentials["account"],
            username=credentials["username"],
            password=credentials["password"],
            warehouse=credentials["warehouse"],
            database=credentials["database"],
            schema=credentials["schema"],
        )
    elif app_slug == "o365":
        client = O365Client(
            credentials["tenant_id"],
            credentials["client_id"],
            credentials["client_secret"],
        )
    elif app_slug == "slack":
        client = SlackClient(
            credentials["bot_token"],
            credentials.get("default_channel"),
        )
    elif app_slug == "whatsapp":
        client = WhatsAppClient(
            credentials["phone_number_id"],
            credentials["access_token"],
        )
    elif app_slug == "sharepoint":
        client = SharePointClient(
            credentials["tenant_id"],
            credentials["client_id"],
            credentials["client_secret"],
            credentials.get("site_url"),
        )
    elif app_slug == "confluence":
        client = ConfluenceClient(
            credentials["base_url"],
            credentials["email"],
            credentials["api_token"],
        )
    elif app_slug == "jira":
        client = JiraClient(
            credentials["base_url"],
            credentials["email"],
            credentials["api_token"],
        )
    elif app_slug == "freshworks":
        client = FreshWorksClient(
            credentials["domain"],
            credentials["api_key"],
        )
    elif app_slug == "docusign":
        client = DocuSignClient(
            credentials["base_url"],
            credentials["account_id"],
            credentials["access_token"],
        )
    elif app_slug == "adp":
        client = ADPClient(
            credentials["base_url"],
            credentials["client_id"],
            credentials["client_secret"],
        )
    elif app_slug == "tinyfish":
        client = TinyfishClient(
            credentials["api_key"],
        )
    # Legacy split AWS slugs — redirect to unified client
    elif app_slug in ("aws_ec2", "aws_s3"):
        client = AWSClient(
            credentials["access_key_id"],
            credentials["secret_access_key"],
            credentials.get("region", "us-east-1"),
        )
    else:
        raise ValueError(f"Unknown app: {app_slug}")

    _client_cache[cache_key] = client
    return client


def clear_client_cache():
    _client_cache.clear()
