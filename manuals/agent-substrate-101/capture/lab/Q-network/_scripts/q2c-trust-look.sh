export KUBECONFIG=$HOME/.kube/kind-kind.config
E=~/evidence/Q-network/i-model-gateway; cd "$E"
echo "--- egress log lines around the failure"
kubectl -n ate-system logs deploy/atenet-egress --all-containers --since=10m 2>/dev/null | grep -i -E "UnknownIssuer|invalid peer certificate|certificate|upstream connection|BadCertificate|error" | grep -v "Not resuming" | tail -8 | cut -c1-700
echo "--- egress deployment volumes and mounts"
kubectl -n ate-system get deploy atenet-egress -o json | jq -c '.spec.template.spec | {volumes:[.volumes[]|{name, src:(del(.name)|keys)}], mounts:[.containers[0].volumeMounts[]|{name,mountPath}], env:[.containers[0].env[]|.name]}'
echo "--- config keys that mention tls, root, ca, trust, backend"
CM=$(kubectl -n ate-system get deploy atenet-egress -o json | jq -r '.spec.template.spec.volumes[] | select(.configMap) | .configMap.name' | head -1)
echo "configmap: $CM"
kubectl -n ate-system get cm $CM -o json | jq -r '.data | to_entries[] | "## " + .key + "\n" + .value' > 40-egress-agentgateway-config.yaml
wc -l 40-egress-agentgateway-config.yaml
grep -n -i -E "tls|root|trust|insecure|backend|verif|ca" 40-egress-agentgateway-config.yaml | cut -c1-200 | head -50
