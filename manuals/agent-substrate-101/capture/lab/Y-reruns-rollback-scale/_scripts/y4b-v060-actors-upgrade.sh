set -u
export PATH=$HOME/u/bin-old:/usr/local/go/bin:$HOME/go/bin:$PATH
EV=$HOME/evidence/Y-reruns-rollback-scale/40-v060
NS=ate-demo-counter
cd $HOME/u/old
hack/kind.sh get kubeconfig --name y060 > $HOME/u/kc-y060
export KUBECONFIG=$HOME/u/kc-y060
TL=$EV/00-timeline.tsv
tl() { echo "$(date +%s)	$(date -u +%T)	$*" >> $TL; }
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
schema() { for db in atepg ate postgres; do kubectl -n ate-system exec postgres-0 -c postgres -- psql -U postgres -d $db -Atc "select * from substrate.schema_migrations" 2>&1 && break; done; }
req() { curl -s -m 20 -X POST -H "ate-target-actor: $NS/$1" -w '\t%{http_code}\t%{time_total}' http://localhost:8000/ 2>&1 | tr '\n' ' '; echo; }

O=$EV/10-before; mkdir -p $O
tl actors-begin
kubectl -n ate-system port-forward svc/atenet-router 8000:80 > $O/pf.log 2>&1 &
PF=$!; sleep 5
for a in c-run c-susp c-sync c-fresh; do K create actor $a -a $NS --template counter >> $O/01-create.txt; done
sleep 5
for a in c-run c-susp c-sync; do for i in 1 2 3; do echo "$a $(req $a)"; done; done > $O/02-requests.txt
K suspend actor c-susp -a $NS > $O/03-suspend.txt 2>&1
K suspend actor c-sync -a $NS --mode sync >> $O/03-suspend.txt 2>&1
K suspend --help > $O/03-suspend-help.txt 2>&1
sleep 10
K get actors -a $NS > $O/04-actors.txt
K version > $O/05-cli-version.txt 2>&1
schema > $O/06-schema.txt 2>&1
kubectl -n ate-system get deploy,sts,ds -o wide > $O/07-workloads.txt 2>&1
kubectl get workerpools -A -o yaml > $O/08-workerpools.yaml 2>&1
kubectl get crd | grep -i ate > $O/09-crds.txt 2>&1
kill $PF
tl actors-done

O=$EV/20-direct-upgrade; mkdir -p $O
cd $HOME/u/new; git describe --tags > $O/00-checkout.txt
export ATE_INSTALL_KIND=true KIND_CLUSTER_NAME=y060
tl direct-upgrade-begin
s=$(date +%s)
timeout 1200 go run ./cmd/ate-setup deploy ate-system --credential-provider='{"name":"k8s.io"}' --ingress-allowed-spiffe-ids=spiffe://cluster.local/ns/ate-system/sa/atenet-client --image-repo ghcr.io/agent-substrate/substrate --image-tag v1.0.0 > $O/10-deploy.log 2>&1
rc=$?; tl "direct-upgrade-end rc=$rc seconds=$(( $(date +%s)-s ))"
export PATH=$HOME/u/bin-new:$PATH
kubectl get pods -A -o wide > $O/20-pods.txt 2>&1
kubectl -n ate-system logs deploy/ate-api-server --tail=80 > $O/21-ateapi.log 2>&1
kubectl -n ate-system logs deploy/ate-api-server --previous --tail=80 > $O/21b-ateapi-previous.log 2>&1
schema > $O/22-schema.txt 2>&1
K get actors -a $NS > $O/23-actors.txt
kubectl get workerpools -A -o custom-columns='NS:.metadata.namespace,NAME:.metadata.name,IMAGE:.spec.workerImage' > $O/24-workerpools.txt 2>&1
for a in c-run c-susp c-sync c-fresh; do
  echo "== $a"; s0=$(date +%s.%N)
  K resume actor $a -a $NS 2>&1 | tail -2
  echo "resume cmd $(awk -v a=$s0 -v b=$(date +%s.%N) 'BEGIN{printf "%.2f", b-a}') s"
  K get actor $a -a $NS 2>&1 | tail -1
done > $O/25-resume.txt 2>&1
for a in c-run c-susp c-sync c-fresh; do
  ( timeout 25 kubectl ate proxy actor $a -a $NS > $O/26-proxy-$a.log 2>&1 & ); sleep 6
  echo "$a $(curl -s -m 15 -X POST -w '\t%{http_code}\t%{time_total}' http://localhost:8000/ 2>&1 | tr '\n' ' ')"
  sleep 20
done > $O/27-requests.txt 2>&1
tl direct-upgrade-checked

O=$EV/30-reinstall; mkdir -p $O
tl reinstall-begin
s=$(date +%s)
timeout 600 go run ./cmd/ate-setup delete all > $O/10-delete.log 2>&1
tl "delete-all-end rc=$? seconds=$(( $(date +%s)-s ))"
kubectl get ns > $O/11-ns-after-delete.txt 2>&1
kubectl get pvc -A > $O/12-pvc-after-delete.txt 2>&1
s=$(date +%s)
timeout 1200 go run ./cmd/ate-setup deploy ate-system --credential-provider='{"name":"k8s.io"}' --ingress-allowed-spiffe-ids=spiffe://cluster.local/ns/ate-system/sa/atenet-client --image-repo ghcr.io/agent-substrate/substrate --image-tag v1.0.0 > $O/20-deploy.log 2>&1
tl "reinstall-deploy-end rc=$? seconds=$(( $(date +%s)-s ))"
kubectl get pods -A > $O/21-pods.txt 2>&1
schema > $O/22-schema.txt 2>&1
K get atespaces > $O/23-atespaces.txt 2>&1
K get actors -a $NS > $O/24-actors.txt 2>&1
tl reinstall-checked
echo DONE >> $TL
