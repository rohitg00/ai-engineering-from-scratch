export KUBECONFIG=$HOME/.kube/kind-kind.config
Q=~/evidence/Q-network
cd $Q/k-suspend-cutoff/envoy; echo "--- k envoy"; cat 10-events.tsv; tail -2 12-drip-server-after-suspend.log | cut -c1-140; echo "lines after suspend: $(wc -l < 12-drip-server-after-suspend.log) after resume: $(wc -l < 14-drip-server-after-resume.log)"; grep -A3 "k2-after-resume" results.txt | tail -3
cd $Q/i-model-gateway
echo "--- envoy results for the TLS gateway"
grep -A6 "b1-tls-gw-fast" 20-results-envoy.txt | tail -5 | cut -c1-300
kubectl -n ate-system logs deploy/atenet-egress -c envoy --since=15m 2>/dev/null | grep -i -E "CERTIFICATE_VERIFY_FAILED|verify|unknown ca|TLS_error|upstream_reset|503" | tail -4 | cut -c1-500 | tee 44-envoy-egress-503.excerpt.log
echo "--- where envoy takes upstream roots"
kubectl -n ate-system get deploy atenet-egress -o json | jq -c '[.spec.template.spec.containers[]|{name, args:(.args//[]|join(" ")|.[0:200]), mounts:[.volumeMounts[]|.mountPath]}]' | cut -c1-900
for cm in $(kubectl -n ate-system get deploy atenet-egress -o json | jq -r '.spec.template.spec.volumes[]|select(.configMap)|.configMap.name'); do echo "configmap $cm"; kubectl -n ate-system get cm $cm -o json | jq -r '.data|to_entries[]|.value' | grep -n -i -E "trusted_ca|ca-certificates|system_root|validation_context|filename:" | cut -c1-160 | head -20; done
kubectl -n ate-system logs deploy/atenet-egress -c ext-proc --since=15m 2>/dev/null | grep -i -E "ca-certificates|system roots|trust" | tail -3 | cut -c1-300
