import httpx


class SlackClient:
    BASE_URL = "https://slack.com/api"

    def __init__(self, bot_token: str, default_channel: str | None = None):
        if not bot_token:
            raise ValueError("Slack bot_token is required")
        self.bot_token = bot_token
        self.default_channel = default_channel
        self.headers = {
            "Authorization": f"Bearer {bot_token}",
            "Content-Type": "application/json",
        }

    async def send_message(self, text: str, channel: str | None = None, blocks: list | None = None) -> dict:
        # If the channel doesn't look like a Slack channel ID (starts with C/G/D),
        # fall back to the configured default channel ID to avoid channel_not_found errors.
        if channel and not channel.startswith(("C", "G", "D")):
            channel = self.default_channel
        channel = channel or self.default_channel
        if not channel:
            raise ValueError("Channel must be provided or set as default")

        payload: dict = {"channel": channel, "text": text}
        if blocks:
            payload["blocks"] = blocks

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{self.BASE_URL}/chat.postMessage", headers=self.headers, json=payload)
            result = resp.json()

        if not result.get("ok"):
            raise Exception(f"Slack API error: {result.get('error')}")
        return {"ts": result.get("ts"), "channel": result.get("channel")}

    async def send_approval_request(self, params: dict) -> dict:
        channel = params.get("channel") or self.default_channel
        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"Approval Required: {params['title']}"},
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": params["description"]},
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Approve"},
                        "style": "primary",
                        "value": f"approve_{params.get('request_id', 'request')}",
                        "action_id": "approve_request",
                    },
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Reject"},
                        "style": "danger",
                        "value": f"reject_{params.get('request_id', 'request')}",
                        "action_id": "reject_request",
                    },
                ],
            },
        ]
        return await self.send_message(f"Approval required: {params['title']}", channel, blocks)

    async def update_message(self, channel: str, message_ts: str, text: str, blocks: list | None = None) -> dict:
        payload: dict = {"channel": channel, "ts": message_ts, "text": text}
        if blocks:
            payload["blocks"] = blocks

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{self.BASE_URL}/chat.update", headers=self.headers, json=payload)
            result = resp.json()

        if not result.get("ok"):
            raise Exception(f"Slack API error: {result.get('error')}")
        return {"updated": True, "ts": result.get("ts"), "channel": result.get("channel")}
