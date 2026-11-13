set -u
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin:$HOME/bin:/usr/local/bin
sleep 45
echo "== 8083"; ss -ltnp 2>/dev/null | grep -E ":8083|:8000|:18080" | cut -c1-140
ps aux | grep -E "port-forward|kagent" | grep -v grep | cut -c1-160 | head
grep -rn "port-forward\|8083\|api-url" ~/scripts/*.sh 2>/dev/null | grep -v "^.*w0" | cut -c1-200 | head -12
echo "== ax"; find ~ /usr/local/bin -maxdepth 4 -name "ax" -type f 2>/dev/null | head; ls ~/ax/bin 2>/dev/null
echo "== kagent workers"
KUBECONFIG=~/kagent.kubeconfig kubectl ate get worker -a kagent 2>&1 | tail -4
KUBECONFIG=~/kagent.kubeconfig kubectl get pods -n kagent --no-headers | cut -c1-90
KUBECONFIG=~/kagent.kubeconfig kubectl ate get actor -a kagent 2>&1 | awk 'NR>1{print $3}' | sort | uniq -c
KUBECONFIG=~/kagent.kubeconfig kubectl ate get actor -a kagent -o wide 2>&1 | awk 'NR>1{for(i=1;i<=NF;i++) if($i ~ /ACTOR_STATE|SUSPENDED|RUNNING|CRASHED/) print $i}' | sort | uniq -c
echo "== demo"
kubectl --context kind-demo -n ate-system get pods --no-headers | awk '{print $1,$2,$3,$4}'
kubectl config current-context
kubectl ate get worker 2>&1 | tail -12
kubectl ate get actor 2>&1 | cut -c1-150 | tail -12
kubectl ate get actor -A 2>&1 | cut -c1-150 | tail -12
