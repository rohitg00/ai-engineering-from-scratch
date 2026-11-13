. ~/scripts/t-lib.sh
pkill -f "context $C proxy actor" 2>/dev/null
PH=${1:-all}
BR=$(ip -o -4 addr | awk '$4 ~ /^172\.18\./{print $2}')
EXT=http://172.18.0.1:9100
INT=http://rustfs.ate-system.svc:9000
AWSIMG=$(sg docker -c "docker images --format '{{.Repository}} {{.ID}}'" | awk '$1=="amazon/aws-cli"{print $2; exit}')
s3ext() { sg docker -c "docker run --rm --network host -e AWS_ACCESS_KEY_ID=<store-key> -e AWS_SECRET_ACCESS_KEY=<store-key> -e AWS_REGION=us-east-1 $AWSIMG --endpoint-url http://127.0.0.1:9100 $*" 2>&1; }
log() { echo "$(ts) $*" >> 80-store-run.log; }
idx() { kc -n ate-system get $1 -o json | jq -r --arg n "$2" --arg f "$3" '.spec.template.spec[$f] | to_entries[] | select(.value.name==$n) | .key'; }
envidx() { kc -n ate-system get $1 -o json | jq -r --arg n objectstore-plugin '.spec.template.spec.initContainers[] | select(.name==$n) | .env | to_entries[] | select(.value.name=="AWS_ENDPOINT_URL") | .key'; }
wait_cluster() {
  kc -n ate-system rollout status ds/atelet --timeout=300s > /dev/null 2>&1
  kc -n ate-system rollout status deploy/ate-api-server --timeout=300s > /dev/null 2>&1
  for i in $(seq 1 80); do [ "$(allworkers_active)" -ge 4 ] && break; sleep 3; done
  log "cluster ready: workers active $(allworkers_active); endpoints: $(endpoints)"
}
endpoints() { for w in ds/atelet deploy/ate-api-server; do kc -n ate-system get $w -o json | jq -r '.spec.template.spec.initContainers[] | select(.name=="objectstore-plugin") | .env[] | select(.name=="AWS_ENDPOINT_URL") | .value'; done | tr '\n' ' '; }
set_endpoint() {
  url=$1
  for w in ds/atelet deploy/ate-api-server; do
    i=$(idx $w objectstore-plugin initContainers); e=$(envidx $w)
    kc -n ate-system patch $w --type=json -p "[{\"op\":\"replace\",\"path\":\"/spec/template/spec/initContainers/$i/env/$e/value\",\"value\":\"$url\"}]" >> 81-patches.log 2>&1
  done
  sleep 5; wait_cluster
}
set_timers() {
  i=$(idx ds/atelet atelet containers)
  cur=$(kc -n ate-system get ds atelet -o json | jq -r --argjson i $i '.spec.template.spec.containers[$i].args | join(" ")')
  case "$cur" in *snapshot-upload-delay*) log "timers already set";; *)
    kc -n ate-system patch ds atelet --type=json -p "[{\"op\":\"add\",\"path\":\"/spec/template/spec/containers/$i/args/-\",\"value\":\"--snapshot-upload-delay=3s\"},{\"op\":\"add\",\"path\":\"/spec/template/spec/containers/$i/args/-\",\"value\":\"--snapshot-detach-delay=10s\"}]" >> 81-patches.log 2>&1;;
  esac
  sleep 5; wait_cluster
  kc -n ate-system get ds atelet -o json | jq -r --argjson i $i '.spec.template.spec.containers[$i].args | join(" ")' > 82-atelet-args-patched.txt
}
unset_timers() {
  i=$(idx ds/atelet atelet containers)
  new=$(kc -n ate-system get ds atelet -o json | jq -c --argjson i $i '.spec.template.spec.containers[$i].args | map(select(test("snapshot-(upload|detach)-delay")|not))')
  kc -n ate-system patch ds atelet --type=json -p "[{\"op\":\"replace\",\"path\":\"/spec/template/spec/containers/$i/args\",\"value\":$new}]" >> 81-patches.log 2>&1
  sleep 5; wait_cluster
}
netem() {
  d=$1
  sudo tc qdisc del dev $BR root 2>/dev/null
  if [ "$d" != 0 ]; then
    sudo tc qdisc add dev $BR root handle 1: prio bands 3 priomap 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
    sudo tc qdisc add dev $BR parent 1:3 handle 30: netem delay ${d}ms
    sudo tc filter add dev $BR protocol ip parent 1:0 prio 1 u32 match ip sport 9100 0xffff flowid 1:3
  fi
  { echo "### netem ${d} ms $(ts)"; sudo tc qdisc show dev $BR; for i in 1 2 3 4 5; do sg docker -c "docker exec $O curl -s -o /dev/null -w 'connect=%{time_connect} total=%{time_total} code=%{http_code}\n' $EXT/"; done; } >> 83-netem-rtt.txt 2>&1
}
snapmb() { echo "$(sg docker -c "docker exec $V du -sm /var/lib/ate/snapshots" | cut -f1)+$(sg docker -c "docker exec $O du -sm /var/lib/ate/snapshots" | cut -f1)"; }
tmpl3() {
  pre=$1
  for spec in "0 250 262144000" "200 1000 471859200" "1000 1000 1363148800"; do
    set -- $spec
    sed -e "s/name: tb-$1\$/name: $pre-$1/" 02-tmpl-tb-$1.yaml > 84-tmpl-$pre-$1.yaml
    K create actor-template -f 84-tmpl-$pre-$1.yaml >> 85-templates.log 2>&1
  done
  for i in $(seq 1 90); do [ "$(K get actor-templates -a $S | grep -c -E "$pre-[0-9]+ +[0-9a-f-]{36}")" = 3 ] && break; sleep 4; done
  K get actor-templates -a $S >> 85-templates.log
}
OUT=90-store-cycles.tsv
[ -f $OUT ] || echo "ts	store	added_rtt_ms	mb	cycle	suspend_sync_s	suspend_out	detach_wait_s	local_mib_before_request	code	resume_s	body	state_after" > $OUT
cycles() {
  store=$1; rtt=$2; pre=$3; n=${4:-5}
  for mb in ${SIZES:-0}; do
    free_gb=$(df -BG / | awk 'NR==2{gsub("G","",$4); print $4}')
    if [ "$free_gb" -lt 6 ]; then log "SKIP $store rtt=$rtt mb=$mb: only $free_gb GB free on the guest disk"; continue; fi
    a=$store-$rtt-$mb; port=$((9200 + RANDOM % 500))
    K create actor $a -a $S --template $pre-$mb > /dev/null; proxy $a $port
    w="$(call $port 60)"; log "$a warmup $w | $(st $a | cut -f1,2)"
    for c in $(seq 1 $n); do
      call $port 30 > /dev/null
      s0=$(now); so=$(K suspend actor $a -a $S --mode sync | tail -1 | awk '{print $4}'); sus=$(el3 $s0)
      d0=$(now); for i in $(seq 1 120); do [ "$(nodeof $a)" = "-" ] && break; sleep 1; done; det=$(el $d0)
      sleep 2; lm=$(snapmb)
      r="$(call $port 120)"
      echo "$(ts)	$store	$rtt	$mb	$c	$sus	$so	$det	$lm	$r	$(st $a | cut -f1,2 | tr '\t' ' ')" >> $OUT
    done
    K suspend actor $a -a $S --mode sync > /dev/null 2>&1; K delete actor $a -a $S > /dev/null 2>&1; pkill -f "proxy actor $a " 2>/dev/null
    log "$a done; guest disk free $(df -h / | awk 'NR==2{print $4}'); local snapshots MiB $(snapmb)"
  done
}
el3() { echo "$(now) - $1" | bc -l | xargs printf '%.3f'; }

