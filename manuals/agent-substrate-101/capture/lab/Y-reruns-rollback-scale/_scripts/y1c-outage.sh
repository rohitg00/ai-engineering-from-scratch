. ~/scripts/y-lib.sh
KIND=$1; RUN=$2; P=$KIND$RUN
usecluster ${CL:-yout}
export PATH=$U/bin-new:$PATH
O=$EV/10-outages/$3-$KIND-run$RUN; mkdir -p $O; cd $O
S=y-lab; TL=$O/00-timeline.tsv; : > $TL
R() { PX "sh /tmp/req.sh $*"; }
st() { kubectl ate get actor "$1" -a $S -o json 2>/dev/null | jq -r .status.state; }
kapi() { sg docker -c "docker exec $NODE curl -sk -m 2 -o /dev/null -w '%{http_code}' https://127.0.0.1:6443/livez" 2>/dev/null; }
for n in $(seq 1 50); do K create actor $(printf '%s-s-%03d' $P $n) -a $S --template y-drill > /dev/null; done
K get actors -a $S | awk 'NR>1{print $4}' | sort | uniq -c > 01-states-before.txt
for a in y-run y-r1 y-r2 y-r3 y-r4 y-r5; do echo "$a $(st $a) $(R $a)"; done > 02-running-before.txt 2>&1
API_REPLICAS=$(kubectl -n ate-system get deploy ate-api-server -o jsonpath='{.spec.replicas}')
kubectl -n ate-system exec u-prober -- sh -c "rm -f /tmp/stop /tmp/probe.tsv; nohup sh /tmp/loop.sh $P > /tmp/loop.log 2>&1 &"
( while [ ! -f stop ]; do printf '%s\t%s\n' "$(date +%s)" "$(kubectl -n ate-system get pods --no-headers 2>&1 | awk '{print $1":"$2":"$3":"$4}' | grep -E 'postgres|ate-api|router' | tr '\n' ' ')"; sleep 2; done > 03-pods.tsv 2>&1 ) &
( while [ ! -f stop ]; do t=$(date +%s); s0=$(now); n=$(kubectl ate get actors -a $S 2>&1 | grep -c ACTOR_STATE); printf '%s\tapi\t%s actors listed\t%s s\n' "$t" "$n" "$(el $s0)" >> 04-cli-stream.tsv; sleep 2; done ) &
tl start-baseline; sleep 30
case $KIND in
pg)
  tl outage-begin postgres-scale-0
  kubectl -n ate-system scale sts postgres --replicas=0 >> 05-actions.log 2>&1
  for i in $(seq 1 60); do kubectl -n ate-system get pod postgres-0 >/dev/null 2>&1 || break; sleep 0.5; done; tl dependency-gone
  sleep 20; K get actor y-run -a $S > 06-cli-during.txt 2>&1
  kubectl -n ate-system logs deploy/atenet-router -c atenet-router --since=25s > 06-router-during.log 2>&1
  sleep 40
  tl restore-begin postgres-scale-1
  kubectl -n ate-system scale sts postgres --replicas=1 >> 05-actions.log 2>&1
  kubectl -n ate-system rollout status sts/postgres --timeout=180s >> 05-actions.log 2>&1
  tl dependency-ready ;;
api)
  tl outage-begin ate-api-server-scale-0
  kubectl -n ate-system scale deploy ate-api-server --replicas=0 >> 05-actions.log 2>&1
  for i in $(seq 1 60); do [ "$(kubectl -n ate-system get pods -l app=ate-api-server --no-headers 2>/dev/null | wc -l)" = 0 ] && break; sleep 0.5; done; tl dependency-gone
  sleep 20; K get actor y-run -a $S > 06-cli-during.txt 2>&1
  kubectl -n ate-system logs deploy/atenet-router -c atenet-router --since=25s > 06-router-during.log 2>&1
  sleep 40
  tl restore-begin ate-api-server-scale-$API_REPLICAS
  kubectl -n ate-system scale deploy ate-api-server --replicas=$API_REPLICAS >> 05-actions.log 2>&1
  kubectl -n ate-system rollout status deploy/ate-api-server --timeout=180s >> 05-actions.log 2>&1
  tl dependency-ready ;;
k8s)
  tl outage-begin kube-apiserver-manifest-moved-out "livez=$(kapi)"
  sg docker -c "docker exec $NODE mv /etc/kubernetes/manifests/kube-apiserver.yaml /root/kube-apiserver.yaml"
  gone=0
  for i in $(seq 1 60); do
    c=$(kapi); echo "$(date +%s)	$c" >> 07-livez.tsv
    [ "$c" != 200 ] && [ $gone = 0 ] && { gone=1; tl dependency-gone "livez=$c"; }
    [ $i = 25 ] && { kubectl get nodes > 06-kubectl-during.txt 2>&1; K get actor y-run -a $S > 06-cli-during.txt 2>&1; }
    sleep 1
  done
  tl restore-begin kube-apiserver-manifest-moved-back
  sg docker -c "docker exec $NODE mv /root/kube-apiserver.yaml /etc/kubernetes/manifests/kube-apiserver.yaml"
  for i in $(seq 1 180); do c=$(kapi); echo "$(date +%s)	$c" >> 07-livez.tsv; [ "$c" = 200 ] && break; sleep 1; done
  tl dependency-ready "livez=$c" ;;
