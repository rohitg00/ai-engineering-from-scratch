set -u
export PATH=$HOME/ax/bin:$PATH:/usr/local/go/bin:$HOME/go/bin
C=kind-demo
AX="ax --context $C -n ax-system"
KC="kubectl --context $C"
KA="kubectl ate --context $C"
now() { date -u +%FT%T.%3NZ; }
el() { echo "$(date +%s.%N) - $1" | bc -l | xargs printf '%.3f'; }
run() { n="$1"; shift; s=$(date +%s.%N); bash -c "$*" > "$n.log" 2>&1; rc=$?; printf '%s\t%s\t%s\n' "$n" "$rc" "$(el $s)" >> steps.tsv; }
E=~/evidence/W-ax-kagent-2/30-ax-mcp-skills; mkdir -p $E; cd $E
echo "step	rc	seconds" > steps.tsv
IMG=$(cut -d' ' -f1 ~/evidence/S-ax-model/70-agent-image/03-image.txt)

cat > 01-mcp-server.py <<'P'
import json, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOOL = {
    "name": "lab_fact",
    "description": "Returns the lab fact. Call it when you are asked for the lab fact.",
    "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
}


def answer(req):
    m = req.get("method", "")
    if m == "initialize":
        v = req.get("params", {}).get("protocolVersion", "2025-03-26")
        return {"protocolVersion": v, "capabilities": {"tools": {}}, "serverInfo": {"name": "lab-docs", "version": "0.1"}}
    if m == "tools/list":
        return {"tools": [TOOL]}
    if m == "tools/call":
        return {"content": [{"type": "text", "text": "lab-mcp-7421"}], "isError": False}
    if m == "ping":
        return {}
    return None


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def note(self, what):
        print(time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), self.client_address[0], self.command, self.path, what, flush=True)

    def send(self, code, body=b"", ctype="application/json"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Mcp-Session-Id", "lab-session")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self.note("get")
        if self.path == "/healthz":
            return self.send(200, b"ok", "text/plain")
        self.send(405)

    def do_DELETE(self):
        self.note("delete")
        self.send(200)

    def do_POST(self):
        raw = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        try:
            req = json.loads(raw)
        except ValueError:
            self.note("bad-json")
            return self.send(400)
        reqs = req if isinstance(req, list) else [req]
        out = []
        for r in reqs:
            self.note("method=" + str(r.get("method")) + " id=" + str(r.get("id")) + " name=" + str(r.get("params", {}).get("name", "")))
            if "id" not in r:
                continue
            res = answer(r)
            if res is None:
                out.append({"jsonrpc": "2.0", "id": r["id"], "error": {"code": -32601, "message": "method not found"}})
            else:
                out.append({"jsonrpc": "2.0", "id": r["id"], "result": res})
        if not out:
            return self.send(202)
        body = json.dumps(out if isinstance(req, list) else out[0]).encode()
        self.send(200, body)


ThreadingHTTPServer(("0.0.0.0", 8080), H).serve_forever()
P
$KC -n ax-system create configmap lab-mcp-code --from-file=server.py=01-mcp-server.py --dry-run=client -o yaml | $KC apply -f - > 02-apply-mcp.log 2>&1
cat > 02-mcp-deploy.yaml <<'Y'
apiVersion: apps/v1
kind: Deployment
metadata: {name: lab-mcp, namespace: ax-system}
spec:
  replicas: 1
  selector: {matchLabels: {app: lab-mcp}}
  template:
    metadata: {labels: {app: lab-mcp}}
    spec:
      containers:
      - name: mcp
        image: localhost:5002/tool-sandbox:v1
        command: ["python3", "/code/server.py"]
        ports: [{containerPort: 8080}]
        volumeMounts: [{name: code, mountPath: /code}]
      volumes: [{name: code, configMap: {name: lab-mcp-code}}]
---
apiVersion: v1
kind: Service
metadata: {name: lab-mcp, namespace: ax-system}
spec:
  selector: {app: lab-mcp}
  ports: [{name: http, port: 8080, targetPort: 8080}]
Y
$KC apply -f 02-mcp-deploy.yaml >> 02-apply-mcp.log 2>&1
$KC -n ax-system rollout status deploy/lab-mcp --timeout=120s >> 02-apply-mcp.log 2>&1
cat 02-apply-mcp.log
$KC -n ax-system run w-mcp-check --rm -i --restart=Never --image=curlimages/curl -q -- sh -c 'curl -s -m 10 -H "Content-Type: application/json" -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2025-03-26\"}}" http://lab-mcp.ax-system.svc.cluster.local:8080/mcp; echo; curl -s -m 10 -H "Content-Type: application/json" -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/list\"}" http://lab-mcp.ax-system.svc.cluster.local:8080/mcp' > 03-mcp-direct-check.txt 2>&1
cut -c1-400 03-mcp-direct-check.txt

cat > 04-workspace.yaml <<'Y'
apiVersion: ax.io/v1alpha1
kind: Workspace
metadata:
  name: w-ws
  atespace: default
spec:
  git:
    - name: origin
      repo: "https://github.com/pallets/itsdangerous.git"
      branch: "main"
  files:
    - path: "CLAUDE.md"
      content: |
        # Working in this repo
        - Pure-Python library.
        - Do not push or open pull requests.
  mcp:
    registries:
      - provider: google
        query: "mcp.tags:build"
    servers:
      - name: docs
        endpoint: "http://lab-mcp.ax-system.svc.cluster.local:8080/mcp"
      - name: missing-command
        command: "no-such-mcp-binary"
        args: ["--repo", "/workspace"]
      - name: neither
      - name: docs
        endpoint: "http://duplicate.invalid/mcp"
  skills:
    registries:
      - provider: google
        query: "skills.tags:nodejs"
    path: "/.agents/skills"
Y
run 05-apply-workspace "$AX apply -f 04-workspace.yaml"
run 06-describe-workspace "$AX describe workspace w-ws"
run 06b-get-workspace "$AX get workspace"
T=w-mcp
cat > 07-task.yaml <<EOF
apiVersion: ax.io/v1alpha1
kind: Task
metadata:
  name: $T
  atespace: default
spec:
  image: "$IMG"
  config:
    prompt: "Call the tool lab_fact from the docs MCP server. Then use the Bash tool to write exactly the text that the tool returned into the file /workspace/mcp-result.txt . Then answer with the single word done."
    model: "qwen2.5:3b"
    maxTurns: 6
    dangerouslySkipPermissions: true
    systemPrompt: "You are a coding agent in a Linux sandbox. Use the tools to do what the user asks."
  env:
    - name: ANTHROPIC_BASE_URL
      value: "http://ollama.ax-system.svc.cluster.local:11434"
    - name: ANTHROPIC_AUTH_TOKEN
      value: "ollama"
  resources:
    limits:
      cpu: "2"
      memory: "1536Mi"
  workspace:
    name: w-ws
  debug: true
EOF
cat > 08-egress.yaml <<'Y'
rules:
- http:
    hostnames: ["ollama.ax-system.svc.cluster.local"]
    ports:
      numbers: [11434]
- http:
    hostnames: ["lab-mcp.ax-system.svc.cluster.local"]
    ports:
      numbers: [8080]
- tlsPassthrough:
    hostnames: ["github.com"]
    ports:
      numbers: [443]
Y
T0=$(date -u +%FT%TZ); echo $T0 > 09-t0.txt
run 10-apply-task "$AX apply -f 07-task.yaml"
run 11-create-egress "$KA create egress-policy $T -a default -f 08-egress.yaml"
run 12-resume-first "$AX resume task $T"
echo "$(now)	resumed" > 13-events.tsv
n=0
for i in $(seq 150); do
  o=$($AX ssh $T -- sh -c 'cat /workspace/mcp-result.txt 2>/dev/null; pgrep -x claude >/dev/null && echo CLAUDE-RUNNING || echo CLAUDE-NOT-RUNNING' 2>&1 | tr '\n' ' ' | cut -c1-160)
  st=$($KA get actor $T -a default -o json 2>/dev/null | jq -r '.status.state')
  echo "$(now)	$st	$o" >> 14-poll.tsv
  [ $i = 2 ] && $AX ssh $T -- sh -c 'cat /proc/$(pgrep -x claude | head -1)/cmdline 2>/dev/null | tr "\0" "\n"' > 15-claude-cmdline.txt 2>&1
  case "$o" in *lab-mcp-7421*) echo "$(now)	result-file-seen" >> 13-events.tsv; break;; esac
  case "$o" in *CLAUDE-NOT-RUNNING*) n=$((n+1)); [ $n -ge 4 ] && { echo "$(now)	claude-process-gone" >> 13-events.tsv; break; };; esac
  sleep 5
