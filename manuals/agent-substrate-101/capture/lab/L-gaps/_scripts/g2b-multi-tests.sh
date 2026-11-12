export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
E=~/evidence/L-gaps/multinode; cd "$E"; S=lab-n; V=multi-worker2
kubectl config use-context kind-multi > /dev/null
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
ts() { date -u +%FT%T.%3NZ; }
st() { kubectl ate get actor $1 -a $S -o json 2>/dev/null | jq -r '[.status.state, (.status.assignedNode // "-"), ((.status.snapshots // []) | map(.owner + ":" + (.durableSnapshot.state // "none") + ":gen" + (.generation|tostring) + ":" + (.locality // "-" | tostring)) | join(","))] | @tsv'; }
nodeof() { kubectl ate get actor $1 -a $S -o json 2>/dev/null | jq -r '.status.assignedNode // "-"'; }
wpod() { K get actor $1 -a $S | awk 'NR==2{print $5}'; }
call() { curl -s -m ${2:-15} -o body.tmp -w '%{http_code}\t%{time_total}' "http://127.0.0.1:$1/"; printf '\t%s' "$(tr -d '\n' < body.tmp | cut -c1-170)"; }
T=x.tsv
m() { echo "$(ts)	$1	$2" >> $T; }
snap() { { echo "### $1 $(ts)"; kubectl get nodes --no-headers | awk '{print $1,$2}'; K get workers; kubectl get pods -n lab-n -o wide --no-headers | awk '{print $1,$2,$3,$7}'; } >> $2 2>&1; }
proxy() { (kubectl ate proxy actor $1 -a $S $2:80 > proxy-$1.log 2>&1 &); for t in $(seq 1 30); do grep -q Proxying proxy-$1.log 2>/dev/null && break; sleep 0.3; done; }
mkon() {
  want=$1; base=$2; tmpl=$3; port=$4; MADE=""
  for k in $(seq 1 16); do
    a=$base$k
    K create actor $a -a $S --template $tmpl > /dev/null
    K resume actor $a -a $S > /dev/null
    if [ "$(nodeof $a)" = "$want" ]; then MADE=$a; proxy $a $port; return 0; fi
    K suspend actor $a -a $S --mode sync > /dev/null; K delete actor $a -a $S > /dev/null
  done
  return 1
}
waitnode() {
  s=$(date +%s)
  for i in $(seq 1 150); do
    r=$(kubectl get node $V --no-headers 2>/dev/null | awk '{print $2}')
    nr=$(kubectl get pods -A -o wide --no-headers 2>/dev/null | grep " $V " | grep -v -E "Running|Completed" | wc -l)
    [ "$r" = "Ready" ] && [ "$nr" = "0" ] && break; sleep 2
  done
  echo "$(ts)	node-back	ready=$r not-running=$nr after $(( $(date +%s) - s ))s" >> $T
  for i in $(seq 1 60); do n=$(K get workers | grep -c WORKER_STATE_ACTIVE); [ "$n" -ge 4 ] && break; sleep 2; done
  echo "$(ts)	workers-active	$n after $(( $(date +%s) - s ))s" >> $T
  sleep 20
}

T=50-placement.tsv; echo "i	actor	node	worker_pod	create_resume_s" > $T
for i in $(seq 1 20); do
  s=$(date +%s.%N); K create actor a$i -a $S --template ballast-0 > /dev/null; K resume actor a$i -a $S > /dev/null
  echo "$i	a$i	$(nodeof a$i)	$(wpod a$i)	$(echo "$(date +%s.%N) - $s" | bc -l | xargs printf '%.3f')" >> $T
done
snap after-20-creates 51-placement-workers.txt
awk -F'\t' 'NR>1{n[$3]++; w[$4]++} END{for(k in n) print "node", k, n[k]; for(k in w) print "worker", k, w[k]}' $T > 52-placement-counts.txt
for i in $(seq 1 20); do K suspend actor a$i -a $S --mode sync > /dev/null; K delete actor a$i -a $S > /dev/null; done

T=60-sticky-cordon.tsv; echo "ts	event	detail" > $T
mkon $V s ballast-50 8801 || m mkon-failed "no actor landed on $V"
A=$MADE; m actor "$A on $(nodeof $A) pod $(wpod $A)"
m call "$(call 8801)"; m call "$(call 8801)"
for c in 1 2 3 4 5; do
  K suspend actor $A -a $S > /dev/null; m suspended-async "$(st $A)"
  m resume-call "$(call 8801)"; m resumed-on "$(nodeof $A) pod $(wpod $A)"
done
K suspend actor $A -a $S > /dev/null; m suspended-async "$(st $A)"
kubectl cordon $V > /dev/null; m cordon "$V"
m resume-call-while-cordoned "$(call 8801)"; m resumed-on "$(nodeof $A) pod $(wpod $A)"
K suspend actor $A -a $S --mode sync > /dev/null; m suspended-sync "$(st $A)"
m resume-call-while-cordoned "$(call 8801)"; m resumed-on "$(nodeof $A) pod $(wpod $A)"
kubectl uncordon $V > /dev/null; m uncordon "$V"
K suspend actor $A -a $S --mode sync > /dev/null; pkill -f "proxy actor $A"; K delete actor $A -a $S > /dev/null