esac
sleep 120
tl end-streams
for i in 1 2 3 4 5 6; do kubectl -n ate-system exec u-prober -- touch /tmp/stop 2>/dev/null && break; sleep 5; done
touch stop; sleep 12
kubectl -n ate-system exec u-prober -- cat /tmp/probe.tsv | sort -n > 10-probe.tsv
rm -f stop
{
for a in y-run y-r1 y-r2 y-r3 y-r4 y-r5; do for i in 1 2 3; do echo "$(date +%s) $a $(st $a) $(R $a 12)"; done; done
} > 11-running-after.txt 2>&1
tl running-actors-checked
STUCK=$(awk '$4!=200{print $2}' 11-running-after.txt | sort -u | tr '\n' ' ')
echo "stuck: [$STUCK]" > 12-stuck.txt
if [ -n "$STUCK" ]; then
  kubectl -n ate-system logs deploy/atenet-router -c atenet-router --since=6m > 13-router-when-stuck.log 2>&1
  kubectl -n ate-system logs deploy/ate-api-server --since=6m 2>&1 | tail -300 > 13-ateapi-when-stuck.log
  sleep 60
  for a in $STUCK; do echo "$(date +%s) +60s $a $(st $a) $(R $a 12)"; done >> 12-stuck.txt 2>&1
  for a in $STUCK; do s0=$(now); K resume actor $a -a $S >> 12-stuck.txt 2>&1; echo "resume cmd $(el $s0) s; $a $(st $a) $(R $a 12)" >> 12-stuck.txt; done
  STILL=$(for a in $STUCK; do R $a 12 | awk -v a=$a '$1!=200{print a}'; done | tr '\n' ' ')
  echo "still stuck after resume cmd: [$STILL]" >> 12-stuck.txt
  if [ -n "$STILL" ]; then
    tl router-restart-begin; s0=$(now)
    kubectl -n ate-system rollout restart deploy/atenet-router >> 12-stuck.txt 2>&1
    kubectl -n ate-system rollout status deploy/atenet-router --timeout=180s >> 12-stuck.txt 2>&1
    tl "router-restart-done seconds=$(el $s0)"
    for a in $STILL; do echo "after router restart $a $(st $a) $(R $a 12)"; done >> 12-stuck.txt 2>&1
  fi
fi
kubectl -n ate-system logs deploy/ate-api-server --since=6m 2>&1 | grep -i -E "worker cache|cache synced|not ready|retry" | tail -60 > 14-ateapi-worker-cache.log
kubectl -n ate-system logs deploy/ate-api-server --since=6m 2>&1 | tail -400 > 14-ateapi-tail.log
kubectl -n ate-system logs deploy/atenet-router -c atenet-router --since=6m 2>&1 | tail -400 > 15-router-tail.log
kubectl -n ate-system get pods -o wide > 16-pods-after.txt 2>&1
K get actors -a $S | awk 'NR>1{print $4}' | sort | uniq -c > 17-states-after.txt
K get actors -a $S | grep -E 'RESUMING|SUSPENDING|CRASHED|REVERTING' > 20-not-settled.txt
for a in $(awk '{print $2}' 20-not-settled.txt); do kubectl ate get actor $a -a $S -o json > 20-actor-$a.json 2>&1; grep -h "$a" 10-probe.tsv > 20-probe-$a.tsv; done
if [ -s 20-not-settled.txt ]; then
  sleep 60
  for a in $(awk '{print $2}' 20-not-settled.txt); do echo "+60s $a $(st $a) request: $(R $a 14) state-after: $(st $a)"; done > 21-not-settled-later.txt 2>&1
  sleep 5
  for a in $(awk '{print $2}' 20-not-settled.txt); do echo "second request $a $(R $a 14) state-after: $(st $a)"; done >> 21-not-settled-later.txt 2>&1
fi
for a in $(K get actors -a $S | awk -v p="$P-s-" 'index($2,p)==1 && $4=="ACTOR_STATE_RUNNING"{print $2}'); do K suspend actor $a -a $S > /dev/null; done
sleep 8
for a in $(K get actors -a $S | awk -v p="$P-s-" 'index($2,p)==1 && $4=="ACTOR_STATE_SUSPENDED"{print $2}'); do K delete actor $a -a $S > /dev/null 2>&1; done
K get actors -a $S | awk 'NR>1{print $4}' | sort | uniq -c > 18-states-after-cleanup.txt
tl done
awk -F'\t' '{k=$2; n[k]++; if($4!=200) f[k]++} END{for(k in n) printf "%s\t%d of %d failed\n", k, f[k]+0, n[k]}' 10-probe.tsv > 19-summary.txt
cat 19-summary.txt 12-stuck.txt
echo DONE > 99-done