done
sleep 5
$KA logs actor $T -a default 2>/dev/null | grep -v -E 'cli.go|config.go|namespace.go|container.go|cpulimits.go' > 16-actor.log
run 17-describe "$AX describe task $T"
run 18-inside "$AX ssh $T -- sh -c 'echo == workspace; ls -la /workspace | head -30; echo == result; cat /workspace/mcp-result.txt; echo; echo == skills; ls -la /.agents /.agents/skills 2>&1; echo == ax; ls -la /ax 2>&1; cat /ax/git-error.log 2>/dev/null | tail -3; echo == mcp files; ls -la /workspace/.mcp.json /root/.claude.json 2>&1; echo == env; env | grep -E \"^AX_|ANTHROPIC_BASE|CLAUDE|IS_SANDBOX\" | sort; echo == git; git -C /workspace/itsdangerous log -1 --format=%H 2>&1; ps -eo pid,etimes,args | cut -c1-200 | head -12'"
run 19-task-metadata "$AX ssh $T -- sh -c 'curl -s \$AX_METADATA_URL/metadata/v1alpha1/ax/task | head -c 3000'"
$KC -n ax-system logs deploy/lab-mcp --since=30m > 20-mcp-server.log 2>&1
docker logs --since $T0 -t ollama 2>&1 | grep -E "GIN" > 21-ollama-gin.log
run 22-suspend "$AX suspend task $T"
echo "$(now)	MCP-DONE" >> 13-events.tsv
cat steps.tsv 13-events.tsv; tail -3 14-poll.tsv | cut -c1-200
for f in 05-* 06-* 10-* 11-* 12-* 17-* 18-* 19-*; do echo "== $f"; grep -v "^Warning: no --token" $f | cut -c1-400 | head -50; done
echo "== cmdline"; cut -c1-600 15-claude-cmdline.txt
echo "== mcp server log"; cat 20-mcp-server.log | cut -c1-200 | tail -30
echo "== actor log"; grep -i -E "mcp|skill|warn|error|claude" 16-actor.log | cut -c1-400 | tail -30
echo "== gin"; tail -12 21-ollama-gin.log
echo DONE-W31
