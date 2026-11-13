cd ~/evidence/K-kagent
echo "=== mock GET lines"; grep '"m": "GET"' session1/mock.log | cut -c1-400
echo "=== mock auth values"; jq -r 'select(.m=="POST") | .auth' session1/mock.log 2>/dev/null | sort | uniq -c
echo "=== mock tools list"; jq -c 'select(.m=="POST") | .tools' session1/mock.log 2>/dev/null | sort -u
echo "=== egress log: sample of deny lines"; grep -i -E "403|denied|forbidden|reject|1\.1\.1\.1|mock-llm.kagent:" session1/atenet-egress.log | cut -c1-420 | head -12
echo "=== egress log levels"; grep -o -E '"level":"[a-z]+"|\b(DEBUG|INFO|WARN|ERROR|TRACE|debug|info|warn|error|trace)\b' session1/atenet-egress.log | sort | uniq -c | sort -rn | head
echo "=== agw env / ports / mounts"
for d in atenet-router atenet-egress; do echo "--- $d"; yq_out=$(cat inventory/deploy-$d.yaml); echo "$yq_out" | grep -n -E '^\s+- name: [A-Z_]+$|^\s+value: |containerPort:|mountPath:|secretName:|^\s+- --|^\s+image:|configMap:|^\s+name: .*(ca|key|mitm|tls)' | cut -c1-160 | head -60; done
echo "=== helm values kagent (user-supplied)"; cat inventory/helm-values-kagent-user.yaml | head -60
echo "=== actor template key fields"; grep -n -E 'cpu|memory|fidelity|golden|probe|readyz|port|image:|storageLocation|mountPath|durable|name:' session1/actor-template.yaml | cut -c1-170 | head -70
echo "=== router log sample"; head -5 session1/atenet-router.log | cut -c1-400
echo "=== controller log suspend/resume lines"; grep -i -E "suspend|resume|actor" session1/kagent-controller.log | cut -c1-330 | head -20
echo "=== k8s egresspolicies"; cat session1/k8s-egresspolicies.yaml | head -20
echo "=== workerpool pod security"; sg docker -c "kubectl -n kagent get pod -l ate.dev/worker-pool=kagent-default -o json" 2>/dev/null | jq -c '.items[0].spec.containers[] | {name, securityContext, resources}' 2>/dev/null | cut -c1-600
sg docker -c "kubectl -n kagent get pods --show-labels" | cut -c1-260 | head
