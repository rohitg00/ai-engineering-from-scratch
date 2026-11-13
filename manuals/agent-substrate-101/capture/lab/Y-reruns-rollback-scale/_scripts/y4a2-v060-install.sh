set -u
export PATH=/usr/local/go/bin:$HOME/go/bin:$PATH
O=$HOME/evidence/Y-reruns-rollback-scale/40-v060/00-install; cd $HOME/u/old
export KIND_CLUSTER_NAME=y060
st() { printf '%s\t%s\t%s\n' "$1" "$2" "$3" >> $O/steps.tsv; }
cp $O/30-deploy-demo.log $O/30a-deploy-demo-first.log 2>/dev/null
s=$(date +%s); hack/install-ate-kind.sh deploy ate-system --credential-provider='{"name":"k8s.io"}' --ingress-allowed-spiffe-ids=spiffe://cluster.local/ns/ate-system/sa/atenet-client > $O/21-deploy-ate-system-with-ingress-id.log 2>&1; st 21-deploy-ate-system-with-ingress-id $? $(( $(date +%s)-s ))
s=$(date +%s); hack/install-ate-kind.sh deploy demo-counter > $O/31-deploy-demo.log 2>&1; st 31-deploy-demo $? $(( $(date +%s)-s ))
kubectl --context kind-y060 get pods -A -o wide > $O/40-pods.txt 2>&1
kubectl --context kind-y060 get pods -A -o jsonpath='{range .items[*]}{range .spec.containers[*]}{.image}{"\n"}{end}{end}' | sort -u > $O/41-images.txt 2>&1
df -h / | tail -1 > $O/42-disk-after.txt
echo DONE2 >> $O/steps.tsv
