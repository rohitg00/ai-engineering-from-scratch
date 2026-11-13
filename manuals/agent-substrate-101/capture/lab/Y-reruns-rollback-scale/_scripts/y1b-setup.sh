. ~/scripts/y-lib.sh
usecluster ${CL:-yout}
export PATH=$U/bin-new:$PATH
O=$EV/10-outages/01-setup; mkdir -p $O; cd $O
S=y-lab
IMG=$(docker inspect --format '{{index .RepoDigests 0}}' localhost:5001/u-drill:v1); echo "$IMG" > 00-image.txt
which kubectl-ate >> 00-image.txt; kubectl ate version >> 00-image.txt 2>&1
cat > pool.yaml <<EOF
apiVersion: v1
kind: Namespace
metadata: {name: $S}
---
apiVersion: ate.dev/v1
kind: WorkerPool
metadata: {name: y-pool, namespace: $S, labels: {workload: y-pool}}
spec:
  replicas: 60
  workerImage: ghcr.io/agent-substrate/substrate/ateworker-gvisor:v1.0.0
  sandboxClasses:
  - name: gvisor
  template:
    resources:
      limits: {cpu: "1", memory: 1Gi}
      requests: {cpu: 100m, memory: 128Mi}
EOF
cat > template.yaml <<EOF
metadata: {atespace: $S, name: y-drill}
workerSelector:
  matchLabels: {workload: y-pool}
containers:
- name: drill
  image: $IMG
  wakeupProbe:
    httpGet: {path: /readyz, port: 80}
resources:
  limits: {cpuMillicores: 500, memoryBytes: 134217728}
snapshotConfig:
  preferredFidelity: SNAPSHOT_FIDELITY_MEMORY
EOF
kubectl apply -f pool.yaml > 01-setup.log 2>&1
K create atespace $S >> 01-setup.log
K create actor-template -f template.yaml >> 01-setup.log
kubectl -n $S rollout status deploy/y-pool --timeout=400s >> 01-setup.log 2>&1
for i in $(seq 1 90); do K get actor-templates -a $S | grep -q -E 'y-drill +[0-9a-f-]{36}' && break; sleep 2; done
K get actor-templates -a $S | tee -a 01-setup.log
mkprober >> 01-setup.log 2>&1
cat > req.sh <<'EOF'
curl -s -m ${2:-20} -o /tmp/r.$$ -w '%{http_code}\t%{time_total}\t' --cacert /run/ca/trust-bundle.pem --cert /run/id/credential-bundle.pem --key /run/id/credential-bundle.pem -X POST -H "ate-target-actor: y-lab/$1" https://atenet-router.ate-system.svc:443/
head -c 140 /tmp/r.$$ | tr '\n\t' '  '; echo; rm -f /tmp/r.$$
EOF
kubectl -n ate-system exec -i u-prober -- sh -c 'cat > /tmp/req.sh' < req.sh
cat > loop.sh <<'EOF'
C="--cacert /run/ca/trust-bundle.pem --cert /run/id/credential-bundle.pem --key /run/id/credential-bundle.pem"
U=https://atenet-router.ate-system.svc:443/
P=$1
i=0; n=0
one() { ( r=$(curl -s -m $4 -o /tmp/$1.$2.$3 -w '%{http_code}\t%{time_total}' $C -X POST -H "ate-target-actor: y-lab/$2" $U); printf '%s\t%s\t%s\t%s\t%s\n' "$3" "$1" "$2" "$r" "$(head -c 140 /tmp/$1.$2.$3 | tr '\n\t' '  ')" >> /tmp/probe.tsv; rm -f /tmp/$1.$2.$3 ) & }
while [ ! -f /tmp/stop ]; do
  t=$(date +%s)
  one running y-run $t 9
  one running2 y-r1 $t 9
  one running2 y-r2 $t 9
  if [ $((i % 5)) -eq 0 ]; then
    n=$((n+1)); one suspended $(printf '%s-s-%03d' $P $n) $t 14
  fi
  i=$((i+1)); sleep 1
done
EOF
kubectl -n ate-system exec -i u-prober -- sh -c 'cat > /tmp/loop.sh' < loop.sh
R() { PX "sh /tmp/req.sh $*"; }
for a in y-run y-r1 y-r2 y-r3 y-r4 y-r5; do K create actor $a -a $S --template y-drill | tail -1 >> 01-setup.log; echo "$a first: $(R $a)" >> 01-setup.log; done
K get actors -a $S >> 01-setup.log
kubectl -n ate-system get deploy,sts,ds -o wide > 02-ate-system.txt 2>&1
kubectl get pods -A -o wide > 03-pods.txt 2>&1
echo DONE > 99-done; tail -12 01-setup.log
