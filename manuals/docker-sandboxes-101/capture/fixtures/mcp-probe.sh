set -e
U="$MCP_GATEWAY_URL"
H="Content-Type: application/json"
A="Accept: application/json, text/event-stream"
curl -sS --max-time 20 -D /tmp/mcp-headers.txt -o /tmp/mcp-init.txt -X POST "$U" -H "$H" -H "$A" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2026-07-28","capabilities":{},"clientInfo":{"name":"m101","version":"0"}}}'
SID=$(grep -i "^Mcp-Session-Id:" /tmp/mcp-headers.txt | tr -d "\r" | cut -d" " -f2)
echo "session=$SID"
curl -sS --max-time 20 -o /dev/null -w "initialized %{http_code}\n" -X POST "$U" -H "$H" -H "$A" -H "Mcp-Session-Id: $SID" -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'
curl -sS --max-time 30 -X POST "$U" -H "$H" -H "$A" -H "Mcp-Session-Id: $SID" -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' > /tmp/mcp-tools.txt
grep "^data:" /tmp/mcp-tools.txt | sed "s/^data: //" | python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(" ".join(sorted(t["name"] for t in d["result"]["tools"])) if "result" in d else json.dumps(d))'
