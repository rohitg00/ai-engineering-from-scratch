. ~/scripts/vlib.sh
while ! grep -q DONE $V/12-suspend-during-request/10-inflight.tsv 2>/dev/null; do sleep 5; done
while ! grep -q DONE $V/11-process-exit-long-watch/10-watch.tsv 2>/dev/null; do sleep 10; done
mkdir -p $V/10-preview-feature; cd $V/10-preview-feature
T=10-preview.tsv; echo "ts	server	client	output" > $T
cat > tmpl-gep.yaml <<EOF
metadata:
  atespace: $S
  name: gep-0
workerSelector:
  matchLabels:
    workload: vpool
containers:
- name: ballast
  image: $IMG
  command:
  - /ballast
  - --mb=0
  wakeupProbe:
    httpGet:
      path: /readyz
      port: 80
resources:
  limits:
    cpuMillicores: 1000
    memoryBytes: 268435456
snapshotConfig:
  preferredFidelity: SNAPSHOT_FIDELITY_MEMORY
goldenEgressPolicy:
  rules:
  - http:
      hostnames:
      - echo.lab-v.svc.cluster.local
      ports:
        numbers:
        - 80
EOF
run() { out=$("${@:3}" 2>&1 | grep -v '^Warning: no --token-file' | tr '\n' ' ' | cut -c1-460); echo "$(ts)	$1	$2	$out" >> $T; }
args() { kubectl -n ate-system get deploy ate-api-server -o json | jq -r '.spec.template.spec.containers[] | select(.name=="ate-api-server") | .args[] | select(startswith("--preview"))'; }
echo "$(ts)	off	-	server arg: $(args)" >> $T
run off no-flag kubectl ate create actor-template -f tmpl-gep.yaml
run off --preview kubectl ate --preview create actor-template -f tmpl-gep.yaml
K delete actor-template gep-0 -a $S > /dev/null 2>&1
kubectl -n ate-system get deploy ate-api-server -o json | jq '.spec.template.spec.containers |= map(if .name=="ate-api-server" then .args |= map(if startswith("--preview") then "--preview=GoldenEgressPolicy" else . end) else . end)' | kubectl apply -f - > 11-patch-on.log 2>&1
kubectl -n ate-system rollout status deploy/ate-api-server --timeout=180s >> 11-patch-on.log 2>&1
sleep 8
echo "$(ts)	on	-	server arg: $(args)" >> $T
run on no-flag kubectl ate create actor-template -f tmpl-gep.yaml
run on --preview kubectl ate --preview create actor-template -f tmpl-gep.yaml
sleep 30
run on --preview kubectl ate --preview get actor-templates -a $S
kubectl ate --preview get actor-template gep-0 -a $S -o yaml > 12-template-gep.yaml 2>&1
run on no-flag kubectl ate get actor-template gep-0 -a $S
kubectl -n ate-system logs deploy/ate-api-server -c ate-api-server --since=2m 2>/dev/null | grep -i -E "preview|golden" | tail -12 | cut -c1-400 > 13-ateapi-lines.log
K --preview delete actor-template gep-0 -a $S > /dev/null 2>&1
kubectl -n ate-system get deploy ate-api-server -o json | jq '.spec.template.spec.containers |= map(if .name=="ate-api-server" then .args |= map(if startswith("--preview") then "--preview=" else . end) else . end)' | kubectl apply -f - > 14-patch-off.log 2>&1
kubectl -n ate-system rollout status deploy/ate-api-server --timeout=180s >> 14-patch-off.log 2>&1
echo "$(ts)	off-again	-	server arg: $(args)" >> $T
echo DONE >> $T
