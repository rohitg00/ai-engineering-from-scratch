export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
C=kind-multi; S=lab-n; V=multi-worker2; O=multi-worker
E=~/evidence/T-drain-store; mkdir -p "$E"; cd "$E"
kc() { kubectl --context $C "$@"; }
podsn() { kubectl --context $C get pods -n $S --no-headers -o custom-columns=N:.metadata.name,P:.status.phase,NODE:.spec.nodeName,DEL:.metadata.deletionTimestamp; }
podline() { podsn | awk '{d=($4=="<none>")?"":"/terminating"; split($1,p,"-"); print p[3]":"$2 d":"$3}' | tr '\n' ' '; }
K() { kubectl ate --context $C "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
workline() { K get workers | awk 'NR>1{n=split($7,p,"-"); print p[n]":"substr($3,14)":"$4":"$6}' | tr '\n' ' '; }
ts() { date -u +%FT%T.%3NZ; }
now() { date +%s.%N; }
el() { echo "$(now) - $1" | bc -l | xargs printf '%.1f'; }
st() { kubectl ate --context $C get actor $1 -a $S -o json 2>/dev/null | jq -r '[.status.state, (.status.assignedNode // "-"), ((.status.snapshots // []) | map(.owner + ":" + (.durableSnapshot.state // "none") + ":gen" + (.generation|tostring) + ":" + (.locality // "-" | tostring)) | join(","))] | @tsv'; }
nodeof() { kubectl ate --context $C get actor $1 -a $S -o json 2>/dev/null | jq -r '.status.assignedNode // "-"'; }
wpod() { K get actor $1 -a $S | awk 'NR==2{print $5}'; }
call() { curl -s -m ${2:-12} -o body-$1.tmp -w '%{http_code}\t%{time_total}' "http://127.0.0.1:$1${3:-/}"; printf '\t%s' "$(tr -d '\n' < body-$1.tmp | cut -c1-150)"; }
T=x.tsv; T0=0
m() { echo "$(ts)	t=$( [ "$T0" = 0 ] && echo - || el $T0 )	$1	$2" >> $T; }
snap() { { echo "### $1 $(ts)"; kc get nodes --no-headers | awk '{print $1,$2}'; podsn; K get workers; } >> $2 2>&1; }
proxy() { pkill -f "proxy actor $1 " 2>/dev/null; (kubectl ate --context $C proxy actor $1 -a $S $2:80 > proxy-$1.log 2>&1 &); for t in $(seq 1 30); do grep -q Proxying proxy-$1.log 2>/dev/null && break; sleep 0.3; done; }
vworkers_active() { n=0; for p in $(podsn | awk -v v=$V '$3==v{print $1}'); do K get workers | grep "$S/$p" | grep -q WORKER_STATE_ACTIVE && n=$((n+1)); done; echo $n; }
allworkers_active() { K get workers | grep -c WORKER_STATE_ACTIVE; }
wait_unavailable() { for i in $(seq 1 90); do [ "$(vworkers_active)" = "0" ] && break; sleep 2; done; m workers-of-stopped-node-not-active "$(workline)"; }
prober() { a=$1; port=$2; iv=${3:-1}; rm -f stop-probe-$a; (while [ ! -f stop-probe-$a ]; do r="$(call $port 8)"; case "$r" in 000*) proxy $a $port;; esac; m probe "$r	|	$(st $a)"; sleep $iv; done &) ; }
watcher() { rm -f stop-watch; (while [ ! -f stop-watch ]; do m watch "pods: $(podline)| workers: $(workline)"; sleep 2; done &) ; }
lastok() { awk -F'\t' '$3=="probe"' $T | tail -${1:-4} | grep -c "	probe	200"; }
delall() { for a in $(K get actors -a $S | awk 'NR>1{print $2}'); do K revert actor $a -a $S > /dev/null 2>&1; K suspend actor $a -a $S --mode sync > /dev/null 2>&1; K delete actor $a -a $S > /dev/null 2>&1; done; for tg in $(K get tags -a $S | awk 'NR>1 && $2 ~ /^keep-/{print $2}'); do K delete tag $tg -a $S > /dev/null 2>&1; done; }
mkon() {
  base=$1; tmpl=$2; port=$3; want=${4:-$V}; MADE=""
  for k in $(seq 1 40); do
    a=$base$k
    K create actor $a -a $S --template $tmpl > /dev/null; K resume actor $a -a $S > /dev/null
    if [ "$(nodeof $a)" = "$want" ]; then MADE=$a; [ "$port" != 0 ] && proxy $a $port; return 0; fi
    K suspend actor $a -a $S --mode sync > /dev/null; K delete actor $a -a $S > /dev/null
  done
  return 1
}
rebalance() {
  kc uncordon $V > /dev/null 2>&1; kc uncordon $O > /dev/null 2>&1
  kc -n $S scale workerpool ballast --replicas=4 > /dev/null 2>&1; sleep 3
  kc -n $S rollout status deploy/ballast --timeout=240s > /dev/null 2>&1
  for i in 1 2 3 4; do
    nv=$(podsn | awk -v v=$V '$3==v && $2=="Running" && $4=="<none>"' | wc -l); no=$(podsn | awk -v o=$O '$3==o && $2=="Running" && $4=="<none>"' | wc -l)
    [ "$nv" = 2 ] && [ "$no" = 2 ] && break
    if [ "$nv" -lt 2 ]; then from=$O; n=$((2-nv)); else from=$V; n=$((nv-2)); fi
    kc cordon $from > /dev/null
    for pod in $(podsn | awk -v o=$from '$3==o && $4=="<none>"{print $1}' | head -$n); do kc delete pod -n $S $pod --wait=false > /dev/null; done
    sleep 6; kc -n $S rollout status deploy/ballast --timeout=240s > /dev/null 2>&1
    kc uncordon $from > /dev/null
    for w in $(seq 1 40); do [ "$(podsn | awk '$4!="<none>"' | wc -l)" = 0 ] && break; sleep 3; done
  done
  for i in $(seq 1 60); do [ "$(vworkers_active)" -ge 2 ] && [ "$(allworkers_active)" -ge 4 ] && break; sleep 3; done
  echo "$(ts) rebalanced: $(podline)| $(workline)" >> 00-run.log
}
rv() { s1=$(now); out=$(K revert actor $A -a $S | tr '\n' ' ' | cut -c1-230); m "$1" "$(el $s1) s | $out"; m state "$(st $A)"; }
