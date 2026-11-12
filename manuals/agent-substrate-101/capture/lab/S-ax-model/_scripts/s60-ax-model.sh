set -u
export PATH=$HOME/ax/bin:$PATH:/usr/local/go/bin:$HOME/go/bin
C=kind-demo
AX="ax --context $C -n ax-system"
KC="kubectl --context $C"
KA="kubectl ate --context $C"
el() { echo "$(date +%s.%N) - $1" | bc -l | xargs printf '%.3f'; }
run() { n="$1"; shift; s=$(date +%s.%N); bash -c "$*" > "$n.log" 2>&1; rc=$?; printf '%s\t%s\t%s\n' "$n" "$rc" "$(el $s)" >> steps.tsv; }
E=~/evidence/S-ax-model/60-ax-model; mkdir -p $E; cd $E
echo "step	rc	seconds" > steps.tsv
T=s-model-task
export KUBECONFIG_KAGENT=~/kagent.kubeconfig
kubectl --kubeconfig ~/kagent.kubeconfig ate get actor -a kagent 2>/dev/null | grep -v SUSPENDED > ../20-kagent/loop/actors-not-suspended-after-loop.txt
cat > 01-ollama-service.yaml <<'Y'
apiVersion: v1
kind: Service
metadata: {name: ollama, namespace: ax-system}
spec:
  ports: [{name: http, port: 11434, targetPort: 11434}]
---
apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: ollama-1
  namespace: ax-system
  labels: {kubernetes.io/service-name: ollama}
addressType: IPv4
ports: [{name: http, port: 11434, protocol: TCP}]
endpoints: [{addresses: ["172.18.0.5"]}]
Y
$KC apply -f 01-ollama-service.yaml > 02-apply-service.log 2>&1
$KC -n ax-system create secret generic s-model-key --from-literal=GEMINI_API_KEY=lab-placeholder-not-a-key > 03-secret.log 2>&1
cat > 04-model-and-task.yaml <<'Y'
apiVersion: ax.io/v1alpha1
kind: Model
metadata:
  name: s-model
  atespace: default
spec:
  provider: google
  model: qwen2.5:3b
  secretKey:
    name: s-model-key
    key: GEMINI_API_KEY
---
apiVersion: ax.io/v1alpha1
kind: Task
metadata:
  name: s-model-task
  atespace: default
spec:
  debug: true
  command: ["sleep", "infinity"]
  env:
    - name: MODEL_URL
      value: "http://ollama.ax-system.svc.cluster.local:11434/v1/chat/completions"
Y
run 05-apply "$AX apply -f 04-model-and-task.yaml"
run 06-describe-model "$AX describe model s-model; $AX get models"
cat > 07-egress.yaml <<'Y'
rules:
- http:
    hostnames: ["ollama.ax-system.svc.cluster.local"]
    ports:
      numbers: [11434]
Y
run 08-create-egress "$KA create egress-policy $T -a default -f 07-egress.yaml"
run 09-resume "$AX resume task $T"
run 10-env-in-task "$AX ssh $T -- sh -c 'env | sort | grep -i -E \"gemini|anthropic|api_key|model|openai\"; echo ---; env | sort | cut -d= -f1 | tr \"\\n\" \" \"'"
cat > call.sh <<'S'
i=$1
t0=$(date +%s.%N)
curl -s -m 120 -o /tmp/resp.json -w "%{http_code} %{time_total}" "$MODEL_URL" -H 'Content-Type: application/json' -d "{\"model\":\"qwen2.5:3b\",\"seed\":$i,\"max_tokens\":80,\"messages\":[{\"role\":\"user\",\"content\":\"In one sentence, what does a file system snapshot keep?\"}]}"
echo " $(tr -d '\n' < /tmp/resp.json | sed 's/.*"usage":{\([^}]*\)}.*/\1/') $(tr -d '\n' < /tmp/resp.json | sed 's/.*"content":"\([^"]*\)".*/\1/' | cut -c1-120)"
S
B64=$(base64 -w0 call.sh)
run 11-install-call-script "$AX ssh $T -- sh -c 'echo $B64 | base64 -d > /workspace/call.sh; ls -la /workspace'"
echo "run	ssh_wall_s	http_code	curl_s	usage_and_answer" > 12-model-calls-running.tsv
for i in 1 2 3 4 5 6 7 8 9 10; do
  s=$(date +%s.%N); o=$($AX ssh $T -- sh /workspace/call.sh $i 2>&1 | tr '\n' ' '); w=$(el $s)
  printf '%s\t%s\t%s\t%s\t%s\n' $i $w "$(echo $o | cut -d' ' -f1)" "$(echo $o | cut -d' ' -f2)" "$(echo $o | cut -d' ' -f3- | cut -c1-200)" >> 12-model-calls-running.tsv
done
echo "turn	resume_s	call_ssh_wall_s	http_code	curl_s	suspend_s	total_s" > 13-turns-resume-call-suspend.tsv
$AX suspend task $T > /dev/null 2>&1; sleep 2
for i in 1 2 3 4 5 6 7 8 9 10; do
  s0=$(date +%s.%N); $AX resume task $T > /dev/null 2>&1; r=$(el $s0)
  s=$(date +%s.%N); o=$($AX ssh $T -- sh /workspace/call.sh $i 2>&1 | tr '\n' ' '); w=$(el $s)
  s=$(date +%s.%N); $AX suspend task $T > /dev/null 2>&1; u=$(el $s)
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' $i $r $w "$(echo $o | cut -d' ' -f1)" "$(echo $o | cut -d' ' -f2)" $u "$(el $s0)" >> 13-turns-resume-call-suspend.tsv
  sleep 2
done
run 14-egress-after "$KA get egress-policy $T -a default -o yaml"
$KC -n ate-system logs deploy/atenet-egress --since=6m 2>/dev/null | grep -i "ollama" | tail -3 | cut -c1-300 > 15-egress-gateway-lines.log
cat steps.tsv; for f in 06* 08* 10*; do echo "== $f"; grep -v "^Warning" $f | cut -c1-600 | head -14; done; cat 12-model-calls-running.tsv | cut -c1-230; cat 13-turns-resume-call-suspend.tsv
cat ../20-kagent/loop/actors-not-suspended-after-loop.txt | cut -c1-200
