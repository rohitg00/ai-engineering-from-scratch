export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
E=~/evidence/L-gaps/microvm; mkdir -p "$E"; cd ~/substrate
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
now() { date +%s.%N; }
el() { echo "$(now) - $1" | bc -l | xargs printf '%.3f'; }
ts() { date -u +%FT%T.%3NZ; }
call() { curl -s -m 240 -o "$E/body.tmp" -w '%{http_code}\t%{time_total}' $2 "http://127.0.0.1:$1/"; printf '\t%s' "$(tr -d '\n' < "$E/body.tmp" | cut -c1-150)"; }
export ATE_INSTALL_KIND=true
s=$(date +%s)
sg docker -c "go run ./cmd/ate-setup deploy demo counter-microvm" > "$E/10-deploy-counter-microvm.log" 2>&1
echo "deploy-counter-microvm	rc=$?	$(( $(date +%s) - s ))s" > "$E/11-steps.tsv"
kubectl get pods -n ate-demo-counter-microvm -o wide > "$E/12-pods.txt" 2>&1
kubectl get workerpool -n ate-demo-counter-microvm -o yaml > "$E/13-workerpool.yaml" 2>&1
K get actor-templates -a ate-demo-counter-microvm > "$E/14-templates.txt"
K get actor-template counter-microvm -a ate-demo-counter-microvm -o yaml > "$E/14-template.yaml"
K get workers --sandbox-class microvm > "$E/15-workers.txt"
kubectl -n ate-demo-counter-microvm describe pods | grep -E "Image:|Limits|Requests|cpu:|memory:|/dev/kvm|privileged|Mounts|Warning|Failed|Back-off" | head -60 > "$E/16-pod-describe.txt"
if ! grep -q " 0\|rc=0" "$E/11-steps.tsv"; then tail -30 "$E/10-deploy-counter-microvm.log" > "$E/17-deploy-failure-tail.txt"; fi

A=ate-demo-counter-microvm
T="$E/20-counter-trace.tsv"; echo "ts	event	http	seconds	detail" > $T
s=$(now); K create actor mv-counter-1 -a $A --template counter-microvm > "$E/21-create.txt"; echo "$(ts)	create	-	$(el $s)	cli" >> $T
(kubectl ate proxy actor mv-counter-1 -a $A 8700:80 > "$E/proxy-counter.log" 2>&1 &)
for t in $(seq 1 30); do grep -q Proxying "$E/proxy-counter.log" 2>/dev/null && break; sleep 0.3; done
echo "$(ts)	first-call	$(call 8700 '-X POST')" >> $T
for i in 1 2 3; do echo "$(ts)	warm	$(call 8700 '-X POST')" >> $T; done
K get actor mv-counter-1 -a $A -o yaml > "$E/22-actor-running.yaml"
sg docker -c "docker exec kind-control-plane sh -c 'ps -eo pid,rss,vsz,args --sort=-rss | grep -E \"cloud-hypervisor|virtiofsd|runsc|kata\" | grep -v grep | cut -c1-230 | head -20'" > "$E/23-node-processes-counter.txt" 2>&1
for c in 1 2 3; do
  s=$(now); out=$(K suspend actor mv-counter-1 -a $A | tr '\n' ' ' | cut -c1-160); echo "$(ts)	suspend-async	-	$(el $s)	$out" >> $T
  sleep 1
  echo "$(ts)	resume-local	$(call 8700 '-X POST')" >> $T
done
K logs actor mv-counter-1 -a $A --source=lifecycle > "$E/24-lifecycle-counter.log" 2>&1
K logs actor mv-counter-1 -a $A > "$E/25-logs-counter.log" 2>&1
K suspend actor mv-counter-1 -a $A --mode sync > /dev/null
K get actor mv-counter-1 -a $A -o yaml > "$E/26-actor-suspended.yaml"

S=lab-m
WI=$(kubectl get workerpool counter-microvm -n $A -o jsonpath='{.spec.workerImage}')
DIGEST=$(kubectl ate get actor-template ballast-0 -a lab-c -o json 2>/dev/null | jq -r '.containers[0].image')
cat > "$E/30-pool.yaml" <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: lab-m
---
apiVersion: ate.dev/v1
kind: WorkerPool
metadata:
  name: ballast-mvm
  namespace: lab-m
  labels:
    workload: ballast-mvm
spec:
  replicas: 2
  workerImage: $WI
  sandboxClasses:
  - name: microvm
    configRef:
      name: microvm
  template:
    resources:
      limits:
        cpu: "2"
        memory: 3Gi
      requests:
        cpu: 500m
        memory: 3Gi
EOF
kubectl apply -f "$E/30-pool.yaml" > "$E/31-apply.log" 2>&1
K create atespace $S >> "$E/31-apply.log"
for mb in 0 200 500; do
  cat > "$E/32-tmpl-$mb.yaml" <<EOF
metadata:
  atespace: lab-m
  name: mvm-$mb
