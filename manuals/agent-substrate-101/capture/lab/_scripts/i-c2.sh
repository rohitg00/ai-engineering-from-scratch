export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
now() { date -u +%FT%T.%3NZ; }
pkill -f "proxy actor [xj]"
for a in x1 x2 j1 j2; do K delete actor $a -a lab-c > /dev/null; done

# ---------- I: request parking demo as documented
E=~/evidence/I-capacity; mkdir -p "$E"; cd ~/substrate
export ATE_INSTALL_KIND=true
s=$(date +%s); sg docker -c "go run ./cmd/ate-setup deploy demo parking" > "$E/10-deploy-parking.log" 2>&1; echo "deploy-parking rc=$? $(( $(date +%s) - s ))s" > "$E/11-steps.txt"
A=ate-demo-parking
for id in p1 p2 p3 p4; do K create actor $id --atespace $A --template parking > /dev/null; done
kubectl get workerpool -n $A -o yaml | sed -n '/^  spec:/,/^  status:/p' > "$E/12-pool-spec.yaml"
for i in 1 2 3; do (kubectl ate proxy actor p$i 800$i:80 -a $A > "$E/proxy-p$i.log" 2>&1 &); done
sleep 4
T="$E/13-parking-trace.tsv"; echo "ts	event	detail" > $T
c() { curl -s -m 30 -o /tmp/pb -w '%{http_code}\t%{time_total}' http://localhost:$1; printf '\t%s' "$(tr -d '\n' < /tmp/pb | cut -c1-150)"; }
echo "$(now)	p1	$(c 8001)" >> $T
echo "$(now)	p2	$(c 8002)" >> $T
K get workers -a $A > "$E/14-workers-full.txt"; K get actors -a $A >> "$E/14-workers-full.txt"
echo "$(now)	p3-no-free-worker	$(c 8003)" >> $T
( sleep 2; kubectl ate suspend actor p1 --atespace $A > /dev/null 2>&1; echo "$(now)	suspend-p1-done	freed a worker 2 s after p3 request started" >> $T ) &
echo "$(now)	p3-request-start	parked while pool is full" >> $T
echo "$(now)	p3-served-after-park	$(c 8003)" >> $T
wait
K get actors -a $A > "$E/15-actors-after.txt"
pkill -f "proxy actor p"; sleep 1
(cd ~/substrate && timeout 120 ./demos/parking/load.sh -d 30 > "$E/16-load-30s.log" 2>&1)
kubectl -n ate-system get deploy atenet-router -o json | jq -r '.spec.template.spec.containers[] | .name + " " + (.args // [] | join(" "))' > "$E/17-router-args.txt"
for id in p1 p2 p3 p4; do K delete actor $id --atespace $A > /dev/null; done

# ---------- C2: resume from object store, n=5 per size, shortened atelet delays
E=~/evidence/C-resume-vs-size; cd "$E"; S=lab-c
kubectl -n ate-system get ds atelet -o json | jq '.spec.template.spec.containers |= map(if .name=="atelet" then .args += ["--snapshot-upload-delay=3s","--snapshot-detach-delay=10s"] else . end)' | kubectl apply -f - > 30-atelet-patch.log 2>&1
kubectl -n ate-system rollout status ds/atelet --timeout=180s >> 30-atelet-patch.log 2>&1
kubectl -n ate-system get ds atelet -o json | jq -r '.spec.template.spec.containers[] | .name + " " + (.args // [] | join(" "))' > 31-atelet-args-patched.txt
sleep 10
OUT=32-object-store.tsv
echo "mb	phase	i	http	seconds	detail" > $OUT
call() { curl -s -m 180 -o body.tmp -w '%{http_code}\t%{time_total}' http://127.0.0.1:$1/; printf '\t%s' "$(tr -d '\n' < body.tmp)"; }
node() { kubectl ate get actor $1 -a $S -o json 2>/dev/null | jq -r '(.status.assignedNode // "-") + " " + ((.status.snapshots // []) | map(.durableSnapshot.state // "none") | join(","))'; }
port=8400
for mb in 0 50 200 500 1000; do
  a=o$mb; port=$((port+1))
  K create actor $a -a $S --template ballast-$mb > /dev/null
  (kubectl ate proxy actor $a -a $S $port:80 > proxy-$a.log 2>&1 &)
  for t in $(seq 1 30); do grep -q Proxying proxy-$a.log 2>/dev/null && break; sleep 0.3; done
  echo "$mb	first-call-golden	1	$(call $port)" >> $OUT
  for c in 1 2 3 4 5; do
    K suspend actor $a -a $S > /dev/null
    s=$(date +%s.%N)
    for w in $(seq 1 240); do n=$(node $a); [ "${n%% *}" = "-" ] && break; sleep 0.5; done
    echo "$mb	wait-detach	$c	-	$(echo "$(date +%s.%N) - $s" | bc -l | xargs printf '%.1f')	$n" >> $OUT
    echo "$mb	resume-object-store	$c	$(call $port)" >> $OUT
    echo "$mb	warm-call	$c	$(call $port)" >> $OUT
  done
  K logs actor $a -a $S --source=lifecycle > lifecycle-$a.log 2>&1
  K suspend actor $a -a $S --mode sync > /dev/null
  K delete actor $a -a $S > /dev/null
done
pkill -f "proxy actor o"
kubectl -n ate-system logs ds/atelet -c atelet --tail=300 2>/dev/null | grep -i -E "upload|detach|download" | tail -40 > 33-atelet-upload-detach.log
sudo fstrim -v / > /dev/null
echo DONE >> $OUT
