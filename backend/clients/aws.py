import asyncio
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
