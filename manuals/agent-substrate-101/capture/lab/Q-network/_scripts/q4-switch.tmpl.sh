DP=__DP__
export KUBECONFIG=$HOME/.kube/kind-kind.config
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
export ATE_INSTALL_KIND=true
G=~/evidence/Q-network/00-dataplane-switch-to-$DP; mkdir -p $G
pkill -f "proxy actor f-main" 2>/dev/null
kubectl -n ate-system get pods -o wide > $G/00-pods-before.txt
cd ~/substrate
s=$(date +%s)
sg docker -c "go run ./cmd/ate-setup deploy ate-system --credential-provider='{\"name\":\"k8s.io\"}' --ingress-allowed-spiffe-ids=spiffe://cluster.local/ns/ate-system/sa/atenet-client --image-repo ghcr.io/agent-substrate/substrate --image-tag v1.0.0 --atenet-dataplane=$DP" > $G/10-deploy.log 2>&1
rc=$?
echo "switch-to-$DP rc=$rc seconds=$(( $(date +%s) - s ))" | tee $G/11-timing.txt
tail -4 $G/10-deploy.log | cut -c1-300
kubectl -n ate-system rollout status deploy/atenet-egress --timeout=180s > /dev/null 2>&1
kubectl -n ate-system rollout status deploy/atenet-router --timeout=180s > /dev/null 2>&1
kubectl -n ate-system get pods -o wide > $G/12-pods-after.txt
kubectl -n ate-system get pods | grep -E 'atenet|credential'
kubectl -n ate-system get deploy atenet-egress -o json | jq -c '{containers:[.spec.template.spec.containers[]|{name,image:(.image|split("@")[0])}], has_extra_roots:([.spec.template.spec.volumes[]|select(.name=="extra-roots")]|length)}' | tee $G/13-egress-shape.json
kubectl -n ate-system get cm k8s-credential-provider-namespace-policy -o jsonpath='{.data}' | cut -c1-300 | tee $G/14-provider-policy-after-switch.txt; echo
kubectl ate get actors -a lab-f 2>&1 | grep -v Warning
sudo fstrim -v / | tail -1
echo SWITCH-DONE
