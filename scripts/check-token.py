import sys, json, base64
d = json.load(sys.stdin)
t = d.get("access_token", "")
parts = t.split(".")
payload = json.loads(base64.urlsafe_b64decode(parts[1] + "==").decode())
print("roles:", payload.get("roles", []))
print("scp:", payload.get("scp", "none"))
