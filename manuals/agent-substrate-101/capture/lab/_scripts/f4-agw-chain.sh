export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
export ATE_INSTALL_KIND=true
E=~/evidence/F-egress/agentgateway; mkdir -p "$E"; cd "$E"
cp ../envoy/03-marker-*.txt ../envoy/targets.yaml ../envoy/shell-template.yaml ../envoy/02-shellprobe-image.txt . 2>/dev/null
kubectl -n ate-system get pods -o wide | grep -E 'atenet|credential' > 00-pods.txt
kubectl ate get actors -a lab-f 2>&1 | grep -v Warning > 00-actors-after-switch.txt
s=$(date +%s)
(cd ~/substrate && sg docker -c "./demos/egress/test-egress.sh") > 01-official-test-egress.log 2>&1
echo "official-test-egress rc=$? seconds=$(( $(date +%s) - s ))" | tee 00-timing.txt
kubectl apply -f targets.yaml > 03-apply-targets.log 2>&1
sleep 5
kubectl apply -f targets.yaml >> 03-apply-targets.log 2>&1
kubectl -n egress-target rollout status deploy/whoami --timeout=120s >> 03-apply-targets.log 2>&1
kubectl -n egress-target rollout status deploy/drip --timeout=120s >> 03-apply-targets.log 2>&1
kubectl get svc -n egress-target > 07-targets.txt
bash ~/scripts/f2-tests-agw.sh > f2.log 2>&1
bash ~/scripts/f3-supplement-agw.sh > f3.log 2>&1
echo CHAIN-DONE
