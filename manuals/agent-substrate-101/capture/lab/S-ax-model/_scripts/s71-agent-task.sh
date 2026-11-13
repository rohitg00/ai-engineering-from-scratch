set -u
export PATH=$HOME/ax/bin:$PATH:/usr/local/go/bin:$HOME/go/bin
C=kind-demo
AX="ax --context $C -n ax-system"
KC="kubectl --context $C"
KA="kubectl ate --context $C"
now() { date -u +%FT%T.%3NZ; }
el() { echo "$(date +%s.%N) - $1" | bc -l | xargs printf '%.3f'; }
E=~/evidence/S-ax-model/70-agent-image; cd $E
run() { n="$1"; shift; s=$(date +%s.%N); bash -c "$*" > "$n.log" 2>&1; rc=$?; printf '%s\t%s\t%s\n' "$n" "$rc" "$(el $s)" >> steps.tsv; }
T=s-agent
IMG=$(cut -d' ' -f1 03-image.txt)
docker run --rm --entrypoint claude localhost:5002/ax-claude-code:latest --help > 10-claude-help.txt 2>&1
EXTRA=""
grep -q -- "--system-prompt" 10-claude-help.txt && EXTRA="$EXTRA
    systemPrompt: \"You are a coding agent in a Linux sandbox. Use the tools to do what the user asks.\""
grep -q -- "--tools" 10-claude-help.txt && EXTRA="$EXTRA
    tools: \"Bash,Write,Read\""
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
    dangerouslySkipPermissions: true$EXTRA
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
run 16-resume "$AX resume task $T"
echo "$(now)	resumed" > 17-events.tsv
for i in $(seq 180); do
  o=$($AX ssh $T -- sh -c 'cat /workspace/agent-output.txt 2>/dev/null; pgrep -x claude >/dev/null && echo CLAUDE-RUNNING || echo CLAUDE-NOT-RUNNING' 2>&1 | tr '\n' ' ' | cut -c1-160)
  st=$($KA get actor $T -a default -o json 2>/dev/null | jq -r '.status.state')
  echo "$(now)	$st	$o" >> 18-poll.tsv
  case "$o" in *agent-was-here*) echo "$(now)	output-file-seen" >> 17-events.tsv; break;; esac
  case "$o" in *CLAUDE-NOT-RUNNING*) n=$((${n:-0}+1)); [ $n -ge 4 ] && { echo "$(now)	claude-process-gone" >> 17-events.tsv; break; };; esac
  sleep 5
done
sleep 5
$KA logs actor $T -a default 2>/dev/null | grep -v -E 'cli.go|config.go|namespace.go|container.go|cpulimits.go' > 19-actor.log
run 20-describe "$AX describe task $T"
run 21-workspace "$AX ssh $T -- sh -c 'ls -la /workspace; cat /workspace/agent-output.txt; ps -eo pid,etimes,args | head -12'"
docker logs --since $T0 -t ollama 2>&1 | grep -E "GIN|print_timing: .*n_prompt|prompt eval|eval time|n_ctx" > 22-ollama.log
$KC -n ate-system logs deploy/atenet-egress --since=20m 2>/dev/null | grep -i -E "ollama|anthropic" | cut -c1-260 | tail -20 > 23-egress.log
$KC -n ate-system logs deploy/atenet-egress -c ext-proc --since=20m 2>/dev/null | grep -i -E "denied|anthropic|statsig|sentry|claude" | cut -c1-260 | tail -20 >> 23-egress.log
echo "$(now)	AGENT-DONE" >> 17-events.tsv
