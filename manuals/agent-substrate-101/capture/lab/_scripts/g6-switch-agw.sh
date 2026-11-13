export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
export ATE_INSTALL_KIND=true
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
E=~/evidence/E-dependency-loss
K get actors -a lab-e | grep -v -E 'RUNNING|SUSPENDED' > $E/21-nonsteady-actors-after.txt
sleep 1
K get actors -a lab-e | awk '{print $4}' | sort | uniq -c > $E/22-actors-5min-later.txt
cat $E/21-nonsteady-actors-after.txt $E/22-actors-5min-later.txt
for a in $(K get actors -a lab-e -o json | jq -r '.. | objects | select(.actorTemplate? != null) | .metadata.name' | sort -u); do K delete actor $a -a lab-e > /dev/null; done
kubectl delete workerpool e-pool -n lab-e --wait=false > /dev/null 2>&1
kubectl delete pod e-prober -n ate-system --wait=false > /dev/null 2>&1
K get actors -a lab-e | wc -l
G=~/evidence/G-dataplane/01-switch-in-place; mkdir -p $G
kubectl -n ate-system get pods -o wide > $G/00-pods-before.txt
cd ~/substrate
s=$(date +%s)
sg docker -c "go run ./cmd/ate-setup deploy ate-system --credential-provider='{\"name\":\"k8s.io\"}' --ingress-allowed-spiffe-ids=spiffe://cluster.local/ns/ate-system/sa/atenet-client --image-repo ghcr.io/agent-substrate/substrate --image-tag v1.0.0 --atenet-dataplane=agentgateway" > $G/10-deploy-agentgateway-in-place.log 2>&1
rc=$?
echo "switch-in-place rc=$rc seconds=$(( $(date +%s) - s ))" | tee $G/11-timing.txt
tail -6 $G/10-deploy-agentgateway-in-place.log | cut -c1-300
kubectl -n ate-system get pods -o wide > $G/12-pods-after.txt
kubectl -n ate-system get pods | grep -E 'atenet|credential'
sudo fstrim -v / | tail -1
echo SWITCH-DONE
