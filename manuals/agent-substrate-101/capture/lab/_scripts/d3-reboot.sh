export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
S=lab-c; E=~/evidence/D-durability; cd "$E"; T=40-node-reboot.tsv
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
now() { date -u +%FT%T.%3NZ; }
st() { kubectl ate get actor $1 -a $S -o json 2>/dev/null | jq -r '[.status.state, (.status.assignedNode // "-"), ((.status.snapshots // []) | map(.owner + ":" + (.durableSnapshot.state // "none") + ":gen" + (.generation|tostring) + ":" + (.locality // "-" | tostring)) | join(","))] | @tsv'; }
call() { curl -s -m 60 -o body.tmp -w '%{http_code}\t%{time_total}' "http://127.0.0.1:$1/"; printf '\t%s' "$(tr -d '\n' < body.tmp | cut -c1-170)"; }
m() { echo "$(now)	$1	$2" >> $T; }
kubectl -n ate-system get ds atelet -o json | jq '.spec.template.spec.containers |= map(if .name=="atelet" then .args |= map(select(test("snapshot-(upload|detach)-delay")|not)) else . end)' | kubectl apply -f - > 41-atelet-restore-defaults.log 2>&1
kubectl -n ate-system rollout status ds/atelet --timeout=180s >> 41-atelet-restore-defaults.log 2>&1
kubectl -n ate-system get ds atelet -o json | jq -r '.spec.template.spec.containers[] | select(.name=="atelet") | (.args | join(" "))' >> 41-atelet-restore-defaults.log
sleep 8
echo "ts	event	detail" > $T
K create actor r1 -a $S --template ballast-50 > /dev/null
(kubectl ate proxy actor r1 -a $S 8501:80 > proxy-r1.log 2>&1 &)
for t in $(seq 1 30); do grep -q Proxying proxy-r1.log 2>/dev/null && break; sleep 0.3; done
for i in 1 2 3; do m call "$(call 8501)"; done
K suspend actor r1 -a $S --mode sync > /dev/null; m after-sync-suspend "$(st r1)"
for i in 4 5; do m call "$(call 8501)"; done
K suspend actor r1 -a $S > /dev/null; m after-async-suspend "$(st r1)"
pkill -f "proxy actor r1"
m node-restart "docker restart kind-control-plane"
sg docker -c "docker restart kind-control-plane" > 42-restart.log 2>&1
s=$(date +%s)
for i in $(seq 1 120); do kubectl get nodes 2>/dev/null | grep -q " Ready" && break; sleep 3; done
m kube-api-back "$(( $(date +%s) - s )) s"
for i in $(seq 1 120); do
  nr=$(kubectl get pods -A --no-headers 2>/dev/null | grep -v -E "Running|Completed" | wc -l)
  [ "$nr" = "0" ] && kubectl ate get actor r1 -a $S >/dev/null 2>&1 && break; sleep 5
done
m pods-ready "$(( $(date +%s) - s )) s, not-running=$nr"
kubectl get pods -A --no-headers | grep -v -E "Running|Completed" > 43-not-running.txt
m state-after-reboot "$(st r1)"
(kubectl ate proxy actor r1 -a $S 8501:80 > proxy-r1.log 2>&1 &)
for t in $(seq 1 40); do grep -q Proxying proxy-r1.log 2>/dev/null && break; sleep 0.5; done
m call-after-reboot "$(call 8501)"; m state "$(st r1)"
sleep 5; m call-again "$(call 8501)"; m state "$(st r1)"
K get actor r1 -a $S -o yaml > 44-r1-after-reboot.yaml
m revert "$(K revert actor r1 -a $S | tr '\n' ' ' | cut -c1-200)"
m call-after-revert "$(call 8501)"; m state "$(st r1)"
K get actors -a ate-demo-counter > 45-other-actors.txt 2>&1
sudo fstrim -v / > /dev/null
echo DONE >> $T
cut -c1-250 $T
