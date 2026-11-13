. ~/scripts/y-lib.sh
OLD=v1.0.0-rc.3
usecluster yupg
export PATH=$U/bin-rc3:$PATH
O=$EV/20-upgrade/10-before; mkdir -p $O; cd $O
S=up-lab
which kubectl-ate > 00-cli.txt; kubectl ate version >> 00-cli.txt 2>&1
IMG=$(docker inspect --format '{{index .RepoDigests 0}}' localhost:5001/u-drill:v1)
IMGT=$(docker inspect --format '{{index .RepoDigests 0}}' localhost:5001/u-drill:v2-trap)
cat > pool.yaml <<EOF
apiVersion: v1
kind: Namespace
metadata: {name: $S}
---
apiVersion: ate.dev/v1
kind: WorkerPool
metadata: {name: up-pool, namespace: $S, labels: {workload: up-pool}}
spec:
  replicas: 10
  workerImage: ghcr.io/agent-substrate/substrate/ateworker-gvisor:$OLD
  sandboxClasses:
  - name: gvisor
  template:
    resources:
      limits: {cpu: "1", memory: 1Gi}
      requests: {cpu: 100m, memory: 128Mi}
EOF
tmpl() {
cat <<EOF
metadata: {atespace: $S, name: $1}
workerSelector:
  matchLabels: {workload: up-pool}
containers:
- name: drill
  image: $2
  wakeupProbe:
    httpGet: {path: /readyz, port: 80}
resources:
  limits: {cpuMillicores: 500, memoryBytes: 134217728}
snapshotConfig:
  preferredFidelity: SNAPSHOT_FIDELITY_MEMORY
EOF
}
tmpl up-drill $IMG > template.yaml; tmpl up-trap $IMGT > template-trap.yaml
kubectl apply -f pool.yaml > 01-setup.log 2>&1
K create atespace $S >> 01-setup.log
K create actor-template -f template.yaml >> 01-setup.log
K create actor-template -f template-trap.yaml >> 01-setup.log
kubectl -n $S rollout status deploy/up-pool --timeout=300s >> 01-setup.log 2>&1
for i in $(seq 1 90); do [ "$(K get actor-templates -a $S | grep -c -E 'up-(drill|trap) +[0-9a-f-]{36}')" = 2 ] && break; sleep 2; done
K get actor-templates -a $S | tee -a 01-setup.log
mkprober >> 01-setup.log 2>&1
cat > req.sh <<'EOF'
curl -s -m ${2:-20} -o /tmp/r.$$ -w '%{http_code}\t%{time_total}\t' --cacert /run/ca/trust-bundle.pem --cert /run/id/credential-bundle.pem --key /run/id/credential-bundle.pem -X POST -H "ate-target-actor: up-lab/$1" https://atenet-router.ate-system.svc:443/
head -c 140 /tmp/r.$$ | tr '\n\t' '  '; echo; rm -f /tmp/r.$$
EOF
kubectl -n ate-system exec -i u-prober -- sh -c 'cat > /tmp/req.sh' < req.sh
R() { PX "sh /tmp/req.sh $*"; }
{
for a in a-run a-sync a-def a-tag a-cyc; do K create actor $a -a $S --template up-drill | tail -1; for i in 1 2 3; do echo "$a: $(R $a)"; done; done
K create actor a-term -a $S --template up-trap | tail -1; for i in 1 2 3; do echo "a-term: $(R a-term)"; done
K suspend actor a-sync -a $S --mode sync
K suspend actor a-def -a $S
for i in 4 5; do echo "a-tag: $(R a-tag)"; done
K suspend actor a-tag -a $S --mode sync
K create tag pre-up -a $S --actor a-tag; K get tags -a $S
K create actor a-fresh -a $S --template up-drill | tail -1
sleep 5
K get actors -a $S
} > 10-actors.txt 2>&1
kubectl get pods -A -o json | jq -r '.items[]|.metadata.namespace+"/"+.metadata.name+"\t"+([.spec.containers[].image]|join(","))' > 13-images-before.txt
kubectl get workerpools -A -o custom-columns='NAMESPACE:.metadata.namespace,NAME:.metadata.name,CLASS:.spec.sandboxClasses[0].name,IMAGE:.spec.workerImage' > 14-workerpools-before.txt
kubectl -n ate-system exec postgres-0 -c postgres -- psql -U postgres -d atepg -Atc "select * from substrate.schema_migrations" > 15-schema-migrations-before.txt 2>&1
kubectl get crd -o json | jq -r '.items[]|select(.spec.group|test("ate"))|.metadata.name+"\t"+(.spec.versions[0].schema.openAPIV3Schema|tostring|length|tostring)' > 16-crds-before.txt 2>&1
kubectl get sandboxconfigs -A -o yaml > 17-sandboxconfigs-before.yaml 2>&1
echo DONE > 99-done; tail -14 10-actors.txt