T=70-stop-after-upload.tsv; echo "ts	event	detail" > $T
mkon $V u ballast-50 8802 || m mkon-failed "no actor landed on $V"
A=$MADE; m actor "$A on $(nodeof $A) pod $(wpod $A)"
for i in 1 2 3; do m call "$(call 8802)"; done
K suspend actor $A -a $S --mode sync > /dev/null; m suspended-sync "$(st $A)"
snap before-stop 71-workers.txt
m node-stop "docker stop $V"; sg docker -c "docker stop $V" > /dev/null 2>&1; m node-stopped "$V"
ok=0
for i in $(seq 1 100); do
  r="$(call 8802 12)"; m probe "$r	|	$(st $A)"
  case "$r" in 200*) ok=$((ok+1));; esac
  [ $ok -ge 3 ] && break
  [ $i = 5 ] && snap +10s 71-workers.txt; [ $i = 30 ] && snap +60s 71-workers.txt
  sleep 2
done
m final "$(st $A) pod $(wpod $A)"; snap end 71-workers.txt
K get actor $A -a $S -o yaml > 72-actor-end.yaml
sg docker -c "docker start $V" > /dev/null 2>&1; m node-start "$V"; waitnode
K suspend actor $A -a $S --mode sync > /dev/null; pkill -f "proxy actor $A"; K delete actor $A -a $S > /dev/null

T=80-stop-before-upload.tsv; echo "ts	event	detail" > $T
mkon $V p ballast-50 8803 || m mkon-failed "no actor landed on $V"
A=$MADE; m actor "$A on $(nodeof $A) pod $(wpod $A)"
for i in 1 2 3; do m call "$(call 8803)"; done
K suspend actor $A -a $S --mode sync > /dev/null; m suspended-sync "$(st $A)"
for i in 4 5; do m call "$(call 8803)"; done
K suspend actor $A -a $S > /dev/null; m suspended-async "$(st $A)"
m node-stop "docker stop $V"; sg docker -c "docker stop $V" > /dev/null 2>&1; m node-stopped "$V"
ok=0
for i in $(seq 1 75); do
  r="$(call 8803 12)"; m probe "$r	|	$(st $A)"
  case "$r" in 200*) ok=$((ok+1));; esac
  [ $ok -ge 2 ] && break
  sleep 2
done
K get actor $A -a $S -o yaml > 82-actor-before-revert.yaml
if [ $ok -lt 2 ]; then
  m revert "$(K revert actor $A -a $S | tr '\n' ' ' | cut -c1-220)"; m state "$(st $A)"
  for i in $(seq 1 40); do
    r="$(call 8803 12)"; m probe-after-revert "$r	|	$(st $A)"
    case "$r" in 200*) break;; esac
    sleep 2
  done
fi
m final "$(st $A) pod $(wpod $A)"; snap end 81-workers.txt
sg docker -c "docker start $V" > /dev/null 2>&1; m node-start "$V"; waitnode
m state-after-node-back "$(st $A)"; m call-after-node-back "$(call 8803)"
K suspend actor $A -a $S --mode sync > /dev/null; pkill -f "proxy actor $A"; K delete actor $A -a $S > /dev/null

T=90-stop-while-running.tsv; echo "ts	event	detail" > $T
mkon $V q ballast-50 8804 || m mkon-failed "no actor landed on $V"
A=$MADE; m actor "$A on $(nodeof $A) pod $(wpod $A)"
for i in 1 2 3; do m call "$(call 8804)"; done
K suspend actor $A -a $S --mode sync > /dev/null; m suspended-sync "$(st $A)"
for i in 4 5; do m call "$(call 8804)"; done
m running "$(st $A)"
m node-stop "docker stop $V"; sg docker -c "docker stop $V" > /dev/null 2>&1; m node-stopped "$V"
crashed=0
for i in $(seq 1 120); do
  s="$(st $A)"; r="$(call 8804 8)"; m probe "$r	|	$s"
  case "$s" in ACTOR_STATE_CRASHED*) crashed=$((crashed+1));; esac
  [ $crashed -ge 3 ] && break
  [ $i = 20 ] && snap +40s 91-workers.txt
  sleep 2
done
snap after-loop 91-workers.txt
K get actor $A -a $S -o yaml > 92-actor-before-revert.yaml
m suspend-attempt "$(K suspend actor $A -a $S --mode sync | tr '\n' ' ' | cut -c1-220)"; m state "$(st $A)"
m revert "$(K revert actor $A -a $S | tr '\n' ' ' | cut -c1-220)"; m state "$(st $A)"
for i in $(seq 1 40); do
  r="$(call 8804 12)"; m probe-after-revert "$r	|	$(st $A)"
  case "$r" in 200*) break;; esac
  sleep 2
done
m final "$(st $A) pod $(wpod $A)"
sg docker -c "docker start $V" > /dev/null 2>&1; m node-start "$V"; waitnode
snap final 91-workers.txt
K suspend actor $A -a $S --mode sync > /dev/null; pkill -f "proxy actor $A"; K delete actor $A -a $S > /dev/null
kubectl -n ate-system logs deploy/ate-api-server -c ate-api-server --since=40m 2>/dev/null | grep -i -E "lease|worker.*(lost|expired|dead|unhealthy|remov)|crash" | tail -60 | cut -c1-400 > 95-ateapi-worker-events.log
kubectl -n ate-system logs deploy/ate-controller --since=40m 2>/dev/null | grep -i -E "worker|node|crash|lease" | tail -60 | cut -c1-400 > 96-controller-events.log
sudo fstrim -v / > /dev/null
echo TESTS-DONE > 99-done.txt