if [ "$PH" = all ] || [ "$PH" = base ]; then
  log "phase base: in-cluster rustfs, timers patched"
  delall; rebalance; set_timers
  cycles incluster 0 tb 5
  log "BASE-DONE"
fi

if [ "$PH" = all ] || [ "$PH" = ext ]; then
  log "phase ext: store as a container on the guest, host network, outside the kind network"
  sg docker -c "docker rm -f t-store" > /dev/null 2>&1
  sg docker -c "docker volume create t-store-data" > /dev/null
  sg docker -c "docker run -d --name t-store --network host -v t-store-data:/data -e RUSTFS_ADDRESS=:9100 -e RUSTFS_CONSOLE_ENABLE=false -e RUSTFS_VOLUMES=/data -e RUSTFS_ACCESS_KEY=<store-key> -e RUSTFS_SECRET_KEY=<store-key> rustfs/rustfs:1.0.3" >> 86-store-container.log 2>&1
  for i in $(seq 1 40); do s3ext s3api create-bucket --bucket ate-snapshots >> 86-store-container.log && break; sleep 3; done
  s3ext s3 ls >> 86-store-container.log
  sg docker -c "docker ps --filter name=t-store --format '{{.Names}} {{.Status}} {{.Image}}'" >> 86-store-container.log
  netem 0
  set_endpoint $EXT
  tmpl3 sb
  s3ext s3 ls s3://ate-snapshots --recursive --summarize | tail -3 >> 86-store-container.log
  for rtt in 0 20 100; do
    netem $rtt; log "netem $rtt ms set"
    cycles external $rtt sb 5
    s3ext s3 ls s3://ate-snapshots --recursive --summarize | tail -2 | tr '\n' ' ' >> 80-store-run.log; echo >> 80-store-run.log
  done
  netem 0
  log "EXT-DONE"
fi

