import {
  EC2Client,
  DescribeInstancesCommand,
  RunInstancesCommand,
  StopInstancesCommand,
  TerminateInstancesCommand,
} from '@aws-sdk/client-ec2'
import {
  S3Client,
  ListBucketsCommand,
  CreateBucketCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'

export class AWSClient {
  private ec2: EC2Client
  private s3: S3Client
  private region: string

  constructor(accessKeyId: string, secretAccessKey: string, region = 'us-east-1') {
    const credentials = { accessKeyId, secretAccessKey }
    this.region = region
    this.ec2 = new EC2Client({ region, credentials })
    this.s3 = new S3Client({ region, credentials })
  }

  // EC2 Methods
  async describeInstances(instanceIds?: string[], filters?: any[]) {
    const params: any = {}
    if (instanceIds?.length) params.InstanceIds = instanceIds
    if (filters?.length) params.Filters = filters

    const result = await this.ec2.send(new DescribeInstancesCommand(params))
    const instances = (result.Reservations || []).flatMap((r) =>
      (r.Instances || []).map((i) => ({
        instance_id: i.InstanceId,
        state: i.State?.Name,
        instance_type: i.InstanceType,
        public_ip: i.PublicIpAddress || null,
        private_ip: i.PrivateIpAddress || null,
        launch_time: i.LaunchTime?.toISOString(),
        tags: Object.fromEntries((i.Tags || []).map((t) => [t.Key, t.Value])),
      })),
    )
    return instances
  }

  async createInstance(params: {
    instance_type: string
    ami_id: string
    key_name?: string
    security_group_ids?: string[]
    subnet_id?: string
    tags?: Record<string, string>
  }) {
    const input: any = {
      ImageId: params.ami_id,
      InstanceType: params.instance_type,
      MinCount: 1,
      MaxCount: 1,
    }
    if (params.key_name) input.KeyName = params.key_name
    if (params.security_group_ids) input.SecurityGroupIds = params.security_group_ids
    if (params.subnet_id) input.SubnetId = params.subnet_id
    if (params.tags) {
      input.TagSpecifications = [
        {
          ResourceType: 'instance',
          Tags: Object.entries(params.tags).map(([Key, Value]) => ({ Key, Value })),
        },
      ]
    }

    const result = await this.ec2.send(new RunInstancesCommand(input))
    const instance = result.Instances?.[0]
    return {
      instance_id: instance?.InstanceId,
      state: instance?.State?.Name,
      instance_type: instance?.InstanceType,
    }
  }

  async stopInstance(instanceId: string) {
    const result = await this.ec2.send(
      new StopInstancesCommand({ InstanceIds: [instanceId] }),
    )
    const change = result.StoppingInstances?.[0]
    return {
      instance_id: change?.InstanceId,
      previous_state: change?.PreviousState?.Name,
      current_state: change?.CurrentState?.Name,
    }
  }

  async terminateInstance(instanceId: string) {
    const result = await this.ec2.send(
      new TerminateInstancesCommand({ InstanceIds: [instanceId] }),
    )
    const change = result.TerminatingInstances?.[0]
    return {
      instance_id: change?.InstanceId,
      previous_state: change?.PreviousState?.Name,
      current_state: change?.CurrentState?.Name,
    }
  }

  // S3 Methods
  async listBuckets() {
    const result = await this.s3.send(new ListBucketsCommand({}))
    return (result.Buckets || []).map((b) => ({
      name: b.Name,
      creation_date: b.CreationDate?.toISOString(),
    }))
  }

  async createBucket(bucketName: string, region?: string) {
    const input: any = { Bucket: bucketName }
    const effectiveRegion = region || this.region
    if (effectiveRegion !== 'us-east-1') {
      input.CreateBucketConfiguration = { LocationConstraint: effectiveRegion }
    }

    await this.s3.send(new CreateBucketCommand(input))
    return { bucket_name: bucketName, region: effectiveRegion, created: true }
  }

  async putObject(bucketName: string, key: string, body: string, contentType?: string) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: contentType || 'text/plain',
      }),
    )
    return { bucket_name: bucketName, key, uploaded: true }
  }
}
