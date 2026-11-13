set -u
export PATH=$HOME/ax/bin:$PATH:/usr/local/go/bin:$HOME/go/bin
C=kind-demo
AX="ax --context $C -n ax-system"
KC="kubectl --context $C"
KA="kubectl ate --context $C"
now() { date -u +%FT%T.%3NZ; }
el() { echo "$(date +%s.%N) - $1" | bc -l | xargs printf '%.3f'; }
IMG=$(cut -d' ' -f1 ~/evidence/S-ax-model/70-agent-image/03-image.txt)
ROOT=~/evidence/W-ax-kagent-2/31-ax-mcp-call; mkdir -p $ROOT
one() {
  T=$1; E=$ROOT/$T; mkdir -p $E; cd $E
  echo "step	rc	seconds" > steps.tsv
  run() { n="$1"; shift; s=$(date +%s.%N); bash -c "$*" > "$n.log" 2>&1; rc=$?; printf '%s\t%s\t%s\n' "$n" "$rc" "$(el $s)" >> steps.tsv; }
  cat > 07-task.yaml <<EOF
apiVersion: ax.io/v1alpha1
kind: Task
metadata:
  name: $T
  atespace: default
spec:
  image: "$IMG"
  config:
    prompt: "Use the tool mcp__docs__lab_fact now. After it returns, reply with exactly the text that it returned and nothing else."
    model: "qwen2.5:3b"
    maxTurns: 4
    dangerouslySkipPermissions: true
    systemPrompt: "You are an agent in a Linux sandbox. You must call a tool when the user names one."
    tools: "Bash"
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
  cp ~/evidence/W-ax-kagent-2/30-ax-mcp-skills/08-egress.yaml 08-egress.yaml
  T0=$(date -u +%FT%TZ); echo $T0 > 09-t0.txt
  $KC -n ax-system logs deploy/lab-mcp --since=60m 2>/dev/null | wc -l > 09-mcp-lines-before.txt
  run 10-apply-task "$AX apply -f 07-task.yaml"
  run 11-create-egress "$KA create egress-policy $T -a default -f 08-egress.yaml"
  S0=$(date +%s.%N)
  run 12-resume-first "$AX resume task $T"
  n=0
  for i in $(seq 120); do
    o=$($AX ssh $T -- sh -c 'pgrep -x claude >/dev/null && echo CLAUDE-RUNNING || echo CLAUDE-NOT-RUNNING' 2>&1 | tr '\n' ' ' | cut -c1-100)
    echo "$(now)	$(el $S0)	$o" >> 14-poll.tsv
    case "$o" in *CLAUDE-NOT-RUNNING*) n=$((n+1)); [ $n -ge 3 ] && break;; esac
    sleep 4
  done
  sleep 3
  $KA logs actor $T -a default 2>/dev/null | grep -v -E 'cli.go|config.go|namespace.go|container.go|cpulimits.go' > 16-actor.log
  $KC -n ax-system logs deploy/lab-mcp --since=60m 2>/dev/null | tail -n +$(( $(cat 09-mcp-lines-before.txt) + 1 )) > 20-mcp-server.log
  docker logs --since $T0 -t ollama 2>&1 | grep -E "GIN" > 21-ollama-gin.log
  run 22-suspend "$AX suspend task $T"
  echo "#### $T"; cat steps.tsv; tail -1 14-poll.tsv; cat 20-mcp-server.log | cut -c1-160; tail -3 16-actor.log | cut -c1-500; cut -c1-150 21-ollama-gin.log
}
one w-mcp2
one w-mcp3
echo DONE-W34
