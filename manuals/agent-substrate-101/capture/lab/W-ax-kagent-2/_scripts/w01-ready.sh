set -u
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin:$HOME/bin:/usr/local/bin
for c in kind-demo kind-kagent; do
  for i in $(seq 60); do
    n=$(kubectl --context $c get pods -A --no-headers 2>/dev/null | awk '$4!="Running" && $4!="Completed"' | wc -l)
    [ "$n" = 0 ] && break; sleep 5
  done
  echo "== $c not-running=$n after $((i*5)) s max; uptime $(cut -d' ' -f1 /proc/uptime)"
  kubectl --context $c get pods -A --no-headers 2>/dev/null | awk '$4!="Running" && $4!="Completed" {print $1,$2,$3,$4,$5}' | head
  kubectl --context $c get pods -A --no-headers | awk '{r+=$5} END{print "restarts total", r}'
done
export KUBECONFIG=~/kagent.kubeconfig
kubectl ate get actor -a kagent 2>&1 | awk '{print $1,$2,$3}' | head -24
kubectl ate get worker -a kagent 2>&1 | head -5
echo "== demo"
KUBECONFIG=~/.kube/config kubectl config use-context kind-demo >/dev/null
KUBECONFIG=~/.kube/config kubectl ate get worker 2>&1 | head -12
which ax kagent; ls ~/bin ~/go/bin 2>/dev/null | tr '\n' ' '; echo
~/go/bin/ax get task 2>&1 | head -12 || true
echo "== explain"
kubectl explain modelconfig.spec.openAI 2>&1 | grep -E "^  [a-zA-Z]" | tr '\n' ' '; echo
kubectl -n kagent get deploy kagent-controller -o jsonpath='{.spec.template.spec.containers[0].image}'; echo
kagent agent invoke --help 2>&1 | grep -i -E "timeout|stream|flag|--" | head -20
kagent version 2>&1 | head -5
