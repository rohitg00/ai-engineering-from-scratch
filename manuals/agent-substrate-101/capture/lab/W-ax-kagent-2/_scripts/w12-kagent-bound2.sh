set -u
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin:$HOME/bin:/usr/local/bin
E=~/evidence/W-ax-kagent-2/12-kagent-bound-long; mkdir -p $E; cd $E
export KUBECONFIG=~/kagent.kubeconfig
now() { date +%s.%N; }
iso() { date -u +%FT%T.%3NZ; }
ev() { echo "$(iso) $*" | tee -a events.log; }
pgrep -f "port-forward svc/kagent-controller" >/dev/null || (setsid kubectl -n kagent port-forward svc/kagent-controller 8083:8083 > port-forward.log 2>&1 < /dev/null &)
sleep 3
echo 'Do not use any tool. Count from 1 to 3000. Write every number on its own line. Do not skip any number and do not summarize.' > prompt-count.txt
echo 'Run the command `cat /proc/uptime` with the bash tool and tell me the first number.' > prompt-tool.txt
: > timings.tsv
state() { kubectl ate get actor "session-$1" -a kagent -o json 2>/dev/null | jq -r '.. | objects | .state? // empty' | head -1; }
cpu() { docker stats --no-stream --format '{{.CPUPerc}}' ollama 2>/dev/null; }
sess() { kagent agent session create --agent "$1" -o json > "session-$2.json" 2> "session-$2.err"; jq -r '.session.id' "session-$2.json"; }
run() {
  name=$1; agent=$2; prompt=$3; tmo=$4
  sid=$(sess "$agent" "$name"); echo "$sid" > "$name.sid"
  ev "$name start agent=$agent sid=$sid timeout=$tmo"
  s=$(now); kagent --timeout "$tmo" agent invoke --session "$sid" -f "$prompt" -o json > "$name.json" 2> "$name.err"; rc=$?; e=$(now)
  d=$(echo "$e - $s" | bc)
  st=$(jq -r '.task.status.state // "none"' "$name.json" 2>/dev/null)
  chars=$(jq -r '[.task.artifacts[]?.parts[]? | (.text // (.data|tostring))] | join("") | length' "$name.json" 2>/dev/null)
  out=$(grep -o '"outputTokens":[0-9]*' "$name.json" | head -1 | cut -d: -f2)
  a0=$(state "$sid")
  ev "$name end rc=$rc dur=$d task=$st chars=$chars outputTokens=$out actor=$a0 cpu=$(cpu) err=$(head -c 200 "$name.err" | tr '\n' ' ')"
  printf '%s\t%s\t%s\t%s\t%.3f\t%s\t%s\t%s\t%s\t%s\n' "$(iso)" "$name" "$agent" "$sid" "$d" "$rc" "$st" "${chars:-}" "${out:-}" "$a0" >> timings.tsv
}
watch_after() {
  sid=$(cat "$1.sid"); p=0
  for t in $3; do
    sleep $(( t - p )); p=$t
    echo "$(iso) +${t}s actor=$(state "$sid") ollama_cpu=$(cpu)" | tee -a "$1.after.log"
  done
}
T0=$(date -u +%FT%TZ); echo $T0 > t0.txt
ev "phase T: maxTokens 128, count prompt"
for i in 1 2 3; do run "T-tok-count-$i" w-tok prompt-count.txt 5m; sleep 4; done
watch_after T-tok-count-3 x "5 15"
ev "phase U: timeout 20, count prompt"
for i in 1 2 3; do run "U-time-count-$i" w-time prompt-count.txt 5m; watch_after "U-time-count-$i" x "5 15 30"; done
ev "phase U2: next turn in the same session after a timeout"
sid=$(cat U-time-count-3.sid)
s=$(now); kagent --timeout 5m agent invoke --session "$sid" -f prompt-tool.txt -o json > U2-next-same-session.json 2> U2-next-same-session.err; rc=$?
ev "U2-next-same-session rc=$rc dur=$(echo "$(now) - $s" | bc) task=$(jq -r '.task.status.state // "none"' U2-next-same-session.json 2>/dev/null) actor=$(state $sid)"
ev "phase F: no bound, count prompt, client timeout 60 s"
run "F-free-count-1" real-1p5b prompt-count.txt 60s
watch_after F-free-count-1 x "5 15 30 60 90 120 180 240"
ev "F next turn on a new session"
run "F-next-turn" real-1p5b prompt-tool.txt 5m
sid=$(cat F-free-count-1.sid)
ev "F same session, next turn"
s=$(now); kagent --timeout 5m agent invoke --session "$sid" -f prompt-tool.txt -o json > F-next-same-session.json 2> F-next-same-session.err; rc=$?
ev "F-next-same-session rc=$rc dur=$(echo "$(now) - $s" | bc) task=$(jq -r '.task.status.state // "none"' F-next-same-session.json 2>/dev/null) actor=$(state $sid) err=$(head -c 200 F-next-same-session.err | tr '\n' ' ')"
c=$(cpu); ev "F cpu before cleanup=$c"
case "$c" in [0-9].*|[0-9][0-9].*) ev "model idle, no restart";; *) ev "model still busy: restarting the model server"; docker restart ollama > restart.log 2>&1; sleep 8; ev "restarted cpu=$(cpu)";; esac
docker logs --since "$T0" -t ollama 2>&1 | grep GIN > ollama-gin.log
kubectl -n kagent logs deploy/kagent-controller --since=30m > kagent-controller.log 2>&1
for n in T-tok-count-1 U-time-count-1 F-free-count-1; do kubectl ate get actor "session-$(cat $n.sid)" -a kagent -o json > "$n.actor.json" 2>&1; kubectl ate logs actor "session-$(cat $n.sid)" -a kagent 2>/dev/null | tail -60 > "$n.actor.log"; done
ev DONE
