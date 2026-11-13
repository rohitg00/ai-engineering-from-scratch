set -u
export PATH=$HOME/ax/bin:$PATH:/usr/local/go/bin:$HOME/go/bin
C=kind-demo
AX="ax --context $C -n ax-system"
KC="kubectl --context $C"
KA="kubectl ate --context $C"
now() { date -u +%FT%T.%3NZ; }
el() { echo "$(date +%s.%N) - $1" | bc -l | xargs printf '%.3f'; }
run() { n="$1"; shift; s=$(date +%s.%N); bash -c "$*" > "$n.log" 2>&1; rc=$?; printf '%s\t%s\t%s\n' "$n" "$rc" "$(el $s)" >> steps.tsv; }
IMG=$(cut -d' ' -f1 ~/evidence/S-ax-model/70-agent-image/03-image.txt)

E=~/evidence/W-ax-kagent-2/51-ax-agent-image-2; mkdir -p $E; cd $E
echo "step	rc	seconds" > steps.tsv
T=w-agent2
cat > 11-task.yaml <<EOF
apiVersion: ax.io/v1alpha1
kind: Task
metadata:
  name: $T
  atespace: default
spec:
  image: "$IMG"
  config:
    prompt: "Run this shell command with the Bash tool: echo agent-was-here > /workspace/agent-output.txt . Then answer with the single word done."
    model: "qwen2.5:3b"
    maxTurns: 4
    dangerouslySkipPermissions: true
    systemPrompt: "You are a coding agent in a Linux sandbox. Use the tools to do what the user asks."
    tools: "Bash,Write,Read"
  env:
    - name: ANTHROPIC_BASE_URL
      value: "http://ollama.ax-system.svc.cluster.local:11434"
    - name: ANTHROPIC_AUTH_TOKEN
      value: "ollama"
  resources:
    limits:
      cpu: "2"
      memory: "1536Mi"
  debug: true
EOF
cat > 12-egress.yaml <<'Y'
rules:
- http:
    hostnames: ["ollama.ax-system.svc.cluster.local"]
    ports:
      numbers: [11434]
Y
T0=$(date -u +%FT%TZ); echo $T0 > 13-t0.txt
run 14-apply "$AX apply -f 11-task.yaml"
run 15-create-egress "$KA create egress-policy $T -a default -f 12-egress.yaml"
S0=$(date +%s.%N)
run 16-resume "$AX resume task $T"
echo "$(now)	resumed" > 17-events.tsv
n=0
for i in $(seq 180); do
  o=$($AX ssh $T -- sh -c 'cat /workspace/agent-output.txt 2>/dev/null; pgrep -x claude >/dev/null && echo CLAUDE-RUNNING || echo CLAUDE-NOT-RUNNING' 2>&1 | tr '\n' ' ' | cut -c1-160)
  st=$($KA get actor $T -a default -o json 2>/dev/null | jq -r '.status.state')
  echo "$(now)	$st	$(el $S0)	$o" >> 18-poll.tsv
  case "$o" in *agent-was-here*CLAUDE-NOT-RUNNING*) echo "$(now)	output-file-seen-and-claude-gone	$(el $S0)" >> 17-events.tsv; break;; esac
  case "$o" in *CLAUDE-NOT-RUNNING*) n=$((n+1)); [ $n -ge 6 ] && { echo "$(now)	claude-process-gone	$(el $S0)" >> 17-events.tsv; break; };; esac
  sleep 2
done
sleep 3
$KA logs actor $T -a default 2>/dev/null | grep -v -E 'cli.go|config.go|namespace.go|container.go|cpulimits.go' > 19-actor.log
run 20-describe "$AX describe task $T"
run 21-workspace "$AX ssh $T -- sh -c 'ls -la /workspace; cat /workspace/agent-output.txt; ps -eo pid,etimes,args | cut -c1-160 | head -12'"
docker logs --since $T0 -t ollama 2>&1 | grep -E "GIN" > 22-ollama-gin.log
run 23-state-60s-later "sleep 60; $AX describe task $T | grep -E 'Phase'; $KA get actor $T -a default -o json | jq -c '{state: .status.state}'"
run 24-suspend "$AX suspend task $T"
cat steps.tsv 17-events.tsv; awk -F'\t' '{k=$2 FS $4; if (k!=p) {print; p=k}}' 18-poll.tsv | cut -c1-200 | tail -8
for f in 14-* 16-* 20-* 21-* 23-*; do echo "== $f"; grep -v "^Warning: no --token" $f | cut -c1-300 | head -20; done
cat 22-ollama-gin.log | cut -c1-150; grep -v "^$" 19-actor.log | tail -12 | cut -c1-400
echo DONE-W33
