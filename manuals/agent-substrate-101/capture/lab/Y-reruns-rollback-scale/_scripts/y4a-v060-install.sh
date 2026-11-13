set -u
export PATH=/usr/local/go/bin:$HOME/go/bin:$PATH
O=$HOME/evidence/Y-reruns-rollback-scale/40-v060/00-install; mkdir -p $O; cd $HOME/u/old
export KIND_CLUSTER_NAME=y060
st() { printf '%s\t%s\t%s\n' "$1" "$2" "$3" >> $O/steps.tsv; }
{ git describe --tags; git rev-parse HEAD; df -h / | tail -1; } > $O/00-checkout.txt
s=$(date +%s); hack/create-kind-cluster.sh > $O/10-kind-cluster.log 2>&1; st 10-kind-cluster $? $(( $(date +%s)-s ))
df -h / | tail -1 >> $O/00-checkout.txt
s=$(date +%s); hack/install-ate-kind.sh deploy ate-system --credential-provider='{"name":"k8s.io"}' > $O/20-deploy-ate-system.log 2>&1; st 20-deploy-ate-system $? $(( $(date +%s)-s ))
s=$(date +%s); hack/install-ate-kind.sh deploy demo-counter > $O/30-deploy-demo.log 2>&1; st 30-deploy-demo $? $(( $(date +%s)-s ))
kubectl --context kind-y060 get pods -A -o wide > $O/40-pods.txt 2>&1
kubectl --context kind-y060 get pods -A -o jsonpath='{range .items[*]}{range .spec.containers[*]}{.image}{"\n"}{end}{end}' | sort -u > $O/41-images.txt 2>&1
df -h / | tail -1 > $O/42-disk-after.txt
echo DONE >> $O/steps.tsv
