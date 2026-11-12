export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
date -u +%T
ps -eo etimes,cmd | grep -E "scripts/[a-z0-9-]+\.sh" | grep -v grep | cut -c1-100
kubectl get nodes --no-headers
kubectl get pods -A --no-headers | grep -v -E "Running|Completed" | head
K get workers
K get actor-templates -a lab-c
K get actors -a lab-c
kubectl get workerpool -A
kubectl -n ate-system get ds atelet -o json | jq -r '.spec.template.spec.containers[] | select(.name=="atelet") | (.args|join(" "))'
df -h / | tail -1; free -g | sed -n 2p
ls ~/ballast; grep -n "fill" ~/ballast/main.go | head
ls ~/substrate/docs/guides ~/substrate/docs/reference ~/substrate/docs/concepts 2>/dev/null
