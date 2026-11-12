date -u +%T
cat ~/evidence/K-kagent/install/steps.tsv
sg docker -c "helm list -A 2>/dev/null | cut -c1-130; kubectl get pods -A --no-headers 2>/dev/null | grep -v -E 'kube-system|local-path' | cut -c1-120"
tail -n 15 ~/evidence/K-kagent/install/40-kagent-install.log | cut -c1-300
