set -u
export PATH=$HOME/ax/bin:$PATH:/usr/local/go/bin:$HOME/go/bin
C=kind-demo
AX="ax --context $C -n ax-system"
KC="kubectl --context $C"
KA="kubectl ate --context $C"
now() { date -u +%FT%T.%3NZ; }
el() { echo "$(date +%s.%N) - $1" | bc -l | xargs printf '%.3f'; }
run() { n="$1"; shift; s=$(date +%s.%N); bash -c "$*" > "$n.log" 2>&1; rc=$?; printf '%s\t%s\t%s\n' "$n" "$rc" "$(el $s)" >> steps.tsv; }
E=~/evidence/W-ax-kagent-2/40-ax-example; mkdir -p $E; cd $E
echo "step	rc	seconds" > steps.tsv
IMG=$(cut -d' ' -f1 ~/evidence/S-ax-model/70-agent-image/03-image.txt)
BUDGET=${BUDGET:-1500}
cp ~/ax/examples/claude-code/task.yaml 01-original.yaml
python3 - "$IMG" <<'P'
import sys
t = open("01-original.yaml").read()
img = sys.argv[1]
def sw(a, b):
    global t
    assert t.count(a) == 1, a
    t = t.replace(a, b)
sw('image: "gcr.io/ax-images/ax-images@sha256:REPLACE_WITH_PUSHED_DIGEST"', 'image: "%s"' % img)
sw('model: claude-opus-5-5', 'model: "qwen2.5:3b"')
sw('''    - name: ANTHROPIC_API_KEY
      value: "${ANTHROPIC_API_KEY}"''', '''    - name: ANTHROPIC_BASE_URL
      value: "http://ollama.ax-system.svc.cluster.local:11434"
    - name: ANTHROPIC_AUTH_TOKEN
      value: "ollama"''')
open("02-task-4gi.yaml", "w").write(t)
sw('memory: "4Gi"', 'memory: "1536Mi"')
open("03-task-1536mi.yaml", "w").write(t)
P
diff 01-original.yaml 02-task-4gi.yaml > 02-diff-from-original.txt
diff 02-task-4gi.yaml 03-task-1536mi.yaml > 03-diff-memory.txt
cat > 04-egress.yaml <<'Y'
rules:
- http:
    hostnames: ["ollama.ax-system.svc.cluster.local"]
    ports:
      numbers: [11434]
- tlsPassthrough:
    hostnames: ["github.com", "pypi.org", "files.pythonhosted.org"]
    ports:
      numbers: [443]
Y
T=claude-code
$KA get worker > 05-workers.txt 2>&1
run 06-apply-4gi "$AX apply -f 02-task-4gi.yaml"
run 07-create-egress "$KA create egress-policy $T -a default -f 04-egress.yaml"
run 08-resume-4gi "timeout 120 $AX resume task $T"
run 09-describe-4gi "$AX describe task $T; $KA get actor $T -a default -o json | jq -c '{state: .status.state}'"
ST=$($KA get actor $T -a default -o json 2>/dev/null | jq -r '.status.state')
echo "state after 4Gi resume: $ST"
if [ "$ST" != "ACTOR_STATE_RUNNING" ]; then
  run 10-apply-1536mi "$AX apply -f 03-task-1536mi.yaml"
  run 11-describe-after-apply "$AX describe task $T; $KA get actor-template -a default 2>&1 | grep -E 'NAME|claude-code'"
  run 12-resume-1536mi "timeout 120 $AX resume task $T"
  ST=$($KA get actor $T -a default -o json 2>/dev/null | jq -r '.status.state')
  if [ "$ST" != "ACTOR_STATE_RUNNING" ]; then
    run 13-delete-task "$AX delete task $T"
    sleep 3
    run 14-apply-1536mi-fresh "$AX apply -f 03-task-1536mi.yaml"
    run 15-create-egress-fresh "$KA create egress-policy $T -a default -f 04-egress.yaml"
    run 16-resume-fresh "timeout 120 $AX resume task $T"
  fi
