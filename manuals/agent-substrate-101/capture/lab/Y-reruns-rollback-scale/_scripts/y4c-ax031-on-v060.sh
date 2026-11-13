set -u
export PATH=/usr/local/go/bin:$HOME/go/bin:$PATH GOWORK=off
E=$HOME/evidence/Y-reruns-rollback-scale/40-v060/40-ax031; mkdir -p $E
TL=$HOME/evidence/Y-reruns-rollback-scale/40-v060/00-timeline.tsv
tl() { echo "$(date +%s)	$(date -u +%T)	$*" >> $TL; }
run() { n="$1"; shift; s=$(date +%s); bash -c "$*" > "$E/$n.log" 2>&1; rc=$?; printf '%s\t%s\t%s\n' "$n" "$rc" "$(( $(date +%s)-s ))" >> $E/steps.tsv; return $rc; }
NS=ax031-system; SA_C=system:serviceaccount:$NS:ax-controller; SA_S=system:serviceaccount:$NS:ax-server
tl ax031-begin
cd $HOME/u/old; export KIND_CLUSTER_NAME=y060
run 00-delete-y060 "hack/kind.sh delete cluster --name y060"
run 01-kind "hack/create-kind-cluster.sh"
hack/kind.sh get kubeconfig --name y060 > $HOME/u/kc-y060; export KUBECONFIG=$HOME/u/kc-y060
run 02-deploy-v060 "hack/install-ate-kind.sh deploy ate-system --credential-provider='{\"name\":\"k8s.io\"}' --ingress-allowed-spiffe-ids=spiffe://cluster.local/ns/ate-system/sa/atenet-client,spiffe://cluster.local/ns/$NS/sa/ax-server --ateapi-authz-bootstrap-owners=system:serviceaccount:ate-system:ate-client,$SA_C,$SA_S"
tl v060-up
[ -d $HOME/ax ] || run 10-clone "git clone -q https://github.com/google/ax $HOME/ax"
cd $HOME/ax; git checkout -q v0.3.1; git log -1 --format='%H %cd' > $E/11-ax-commit.txt
grep -n -E "substrate|^go " go.mod > $E/12-gomod.txt
run 13-go-build "mkdir -p bin bin/linux_amd64 && CGO_ENABLED=0 go build -o bin/ ./cmd/... && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o bin/linux_amd64/ ./cmd/..."
ls -la bin bin/linux_amd64 > $E/14-bins.txt 2>&1
mkdir -p /tmp/ax031-img
for b in ax-server ax-controller; do
  cp bin/$b /tmp/ax031-img/$b
  printf 'FROM scratch\nCOPY %s /%s\nENTRYPOINT ["/%s"]\n' $b $b $b > /tmp/ax031-img/Dockerfile.$b
  run 20-image-$b "docker build -q -t localhost:5001/ax031-$b:v0.3.1 -f /tmp/ax031-img/Dockerfile.$b /tmp/ax031-img && docker push -q localhost:5001/ax031-$b:v0.3.1"
done
run 21-task-runner-image "docker build -t localhost:5001/ax031-task-runner:v0.3.1 -f Dockerfile.task-runner . && docker push localhost:5001/ax031-task-runner:v0.3.1"
DIG=$(grep -o 'sha256:[0-9a-f]\{64\}' $E/21-task-runner-image.log | tail -1); echo "$DIG" > $E/22-digest.txt
for f in redis ax-controller ax-server; do
  sed -e "s|ax-system|$NS|g" -e "s|ko://github.com/google/ax/cmd/ax-server|localhost:5001/ax031-ax-server:v0.3.1|" -e "s|ko://github.com/google/ax/cmd/ax-controller|localhost:5001/ax031-ax-controller:v0.3.1|" deploy/$f.yaml > $E/30-$f.rendered.yaml
done
run 40-apply "kubectl apply -f $E/30-redis.rendered.yaml && kubectl apply -f $E/30-ax-controller.rendered.yaml && kubectl apply -f $E/30-ax-server.rendered.yaml"
kubectl label ns $NS ate.dev/api-access=true > $E/41-label.log 2>&1
run 42-rollout "kubectl -n $NS rollout status deploy --timeout=180s"
kubectl -n $NS get pods -o wide > $E/43-pods.txt 2>&1
kubectl -n $NS logs deploy/ax-controller --tail=40 > $E/44-controller.log 2>&1
kubectl -n $NS logs deploy/ax-server --tail=40 > $E/45-server.log 2>&1
cat > $E/50-task.yaml <<EOF
apiVersion: ax.io/v1alpha1
kind: Task
metadata:
  name: ax031-install-check
  atespace: default
spec:
  image: "localhost:5001/ax031-task-runner@$DIG"
  command: ["sleep", "infinity"]
EOF
AX="$HOME/ax/bin/ax -n $NS"
run 51-version "$AX version; $AX ctx"
run 52-apply "$AX apply -f $E/50-task.yaml"
sleep 10
run 53-describe "$AX describe task ax031-install-check; $AX get tasks"
s=$(date +%s.%N); run 54-resume "$AX resume task ax031-install-check"
sleep 15
run 55-describe-after-resume "$AX describe task ax031-install-check"
run 56-ssh "timeout 60 $AX ssh ax031-install-check -- echo installation-ok"
run 57-suspend "$AX suspend task ax031-install-check; sleep 5; $AX describe task ax031-install-check"
kubectl -n $NS logs deploy/ax-controller --since=10m > $E/60-controller-after.log 2>&1
kubectl -n ate-system logs deploy/ate-api-server --since=10m 2>/dev/null | grep -v "Handle RPC" | tail -30 | cut -c1-400 > $E/61-ateapi.log
kubectl get pods -A > $E/62-pods-all.txt 2>&1
$AX tunnel stop > /dev/null 2>&1
tl ax031-done
echo DONE >> $E/steps.tsv
