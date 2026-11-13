E=~/evidence/K-kagent/agent; mkdir -p "$E"; cd "$E"
k() { sg docker -c "kubectl $*"; }
cp ~/scripts/mock_llm.py ~/scripts/mock-deploy.yaml ~/scripts/lab-agent.yaml "$E/"
k -n kagent create configmap mock-llm --from-file=mock_llm.py="$E/mock_llm.py" --dry-run=client -o yaml > cm.yaml
k apply -f cm.yaml -f mock-deploy.yaml 2>&1 | tee apply-mock.log
k -n kagent rollout status deploy/mock-llm --timeout=180s 2>&1 | tail -1
date -u +"apply %FT%T.%3NZ" | tee apply-agent.log
k apply -f lab-agent.yaml 2>&1 | tee -a apply-agent.log
for i in $(seq 1 90); do
  r=$(k -n kagent get agent lab-agent -o json | jq -r '[.status.conditions[]? | .type+"="+.status+"("+(.reason//"")+")"] | join(" ")')
  echo "$(date -u +%T.%3N) $r" | tee -a agent-conditions.trace
  echo "$r" | grep -q 'Ready=True' && break
  sleep 2
done
k -n kagent get harness,agenttemplate,agent,modelconfig -o wide 2>&1 | tee objects.txt
k -n kagent get agent lab-agent -o yaml > agent.yaml
k -n kagent get harness lab-harness -o yaml > harness.yaml
k -n kagent get agenttemplate lab-template -o yaml > agenttemplate.yaml
k -n kagent get modelconfig mock-model -o yaml > modelconfig.yaml
sed -n '/^status:/,$p' agent.yaml
sed -n '/^status:/,$p' harness.yaml
k -n kagent logs deploy/mock-llm --tail=20 > mock-after-ready.log 2>&1; cat mock-after-ready.log | cut -c1-300
if ! command -v kubectl-ate >/dev/null; then
  curl -fsSL -o /tmp/kubectl-ate https://github.com/kagent-dev/substrate/releases/download/v1.0.0/kubectl-ate-linux-amd64
  sudo install -m 755 /tmp/kubectl-ate /usr/local/bin/kubectl-ate
fi
sg docker -c "kubectl ate --help" 2>&1 | head -40
sg docker -c "kubectl ate get --help" 2>&1 | head -40
sg docker -c "kagent agent invoke --help" 2>&1 | head -30
sg docker -c "kagent agent list; kagent agent get lab-agent" 2>&1 | head -20
