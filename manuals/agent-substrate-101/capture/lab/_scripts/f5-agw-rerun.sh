export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
E=~/evidence/F-egress/agentgateway; cd "$E"
mkdir -p first-run-targets-missing
mv 20-results.txt 40-supplement.txt t-*.json s-*.json 21-t4-timeline.txt 22-drip-server.log 31-log-*.log 32-marker-in-logs.txt f2.log f3.log first-run-targets-missing/ 2>/dev/null
until ! kubectl get ns egress-target 2>/dev/null | grep -q Terminating; do sleep 3; done
kubectl apply -f targets.yaml > 03-apply-targets.log 2>&1
kubectl -n egress-target rollout status deploy/whoami --timeout=120s >> 03-apply-targets.log 2>&1
kubectl -n egress-target rollout status deploy/drip --timeout=120s >> 03-apply-targets.log 2>&1
kubectl get svc,pods -n egress-target -o wide > 07-targets.txt
cat 07-targets.txt | cut -c1-110
bash ~/scripts/f2-tests-agw.sh > f2.log 2>&1
bash ~/scripts/f3-supplement-agw.sh > f3.log 2>&1
echo RERUN-DONE
