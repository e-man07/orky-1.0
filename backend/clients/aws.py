import asyncio
import re
import boto3


class AWSClient:
    def __init__(self, access_key_id: str, secret_access_key: str, region: str = "us-east-1"):
        self.region = region
        self.ec2 = boto3.client(
            "ec2",
            region_name=region,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
        )
        self.s3 = boto3.client(
            "s3",
            region_name=region,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
        )
        self.textract = boto3.client(
            "textract",
            region_name=region,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
        )

    # EC2 Methods
    async def describe_instances(self, instance_ids: list[str] | None = None, filters: list | None = None) -> list[dict]:
        params: dict = {}
        if instance_ids:
            params["InstanceIds"] = instance_ids
        if filters:
            params["Filters"] = filters

        result = await asyncio.to_thread(self.ec2.describe_instances, **params)
        instances = []
        for reservation in result.get("Reservations", []):
            for i in reservation.get("Instances", []):
                instances.append({
                    "instance_id": i.get("InstanceId"),
                    "state": i.get("State", {}).get("Name"),
                    "instance_type": i.get("InstanceType"),
                    "public_ip": i.get("PublicIpAddress"),
                    "private_ip": i.get("PrivateIpAddress"),
                    "launch_time": i.get("LaunchTime", "").isoformat() if i.get("LaunchTime") else None,
                    "tags": {t["Key"]: t["Value"] for t in i.get("Tags", [])},
                })
        return instances

    async def create_instance(self, params: dict) -> dict:
        input_params: dict = {
            "ImageId": params["ami_id"],
            "InstanceType": params["instance_type"],
            "MinCount": 1,
            "MaxCount": 1,
        }
        if params.get("key_name"):
            input_params["KeyName"] = params["key_name"]
        if params.get("security_group_ids"):
            input_params["SecurityGroupIds"] = params["security_group_ids"]
        if params.get("subnet_id"):
            input_params["SubnetId"] = params["subnet_id"]
        if params.get("tags"):
            input_params["TagSpecifications"] = [{
                "ResourceType": "instance",
                "Tags": [{"Key": k, "Value": v} for k, v in params["tags"].items()],
            }]

        result = await asyncio.to_thread(self.ec2.run_instances, **input_params)
        instance = result.get("Instances", [{}])[0]
        return {
            "instance_id": instance.get("InstanceId"),
            "state": instance.get("State", {}).get("Name"),
            "instance_type": instance.get("InstanceType"),
        }

    async def stop_instance(self, instance_id: str) -> dict:
        result = await asyncio.to_thread(self.ec2.stop_instances, InstanceIds=[instance_id])
        change = result.get("StoppingInstances", [{}])[0]
        return {
            "instance_id": change.get("InstanceId"),
            "previous_state": change.get("PreviousState", {}).get("Name"),
            "current_state": change.get("CurrentState", {}).get("Name"),
        }

    async def terminate_instance(self, instance_id: str) -> dict:
        result = await asyncio.to_thread(self.ec2.terminate_instances, InstanceIds=[instance_id])
        change = result.get("TerminatingInstances", [{}])[0]
        return {
            "instance_id": change.get("InstanceId"),
            "previous_state": change.get("PreviousState", {}).get("Name"),
            "current_state": change.get("CurrentState", {}).get("Name"),
        }

    # S3 Methods
    async def list_buckets(self) -> list[dict]:
        result = await asyncio.to_thread(self.s3.list_buckets)
        return [
            {"name": b.get("Name"), "creation_date": b.get("CreationDate", "").isoformat() if b.get("CreationDate") else None}
            for b in result.get("Buckets", [])
        ]

    async def create_bucket(self, bucket_name: str, region: str | None = None) -> dict:
        effective_region = region or self.region
        params: dict = {"Bucket": bucket_name}
        if effective_region != "us-east-1":
            params["CreateBucketConfiguration"] = {"LocationConstraint": effective_region}
        await asyncio.to_thread(self.s3.create_bucket, **params)
        return {"bucket_name": bucket_name, "region": effective_region, "created": True}

    async def put_object(self, bucket_name: str, key: str, body: str, content_type: str | None = None) -> dict:
        await asyncio.to_thread(
            self.s3.put_object,
            Bucket=bucket_name,
            Key=key,
            Body=body,
            ContentType=content_type or "text/plain",
        )
        return {"bucket_name": bucket_name, "key": key, "uploaded": True}

    # Textract Methods
    async def extract_invoice(self, params: dict) -> dict:
        """Use Textract AnalyzeExpense to extract structured invoice data."""
        result = await asyncio.to_thread(
            self.textract.analyze_expense,
            Document={"S3Object": {"Bucket": params["s3_bucket"], "Name": params["s3_key"]}},
        )
        extracted = {
            "vendor_name": None,
            "gstin": None,
            "invoice_number": None,
            "invoice_date": None,
            "subtotal": None,
            "tax_amount": None,
            "total": None,
            "line_items": [],
            "tax_breakup": {"cgst": None, "sgst": None, "igst": None},
        }
        for doc in result.get("ExpenseDocuments", []):
            for field in doc.get("SummaryFields", []):
                field_type = field.get("Type", {}).get("Text", "").upper()
                value = field.get("ValueDetection", {}).get("Text", "")
                if field_type == "VENDOR_NAME":
                    extracted["vendor_name"] = value
                elif field_type == "INVOICE_RECEIPT_ID":
                    extracted["invoice_number"] = value
                elif field_type == "INVOICE_RECEIPT_DATE":
                    extracted["invoice_date"] = value
                elif field_type == "SUBTOTAL":
                    extracted["subtotal"] = value
                elif field_type == "TAX":
                    extracted["tax_amount"] = value
                elif field_type == "TOTAL":
                    extracted["total"] = value
                elif "GSTIN" in field_type or "GST" in field_type:
                    extracted["gstin"] = value
            for group in doc.get("LineItemGroups", []):
                for item in group.get("LineItems", []):
                    line = {}
                    for expense_field in item.get("LineItemExpenseFields", []):
                        ft = expense_field.get("Type", {}).get("Text", "")
                        fv = expense_field.get("ValueDetection", {}).get("Text", "")
                        line[ft] = fv
                    extracted["line_items"].append(line)
        return extracted

    async def validate_invoice(self, params: dict) -> dict:
        """Validate extracted invoice data against employee details."""
        invoice_data = params["invoice_data"]
        employee_name = params["employee_name"]
        billing_period = params.get("expected_billing_period")
        issues = []

        # Name match (fuzzy)
        inv_name = (invoice_data.get("vendor_name") or "").lower()
        emp_name = employee_name.lower()
        if emp_name and inv_name:
            emp_parts = emp_name.split()
            matches = sum(1 for part in emp_parts if part in inv_name)
            if matches < len(emp_parts) * 0.5:
                issues.append(f"Name mismatch: invoice has '{invoice_data.get('vendor_name')}', expected '{employee_name}'")

        # GSTIN format
        gstin = invoice_data.get("gstin") or ""
        gstin_pattern = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
        if gstin and not re.match(gstin_pattern, gstin):
            issues.append(f"Invalid GSTIN format: {gstin}")

        # Tax math check
        try:
            subtotal = float(invoice_data.get("subtotal") or 0)
            tax = float(invoice_data.get("tax_amount") or 0)
            total = float(invoice_data.get("total") or 0)
            if subtotal > 0 and total > 0:
                expected_total = subtotal + tax
                if abs(expected_total - total) > 1.0:
                    issues.append(f"Tax math error: subtotal({subtotal}) + tax({tax}) = {expected_total}, but total is {total}")
        except (ValueError, TypeError):
            issues.append("Could not parse numeric amounts for validation")

        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "invoice_data": invoice_data,
        }

    async def detect_document_text(self, params: dict) -> dict:
        """Use Textract to detect and extract raw text from a document."""
        result = await asyncio.to_thread(
            self.textract.detect_document_text,
            Document={"S3Object": {"Bucket": params["s3_bucket"], "Name": params["s3_key"]}},
        )
        blocks = []
        full_text = []
        for block in result.get("Blocks", []):
            if block.get("BlockType") == "LINE":
                text = block.get("Text", "")
                confidence = block.get("Confidence", 0)
                blocks.append({"text": text, "confidence": confidence})
                full_text.append(text)
        return {
            "full_text": "\n".join(full_text),
            "blocks": blocks,
            "total_blocks": len(blocks),
        }