workerSelector:
  matchLabels:
    workload: ballast-mvm
containers:
- name: ballast
  image: $DIGEST
  command:
  - /ballast
  - --mb=$mb
  wakeupProbe:
    httpGet:
      path: /readyz
      port: 80
    timeoutSeconds: 120
resources:
  limits:
    cpuMillicores: 1000
    memoryBytes: $(( (mb + 256) * 1048576 ))
snapshotConfig:
  preferredFidelity: SNAPSHOT_FIDELITY_MEMORY
EOF
  K create actor-template -f "$E/32-tmpl-$mb.yaml" >> "$E/31-apply.log"
done
kubectl -n lab-m rollout status deploy/ballast-mvm --timeout=300s >> "$E/31-apply.log" 2>&1
s=$(date +%s)
for i in $(seq 1 90); do
  n=$(K get actor-templates -a $S | awk 'NR>1 && $3 ~ /-/' | wc -l)
  [ "$n" = "3" ] && break; sleep 4
done
echo "golden-snapshots-ready	$n of 3	$(( $(date +%s) - s ))s" >> "$E/11-steps.tsv"
K get actor-templates -a $S > "$E/33-templates.txt"
OUT="$E/40-microvm-local.tsv"
echo "mb	phase	i	http	seconds	detail" > $OUT
port=8710
for mb in 0 200 500; do
  for i in 1 2 3 4 5; do
    a=v$mb-$i; port=$((port+1))
    s=$(now); K create actor $a -a $S --template mvm-$mb > /dev/null; echo "$mb	create-actor	$i	-	$(el $s)	cli" >> $OUT
    (kubectl ate proxy actor $a -a $S $port:80 > "$E/proxy-$a.log" 2>&1 &)
    for t in $(seq 1 30); do grep -q Proxying "$E/proxy-$a.log" 2>/dev/null && break; sleep 0.3; done
    echo "$mb	first-call-golden	$i	$(call $port)" >> $OUT
    echo "$mb	warm-call	$i	$(call $port)" >> $OUT
    if [ $i = 1 ]; then
      sg docker -c "docker exec kind-control-plane sh -c 'ps -eo pid,rss,vsz,args --sort=-rss | grep -E \"cloud-hypervisor|virtiofsd\" | grep -v grep | cut -c1-200 | head -12'" > "$E/41-node-processes-$a.txt" 2>&1
      K get workers -a $S > "$E/42-workers-$a.txt"
      for c in $(seq 1 10); do
        s=$(now); K suspend actor $a -a $S > /dev/null; echo "$mb	suspend-async	$c	-	$(el $s)	cli" >> $OUT
        if [ $c = 1 ]; then
          K get actor $a -a $S -o json > "$E/43-actor-$a-suspended.json"
          uid=$(jq -r .metadata.uid "$E/43-actor-$a-suspended.json")
          sg docker -c "docker exec kind-control-plane sh -c 'du -sk /var/lib/ate/snapshots/$uid; find /var/lib/ate/snapshots/$uid -type f -printf \"%s %p\n\" | sort -n | tail -12'" > "$E/44-snapdir-$a.txt" 2>&1
        fi
        sleep 1
        echo "$mb	resume-local	$c	$(call $port)" >> $OUT
        echo "$mb	warm-call	$c	$(call $port)" >> $OUT
      done
      K logs actor $a -a $S --source=lifecycle > "$E/45-lifecycle-$a.log" 2>&1
    fi
    s=$(now); K suspend actor $a -a $S --mode sync > /dev/null; echo "$mb	suspend-sync	$i	-	$(el $s)	cli" >> $OUT
  done
done
K get actors -a $S > "$E/46-actors-end.txt"
kubectl -n ate-system logs ds/atelet -c atelet --tail=200 2>/dev/null | grep -i -E "microvm|hypervisor|kata|error" | tail -40 | cut -c1-400 > "$E/47-atelet-microvm.log"
kubectl get pods -n lab-m -o wide > "$E/48-pods.txt"

G="$E/50-gvisor-rss.txt"
K create actor rss200 -a lab-c --template ballast-200 > /dev/null
(kubectl ate proxy actor rss200 -a lab-c 8790:80 > "$E/proxy-rss200.log" 2>&1 &); sleep 4
curl -s -m 60 http://127.0.0.1:8790/ > /dev/null
sg docker -c "docker exec kind-control-plane sh -c 'ps -eo pid,rss,vsz,args --sort=-rss | grep -E \"runsc\" | grep -v grep | cut -c1-200 | head -12'" > "$G" 2>&1
K suspend actor rss200 -a lab-c --mode sync > /dev/null; K delete actor rss200 -a lab-c > /dev/null
pkill -f "proxy actor v"; pkill -f "proxy actor rss200"; pkill -f "proxy actor mv-counter"
for mb in 0 200 500; do for i in 1 2 3 4 5; do K delete actor v$mb-$i -a $S > /dev/null; done; done
sudo fstrim -v / > /dev/null
echo DONE >> $OUT
