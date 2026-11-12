set -u
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin:$HOME/bin:/usr/local/bin
echo "== guest"; uptime | cut -c1-60; free -g | sed -n 2p; df -h / | tail -1
echo "== docker"; docker ps -a --format '{{.Names}} {{.Status}}' | head -20
docker start ollama 2>&1 | tail -1
sleep 3
docker inspect ollama --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}={{$v.IPAddress}} {{end}}'
curl -s -m 10 http://127.0.0.1:11434/api/tags | jq -r '.models[].name' 2>&1 | head
for c in kind-demo kind-kagent; do
  echo "== $c"; kubectl --context $c get nodes --no-headers 2>&1 | cut -c1-100
  kubectl --context $c get pods -A --no-headers 2>&1 | awk '$4!="Running" && $4!="Completed" {print $1,$2,$3,$4,$5}' | head -30
  echo "pods total: $(kubectl --context $c get pods -A --no-headers 2>/dev/null | wc -l)"
  kubectl --context $c get workerpools -A 2>&1 | head -12
done
echo "== endpoints"
kubectl --context kind-kagent -n kagent get endpointslice ollama-1 -o jsonpath='{.endpoints[*].addresses}' 2>&1; echo
kubectl --context kind-demo -n ax-system get endpointslice -o wide 2>&1 | grep -i ollama
echo "== ate"
kubectl --context kind-demo ate get worker -a default 2>&1 | head -12
kubectl --context kind-kagent ate get actor -a kagent 2>&1 | head -20
echo "== ax"; ls ~ | tr '\n' ' '; echo; (cd ~/ax 2>/dev/null && git log --oneline -1)
ax get task 2>&1 | head -12
ls ~/scripts/lib.sh && sed -n 1,80p ~/scripts/lib.sh
