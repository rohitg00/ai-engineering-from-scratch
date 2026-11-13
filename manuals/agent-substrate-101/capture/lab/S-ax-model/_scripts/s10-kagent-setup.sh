set -u
E=~/evidence/S-ax-model/20-kagent; mkdir -p $E; cd $E
kind get kubeconfig --name kagent > ~/kagent.kubeconfig 2>/dev/null; export KUBECONFIG=~/kagent.kubeconfig
. ~/scripts/lib.sh
sg() { shift 2; bash -c "$1"; }
cat > 01-real-model.yaml <<'Y'
apiVersion: v1
kind: Service
metadata: {name: ollama, namespace: kagent}
spec:
  ports: [{name: http, port: 11434, targetPort: 11434}]
---
apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: ollama-1
  namespace: kagent
  labels: {kubernetes.io/service-name: ollama}
addressType: IPv4
ports: [{name: http, port: 11434, protocol: TCP}]
endpoints: [{addresses: ["172.18.0.5"]}]
---
apiVersion: api.kagent.dev/v1alpha3
kind: ModelConfig
metadata: {name: real-3b, namespace: kagent}
spec:
  provider: OpenAI
  model: qwen2.5:3b
  apiKeySecret: kagent-openai
  apiKeySecretKey: OPENAI_API_KEY
  stream: true
  openAI:
    baseUrl: http://ollama.kagent.svc.cluster.local:11434/v1
---
apiVersion: api.kagent.dev/v1alpha3
kind: ModelConfig
metadata: {name: real-1p5b, namespace: kagent}
spec:
  provider: OpenAI
  model: qwen2.5:1.5b
  apiKeySecret: kagent-openai
  apiKeySecretKey: OPENAI_API_KEY
  stream: true
  openAI:
    baseUrl: http://ollama.kagent.svc.cluster.local:11434/v1
---
apiVersion: api.kagent.dev/v1alpha3
kind: AgentTemplate
metadata: {name: real-3b-template, namespace: kagent}
spec:
  description: Lab agent with a real small model on CPU
  modelConfig: {name: real-3b}
  systemPrompt: You are a lab agent. Use the bash tool when the user asks you to run a command. Answer in one short sentence.
---
apiVersion: api.kagent.dev/v1alpha3
kind: AgentTemplate
metadata: {name: real-1p5b-template, namespace: kagent}
spec:
  description: Lab agent with a real small model on CPU
  modelConfig: {name: real-1p5b}
  systemPrompt: You are a lab agent. Use the bash tool when the user asks you to run a command. Answer in one short sentence.
---
apiVersion: api.kagent.dev/v1alpha3
kind: Agent
metadata: {name: real-3b, namespace: kagent}
spec:
  template: {ref: {name: real-3b-template}}
  harnessRef: {name: lab-harness}
---
apiVersion: api.kagent.dev/v1alpha3
kind: Agent
metadata: {name: real-1p5b, namespace: kagent}
spec:
  template: {ref: {name: real-1p5b-template}}
  harnessRef: {name: lab-harness}
Y
s=$(now); kubectl apply -f 01-real-model.yaml > 02-apply.log 2>&1; cat 02-apply.log
kubectl -n kagent run curl-ollama --rm -i --restart=Never --image=curlimages/curl -q -- -s -m 20 http://ollama.kagent.svc.cluster.local:11434/v1/models > 03-service-check.txt 2>&1; head -c 300 03-service-check.txt; echo
for a in real-3b real-1p5b; do
  for i in $(seq 120); do r=$(kubectl -n kagent get agent $a -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null); [ "$r" = True ] && break; sleep 1; done
  echo "$a ready=$r after $(echo "$(now) - $s" | bc) s" | tee -a 04-ready.txt
done
kubectl -n kagent get agent,modelconfig,agenttemplate -o wide > 05-objects.txt 2>&1; cat 05-objects.txt | cut -c1-200
kubectl ate get actor -a kagent > 06-actors.txt 2>&1; cat 06-actors.txt | cut -c1-200
echo 'Run the command `cat /proc/uptime` with the bash tool and tell me the first number.' > prompt.txt
: > timings.tsv
SID=$(new_session real-3b first3b); echo SID=$SID
turn first-3b "$SID" prompt.txt; tail -1 timings.tsv; cat first-3b.out | head -20; head -c 600 first-3b.err
jq -c '[.task.history[]? | {r:.role, p:[.parts[]? | (.text // (.data|tostring|.[0:200]))]}]' first-3b.json | cut -c1-2500
kubectl ate get actoregresspolicy -a kagent 2>&1 | head -5
docker logs ollama 2>&1 | grep GIN | tail -5
