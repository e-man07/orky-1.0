from typing import Any
from clients.client_factory import get_client


class ActionResult:
    def __init__(self, success: bool, result: Any = None, error: str | None = None):
        self.success = success
        self.result = result
        self.error = error


async def execute_action(
    app_slug: str,
    action_name: str,
    params: dict[str, Any],
    credentials: dict[str, Any],
) -> ActionResult:
    """Route an action to the appropriate external client and execute it."""
    try:
        client = get_client(app_slug, credentials)
        result: Any = None

        # ── Salesforce ────────────────────────────────────────
        if app_slug == "salesforce":
            if action_name == "create_lead":
                result = await client.create_lead(params)
            elif action_name == "create_case":
                result = await client.create_case(params)
            elif action_name == "update_opportunity":
                result = await client.update_opportunity(params)
            elif action_name == "soql_query":
                result = await client.soql_query(params)
            else:
                raise ValueError(f"Unknown Salesforce action: {action_name}")

        # ── SAP ───────────────────────────────────────────────
        elif app_slug == "sap":
            if action_name == "create_purchase_order":
                result = await client.create_purchase_order(params)
            elif action_name == "get_material_stock":
                result = await client.get_material_stock(params)
            elif action_name == "post_financial_document":
                result = await client.post_financial_document(params)
            else:
                raise ValueError(f"Unknown SAP action: {action_name}")

        # ── ServiceNow ────────────────────────────────────────
        elif app_slug == "servicenow":
            if action_name == "create_incident":
                result = await client.create_incident(params)
            elif action_name == "update_incident":
                result = await client.update_incident(params["sys_id"], params)
            elif action_name == "close_incident":
                result = await client.close_incident(params["sys_id"], params["close_notes"])
            elif action_name == "get_incident":
                result = await client.get_incident(params["sys_id"])
            elif action_name == "search_incidents":
                result = await client.search_incidents(params.get("query"), params.get("limit", 10))
            else:
                raise ValueError(f"Unknown ServiceNow action: {action_name}")

        # ── AWS (unified: EC2 + S3) ──────────────────────────
        elif app_slug in ("aws", "aws_ec2", "aws_s3"):
            if action_name == "describe_instances":
                result = await client.describe_instances(params.get("instance_ids"), params.get("filters"))
            elif action_name == "create_instance":
                result = await client.create_instance(params)
            elif action_name == "stop_instance":
                result = await client.stop_instance(params["instance_id"])
            elif action_name == "terminate_instance":
                result = await client.terminate_instance(params["instance_id"])
            elif action_name in ("list_s3_buckets", "list_buckets"):
                result = await client.list_buckets()
            elif action_name in ("put_s3_object", "put_object"):
                result = await client.put_object(params["bucket_name"], params["key"], params["body"], params.get("content_type"))
            elif action_name == "create_bucket":
                result = await client.create_bucket(params["bucket_name"], params.get("region"))
            else:
                raise ValueError(f"Unknown AWS action: {action_name}")

        # ── Azure ─────────────────────────────────────────────
        elif app_slug == "azure":
            if action_name == "list_vms":
                result = await client.list_vms(params)
            elif action_name == "create_vm":
                result = await client.create_vm(params)
            elif action_name == "run_query":
                result = await client.run_query(params)
            else:
                raise ValueError(f"Unknown Azure action: {action_name}")

        # ── Workday ───────────────────────────────────────────
        elif app_slug == "workday":
            if action_name == "get_worker":
                result = await client.get_worker(params)
            elif action_name == "create_position":
                result = await client.create_position(params)
            elif action_name == "submit_time_off":
                result = await client.submit_time_off(params)
            else:
                raise ValueError(f"Unknown Workday action: {action_name}")

        # ── Snowflake ─────────────────────────────────────────
        elif app_slug == "snowflake":
            if action_name == "execute_query":
                result = await client.execute_query(params["query"], params.get("binds"))
            elif action_name == "describe_table":
                result = await client.describe_table(params["table_name"])
            else:
                raise ValueError(f"Unknown Snowflake action: {action_name}")

        # ── Office 365 ────────────────────────────────────────
        elif app_slug == "o365":
            if action_name == "send_email":
                result = await client.send_email(params)
            elif action_name == "create_event":
                result = await client.create_event(params)
            elif action_name == "search_emails":
                result = await client.search_emails(params)
            else:
                raise ValueError(f"Unknown Office 365 action: {action_name}")

        # ── Slack ─────────────────────────────────────────────
        elif app_slug == "slack":
            if action_name == "send_message":
                result = await client.send_message(params["text"], params.get("channel"))
            elif action_name == "send_approval_request":
                result = await client.send_approval_request(params)
            elif action_name == "update_message":
                result = await client.update_message(params["channel"], params["message_ts"], params["text"])
            else:
                raise ValueError(f"Unknown Slack action: {action_name}")

        # ── WhatsApp ──────────────────────────────────────────
        elif app_slug == "whatsapp":
            if action_name == "send_message":
                result = await client.send_message(params)
            elif action_name == "send_template":
                result = await client.send_template(params)
            else:
                raise ValueError(f"Unknown WhatsApp action: {action_name}")

        # ── SharePoint ────────────────────────────────────────
        elif app_slug == "sharepoint":
            if action_name == "list_files":
                result = await client.list_files(params.get("site_url"), params.get("folder_path"))
            elif action_name == "upload_file":
                result = await client.upload_file(params["file_name"], params["file_content"], params.get("site_url"), params.get("folder_path"))
            elif action_name == "search_files":
                result = await client.search_files(params["query"], params.get("site_url"), params.get("limit", 25))
            else:
                raise ValueError(f"Unknown SharePoint action: {action_name}")

        # ── Confluence ────────────────────────────────────────
        elif app_slug == "confluence":
            if action_name == "create_page":
                result = await client.create_page(params)
            elif action_name == "update_page":
                result = await client.update_page(params)
            elif action_name == "search_content":
                result = await client.search_content(params)
            else:
                raise ValueError(f"Unknown Confluence action: {action_name}")

        # ── Jira ──────────────────────────────────────────────
        elif app_slug == "jira":
            if action_name == "create_issue":
                result = await client.create_issue(params)
            elif action_name == "update_issue":
                result = await client.update_issue(params["issue_key"], params)
            elif action_name == "transition_issue":
                result = await client.transition_issue(params["issue_key"], params["transition_id"], params.get("comment"))
            elif action_name == "add_comment":
                result = await client.add_comment(params["issue_key"], params["comment"])
            elif action_name == "search_issues":
                result = await client.search_issues(params["jql"], params.get("max_results", 50))
            else:
                raise ValueError(f"Unknown Jira action: {action_name}")

        # ── FreshWorks ────────────────────────────────────────
        elif app_slug == "freshworks":
            if action_name == "create_ticket":
                result = await client.create_ticket(params)
            elif action_name == "update_ticket":
                result = await client.update_ticket(params)
            elif action_name == "list_tickets":
                result = await client.list_tickets(params)
            else:
                raise ValueError(f"Unknown FreshWorks action: {action_name}")

        # ── DocuSign ──────────────────────────────────────────
        elif app_slug == "docusign":
            if action_name == "send_envelope":
                result = await client.send_envelope(params)
            elif action_name == "get_envelope_status":
                result = await client.get_envelope_status(params)
            else:
                raise ValueError(f"Unknown DocuSign action: {action_name}")

        # ── ADP ───────────────────────────────────────────────
        elif app_slug == "adp":
            if action_name == "get_worker_details":
                result = await client.get_worker_details(params)
            elif action_name == "get_payroll_summary":
                result = await client.get_payroll_summary(params)
            else:
                raise ValueError(f"Unknown ADP action: {action_name}")

        else:
            raise ValueError(f"Unknown app: {app_slug}")

        return ActionResult(success=True, result=result)

    except Exception as e:
        return ActionResult(success=False, error=str(e))
