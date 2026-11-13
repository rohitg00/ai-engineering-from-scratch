set -u
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin:$HOME/bin:/usr/local/bin
E=~/evidence/W-ax-kagent-2/10-kagent-bound; mkdir -p $E; cd $E
export KUBECONFIG=~/kagent.kubeconfig
now() { date +%s.%N; }
iso() { date -u +%FT%T.%3NZ; }
ev() { echo "$(iso) $*" | tee -a events.log; }
pgrep -f "port-forward svc/kagent-controller" >/dev/null || (setsid kubectl -n kagent port-forward svc/kagent-controller 8083:8083 > port-forward.log 2>&1 < /dev/null &)
sleep 3
kubectl explain modelconfig.spec.openAI.maxTokens > 00-explain-maxTokens.txt 2>&1
kubectl explain modelconfig.spec.openAI.timeout > 00-explain-timeout.txt 2>&1
kubectl explain modelconfig.spec.openAI.maxCompletionTokens > 00-explain-maxCompletionTokens.txt 2>&1
kubectl explain agenttemplate.spec > 00-explain-agenttemplate-spec.txt 2>&1
kubectl explain agent.spec > 00-explain-agent-spec.txt 2>&1
mk() {
cat <<Y
---
apiVersion: api.kagent.dev/v1alpha3
kind: ModelConfig
metadata: {name: $1, namespace: kagent}
spec:
  provider: OpenAI
  model: qwen2.5:1.5b
  apiKeySecret: kagent-openai
  apiKeySecretKey: OPENAI_API_KEY
  stream: true
  openAI:
    baseUrl: http://ollama.kagent.svc.cluster.local:11434/v1
    $2
---
apiVersion: api.kagent.dev/v1alpha3
kind: AgentTemplate
metadata: {name: $1-template, namespace: kagent}
spec:
  description: Lab agent with a bound on the model call
  modelConfig: {name: $1}
  systemPrompt: You are a lab agent. Use the bash tool when the user asks you to run a command. Answer in one short sentence.
---
apiVersion: api.kagent.dev/v1alpha3
kind: Agent
metadata: {name: $1, namespace: kagent}
spec:
  template: {ref: {name: $1-template}}
  harnessRef: {name: lab-harness}
Y
}
{ mk w-tok "maxTokens: 128"; mk w-time "timeout: 20"; } > 01-bounded.yaml
s=$(now); kubectl apply -f 01-bounded.yaml > 02-apply.log 2>&1; cat 02-apply.log
for a in w-tok w-time real-1p5b; do
  for i in $(seq 180); do r=$(kubectl -n kagent get agent $a -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null); [ "$r" = True ] && break; sleep 1; done
  echo "$a ready=$r after $(echo "$(now) - $s" | bc) s" | tee -a 03-ready.txt
done
kubectl -n kagent get agent,modelconfig -o wide > 04-objects.txt 2>&1
kubectl -n kagent get modelconfig w-tok w-time -o yaml > 04-modelconfigs.yaml 2>&1
kubectl ate get worker > 05-workers.txt 2>&1
echo 'Run the command `cat /proc/uptime` with the bash tool and tell me the first number.' > prompt-tool.txt
echo 'Do not use any tool. Write the word lab again and again, 5000 times, separated by spaces. Do not stop before you reach 5000.' > prompt-long.txt
: > timings.tsv
state() { kubectl ate get actor "session-$1" -a kagent -o json 2>/dev/null | jq -r '.. | objects | .state? // empty' | head -1; }
sess() { kagent agent session create --agent "$1" -o json > "session-$2.json" 2> "session-$2.err"; jq -r '.session.id' "session-$2.json"; }
run() {
  name=$1; agent=$2; prompt=$3; tmo=$4
  sid=$(sess "$agent" "$name")
  ev "$name start agent=$agent sid=$sid timeout=$tmo"
  s=$(now); kagent --timeout "$tmo" agent invoke --session "$sid" -f "$prompt" -o json > "$name.json" 2> "$name.err"; rc=$?; e=$(now)
  d=$(echo "$e - $s" | bc)
  st=$(jq -r '.task.status.state // "none"' "$name.json" 2>/dev/null)
  chars=$(jq -r '[.task.artifacts[]?.parts[]? | (.text // (.data|tostring))] | join("") | length' "$name.json" 2>/dev/null)
  a0=$(state "$sid")
  ev "$name end rc=$rc dur=$d task=$st chars=$chars actor=$a0"
  printf '%s\t%s\t%s\t%s\t%.3f\t%s\t%s\t%s\t%s\n' "$(iso)" "$name" "$agent" "$sid" "$d" "$rc" "$st" "${chars:-}" "$a0" >> timings.tsv
  echo "$sid" > "$name.sid"
}
watch_after() {
  sid=$(cat "$1.sid")
  for t in 5 15 30 60 90 120 180 240; do
    sleep_for=$(( t - ${prev:-0} )); prev=$t; sleep $sleep_for
    echo "$(iso) +${t}s actor=$(state "$sid") ollama_ps=$(docker exec ollama ollama ps 2>/dev/null | sed -n 2p | awk '{print $1,$4,$5,$6}')" | tee -a "$1.after.log"
    [ "$t" -ge "$2" ] && break
  done
  prev=0
}
T0=$(date -u +%FT%TZ); echo $T0 > t0.txt
docker exec ollama ollama ps > 06-ollama-ps-before.txt 2>&1

ev "phase A2: token bound, long prompt"
for i in 1 2 3; do run "A2-tok-long-$i" w-tok prompt-long.txt 5m; sleep 4; done
ev "phase A3: time bound, long prompt"
for i in 1 2 3; do run "A3-time-long-$i" w-time prompt-long.txt 5m; sleep 4; done
prev=0; watch_after A3-time-long-3 60
ev "phase B: bounded configs, tool prompt"
for i in 1 2 3 4 5; do run "B-tok-tool-$i" w-tok prompt-tool.txt 5m; sleep 3; done
for i in 1 2 3 4 5; do run "B-time-tool-$i" w-time prompt-tool.txt 5m; sleep 3; done
ev "phase C: unbounded 1.5b, tool prompt, first turn of 10 new sessions, client timeout 120 s"
for i in $(seq -w 1 10); do run "C-free-tool-$i" real-1p5b prompt-tool.txt 120s; sleep 3; done
ev "phase A1: unbounded, long prompt, client timeout 90 s"
run "A1-free-long-1" real-1p5b prompt-long.txt 90s
prev=0; watch_after A1-free-long-1 240
docker exec ollama ollama ps > 07-ollama-ps-after-A1.txt 2>&1
if docker exec ollama ollama ps | sed -n 2p | grep -q .; then
  sid=$(cat A1-free-long-1.sid)
  ev "A1 next turn on a second session while the first may still generate"
  run "A1-next-turn" real-1p5b prompt-tool.txt 120s
fi
ev "A1 final actor=$(state $(cat A1-free-long-1.sid))"
docker logs --since "$T0" -t ollama > ollama.log 2>&1
grep -c . ollama.log
kubectl -n kagent logs deploy/kagent-controller --since=60m > kagent-controller.log 2>&1
for n in A1-free-long-1 A2-tok-long-1 A3-time-long-1; do kubectl ate get actor "session-$(cat $n.sid)" -a kagent -o json > "$n.actor.json" 2>&1; done
ev DONE