fi
T0=$(date -u +%FT%TZ); echo $T0 > 17-t0.txt
echo "$(now)	resumed" > 18-events.tsv
S0=$(date +%s); n=0
while [ $(( $(date +%s) - S0 )) -lt $BUDGET ]; do
  o=$($AX ssh $T -- sh -c 'pgrep -x claude >/dev/null && echo CLAUDE-RUNNING || echo CLAUDE-NOT-RUNNING; ls /workspace | tr "\n" " "; [ -f /workspace/claude-output.md ] && echo HAS-REPORT; ls /workspace/itsdangerous 2>/dev/null | wc -l' 2>&1 | tr '\n' ' ' | cut -c1-240)
  st=$($KA get actor $T -a default -o json 2>/dev/null | jq -r '.status.state')
  echo "$(now)	$st	$o" >> 19-poll.tsv
  case "$o" in *CLAUDE-NOT-RUNNING*) n=$((n+1)); [ $n -ge 4 ] && { echo "$(now)	claude-process-gone" >> 18-events.tsv; break; };; *) n=0;; esac
  sleep 15
done
[ $(( $(date +%s) - S0 )) -ge $BUDGET ] && echo "$(now)	budget-of-${BUDGET}s-reached-claude-still-running" >> 18-events.tsv
$KA logs actor $T -a default 2>/dev/null | grep -v -E 'cli.go|config.go|namespace.go|container.go|cpulimits.go' > 20-actor.log
run 21-describe "$AX describe task $T"
run 22-inside "$AX ssh $T -- sh -c 'echo == workspace; ls -la /workspace | head -30; echo == report; head -c 3000 /workspace/claude-output.md 2>&1; echo; echo == git; cd /workspace/itsdangerous 2>/dev/null && { git log -1 --format=%H; git status --short | head -20; git diff --stat | tail -5; }; echo == tools; which python3 pip pip3 pytest git 2>&1; python3 -V 2>&1; echo == ax; ls -la /ax; tail -3 /ax/git-error.log 2>/dev/null; echo == ps; ps -eo pid,etimes,args | cut -c1-220 | head -14'"
run 23-cmdline "$AX ssh $T -- sh -c 'cat /proc/\$(pgrep -x claude | head -1)/cmdline 2>/dev/null | tr \"\\0\" \"\\n\" | cut -c1-400'"
docker logs --since $T0 -t ollama 2>&1 | grep -E "GIN" > 24-ollama-gin.log
docker logs --since $T0 -t ollama 2>&1 | grep -E "prompt eval|eval time|n_ctx|truncat|context" | tail -60 > 25-ollama-timing.log
$KC -n ate-system logs deploy/atenet-egress -c ext-proc --since=40m 2>/dev/null | grep -i -E "denied|refus|block" | cut -c1-260 | tail -30 > 26-egress-denied.log
$KC -n ate-system logs deploy/atenet-egress --since=40m 2>/dev/null | grep -i -E "pypi|pythonhosted|github|anthropic|statsig|sentry" | cut -c1-220 | tail -30 > 26b-egress-hosts.log
run 27-suspend "$AX suspend task $T"
echo "$(now)	EXAMPLE-DONE" >> 18-events.tsv
cat steps.tsv 18-events.tsv; cat 02-diff-from-original.txt
for f in 06-* 08-* 09-* 10-* 11-* 12-* 13-* 14-* 16-* 21-* 22-*; do [ -f $f ] && { echo "== $f"; grep -v "^Warning: no --token" $f | cut -c1-500 | head -60; }; done
echo "== poll changes"; awk -F'\t' '{k=$2 FS $3; if (k!=p) {print; p=k}}' 19-poll.tsv | cut -c1-260 | tail -20
echo "== gin"; wc -l < 24-ollama-gin.log; head -3 24-ollama-gin.log | cut -c1-150; tail -6 24-ollama-gin.log | cut -c1-150
echo "== actor log tail"; grep -v "^$" 20-actor.log | tail -25 | cut -c1-500
echo DONE-W32