if [ "$PH" = all ] || [ "$PH" = down ]; then
  log "phase down: store unreachable"
  T=95-store-unreachable.tsv; echo "ts	t	event	detail" > $T; T0=0
  tc_call() { s0=$(now); out="$("$@" 2>&1 | tr '\n' ' ' | cut -c1-300)"; echo "$(el3 $s0) s | $out"; }
  for a in u-run u-async u-remote; do K create actor $a -a $S --template sb-0 > /dev/null; done
  proxy u-run 9701; proxy u-async 9702; proxy u-remote 9703
  for p in 9701 9702 9703; do m warmup "$p $(call $p 60)"; done
  K suspend actor u-remote -a $S --mode sync > /dev/null
  for i in $(seq 1 120); do [ "$(nodeof u-remote)" = "-" ] && break; sleep 1; done
  m prepared "u-run: $(st u-run) | u-async: $(st u-async) | u-remote: $(st u-remote) | local MiB $(snapmb)"
  for mode in refused blackhole; do
    if [ $mode = refused ]; then sg docker -c "docker stop t-store" > /dev/null; else sudo iptables -I INPUT -p tcp --dport 9100 -j DROP; fi
    T0=$(now); m store-down "$mode"
    m probe-from-node "$(sg docker -c "docker exec $O curl -s -m 5 -o /dev/null -w 'code=%{http_code} total=%{time_total}' $EXT/" 2>&1)"
    m "$mode-request-remote-only" "$(call 9703 60)	|	$(st u-remote)"
    m "$mode-request-remote-only-2" "$(call 9703 60)	|	$(st u-remote)"
    m "$mode-running-request" "$(call 9701 20)	|	$(st u-run)"
    m "$mode-suspend-sync" "$(tc_call kubectl ate --context $C suspend actor u-run -a $S --mode sync)"
    m "$mode-state-after-suspend-sync" "$(st u-run)"
    m "$mode-request-after-failed-sync" "$(call 9701 30)	|	$(st u-run)"
    m "$mode-suspend-async" "$(tc_call kubectl ate --context $C suspend actor u-async -a $S)"
    sleep 20; m "$mode-state-20s-after-async" "$(st u-async)"
    m "$mode-request-after-async" "$(call 9702 30)	|	$(st u-async)"
    m "$mode-create-actor" "$(tc_call kubectl ate --context $C create actor u-new-$mode -a $S --template sb-0)"
    proxy u-new-$mode 9704; m "$mode-request-new-actor" "$(call 9704 40)	|	$(st u-new-$mode)"
    if [ $mode = refused ]; then sg docker -c "docker start t-store" > /dev/null; else sudo iptables -D INPUT -p tcp --dport 9100 -j DROP; fi
    s0=$(now); m store-back "$mode after $(el $T0) s"
    for i in $(seq 1 40); do r="$(call 9703 30)"; m "$mode-remote-only-after-store-back" "$(el $s0) s	$r	|	$(st u-remote)"; case "$r" in 200*) break;; esac; sleep 3; done
    m "$mode-suspend-sync-after-store-back" "$(tc_call kubectl ate --context $C suspend actor u-run -a $S --mode sync)"
    m "$mode-states" "u-run: $(st u-run) | u-async: $(st u-async) | u-remote: $(st u-remote)"
    m "$mode-request-u-run" "$(call 9701 30)	|	$(st u-run)"
    m "$mode-request-u-async" "$(call 9702 30)	|	$(st u-async)"
    m "$mode-request-new-actor-after-store-back" "$(call 9704 40)	|	$(st u-new-$mode)"
    K suspend actor u-remote -a $S --mode sync > /dev/null 2>&1
    for i in $(seq 1 120); do [ "$(nodeof u-remote)" = "-" ] && break; sleep 1; done
    T0=0
  done
  for p in $(kc -n ate-system get pods -o name | grep -E "ate-api-server|atelet"); do kc -n ate-system logs $p --all-containers --since=30m 2>/dev/null | grep -i -E "9100|objectstore|upload|download" | grep -i -E "error|fail|refused|timeout|deadline" | tail -15 | cut -c1-330; done > 96-store-unreachable-logs.log
  log "DOWN-DONE"
fi

if [ "$PH" = all ] || [ "$PH" = restore ]; then
  log "phase restore"
  sudo iptables -D INPUT -p tcp --dport 9100 -j DROP 2>/dev/null
  netem 0; sudo tc qdisc del dev $BR root 2>/dev/null
  pkill -f "context $C proxy actor" 2>/dev/null
  delall
  for t in sb-0 sb-200 sb-1000; do K delete actor-template $t -a $S >> 85-templates.log 2>&1; done
  s3ext s3 ls s3://ate-snapshots --recursive --summarize | tail -2 | tr '\n' ' ' >> 80-store-run.log; echo >> 80-store-run.log
  set_endpoint $INT
  unset_timers
  sg docker -c "docker stop t-store" > /dev/null 2>&1
  rebalance
  K create actor chk -a $S --template tb-50 > /dev/null; proxy chk 9990
  log "check after restore: $(call 9990 60) | $(st chk | cut -f1,2)"
  K suspend actor chk -a $S --mode sync > /dev/null; log "sync suspend after restore: $(st chk)"; K delete actor chk -a $S > /dev/null; pkill -f "proxy actor chk "
  kc -n ate-system get ds atelet -o json | jq -r '.spec.template.spec.containers[] | select(.name=="atelet") | (.args|join(" "))' > 98-atelet-args-restored.txt
  log "RESTORE-DONE endpoints: $(endpoints)"
fi
echo "$(ts) STORE-$PH-DONE" >> 00-run.log
