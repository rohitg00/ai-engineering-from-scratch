. ~/scripts/t-lib.sh
E=~/evidence/X-remote-store-pg; mkdir -p "$E"; cd "$E"
pkill -f "context $C proxy actor" 2>/dev/null
PH=${1:-all}
TD=~/evidence/T-drain-store
BR=$(ip -o -4 addr | awk '$4 ~ /^172\.18\./{print $2}')
WAN=ens3
GWIP=10.0.2.2
EXT=http://$GWIP:19000
EXTTLS=https://$GWIP:19001
INT=http://rustfs.ate-system.svc:9000
plugenv() { kc -n ate-system get deploy ate-api-server -o json | jq -r --arg n "$1" '.spec.template.spec.initContainers[] | select(.name=="objectstore-plugin") | .env[] | select(.name==$n) | .value'; }
AK=$(plugenv AWS_ACCESS_KEY_ID); SK=$(plugenv AWS_SECRET_ACCESS_KEY)
AWSIMG=$(sg docker -c "docker images --format '{{.Repository}} {{.ID}}'" | awk '$1=="amazon/aws-cli"{print $2; exit}')
s3x() { ep=$1; shift; sg docker -c "docker run --rm --network host -v $HOME/x:/x -e AWS_CA_BUNDLE=/x/tls/ca.crt -e AWS_ACCESS_KEY_ID=$AK -e AWS_SECRET_ACCESS_KEY=$SK -e AWS_REGION=us-east-1 $AWSIMG --endpoint-url $ep $*" 2>&1; }
log() { echo "$(ts) $*" >> 10-store-run.log; }
el3() { echo "$(now) - $1" | bc -l | xargs printf '%.3f'; }
idx() { kc -n ate-system get $1 -o json | jq -r --arg n "$2" --arg f "$3" '.spec.template.spec[$f] | to_entries[] | select(.value.name==$n) | .key'; }
envidx() { kc -n ate-system get $1 -o json | jq -r --arg e "$2" '.spec.template.spec.initContainers[] | select(.name=="objectstore-plugin") | .env | to_entries[] | select(.value.name==$e) | .key'; }
endpoints() { for w in ds/atelet deploy/ate-api-server; do kc -n ate-system get $w -o json | jq -r '.spec.template.spec.initContainers[] | select(.name=="objectstore-plugin") | [.env[] | select(.name=="AWS_ENDPOINT_URL" or .name=="AWS_CA_BUNDLE") | .name + "=" + .value] | join(",")'; done | tr '\n' ' '; }
wait_cluster() {
  kc -n ate-system rollout status ds/atelet --timeout=300s > /dev/null 2>&1
  kc -n ate-system rollout status deploy/ate-api-server --timeout=300s > /dev/null 2>&1
  for i in $(seq 1 80); do [ "$(allworkers_active)" -ge 4 ] && break; sleep 3; done
  log "cluster ready: workers active $(allworkers_active); $(endpoints)"
}
set_endpoint() {
  url=$1
  for w in ds/atelet deploy/ate-api-server; do
    i=$(idx $w objectstore-plugin initContainers); e=$(envidx $w AWS_ENDPOINT_URL)
    kc -n ate-system patch $w --type=json -p "[{\"op\":\"replace\",\"path\":\"/spec/template/spec/initContainers/$i/env/$e/value\",\"value\":\"$url\"}]" >> 11-patches.log 2>&1
  done
  sleep 5; wait_cluster
}
set_ca() {
  kc -n ate-system create configmap x-store-ca --from-file=ca.crt=$HOME/x/tls/ca.crt --dry-run=client -o yaml | kc apply -f - >> 11-patches.log 2>&1
  for w in ds/atelet deploy/ate-api-server; do
    i=$(idx $w objectstore-plugin initContainers)
    [ -n "$(envidx $w AWS_CA_BUNDLE)" ] && continue
    kc -n ate-system patch $w --type=json -p "[{\"op\":\"add\",\"path\":\"/spec/template/spec/volumes/-\",\"value\":{\"name\":\"x-store-ca\",\"configMap\":{\"name\":\"x-store-ca\"}}},{\"op\":\"add\",\"path\":\"/spec/template/spec/initContainers/$i/volumeMounts/-\",\"value\":{\"name\":\"x-store-ca\",\"mountPath\":\"/x-store-ca\",\"readOnly\":true}},{\"op\":\"add\",\"path\":\"/spec/template/spec/initContainers/$i/env/-\",\"value\":{\"name\":\"AWS_CA_BUNDLE\",\"value\":\"/x-store-ca/ca.crt\"}}]" >> 11-patches.log 2>&1
  done
}
unset_ca() {
  for w in ds/atelet deploy/ate-api-server; do
    i=$(idx $w objectstore-plugin initContainers); e=$(envidx $w AWS_CA_BUNDLE)
    [ -z "$e" ] && continue
    v=$(kc -n ate-system get $w -o json | jq -r '.spec.template.spec.volumes | to_entries[] | select(.value.name=="x-store-ca") | .key')
    vm=$(kc -n ate-system get $w -o json | jq -r --argjson i $i '.spec.template.spec.initContainers[$i].volumeMounts | to_entries[] | select(.value.name=="x-store-ca") | .key')
    kc -n ate-system patch $w --type=json -p "[{\"op\":\"remove\",\"path\":\"/spec/template/spec/initContainers/$i/env/$e\"},{\"op\":\"remove\",\"path\":\"/spec/template/spec/initContainers/$i/volumeMounts/$vm\"},{\"op\":\"remove\",\"path\":\"/spec/template/spec/volumes/$v\"}]" >> 11-patches.log 2>&1
  done
  kc -n ate-system delete configmap x-store-ca >> 11-patches.log 2>&1
}
set_timers() {
  i=$(idx ds/atelet atelet containers)
  cur=$(kc -n ate-system get ds atelet -o json | jq -r --argjson i $i '.spec.template.spec.containers[$i].args | join(" ")')
  echo "$cur" > 12-atelet-args-before.txt
  case "$cur" in *snapshot-upload-delay*) log "timers already set";; *)
    kc -n ate-system patch ds atelet --type=json -p "[{\"op\":\"add\",\"path\":\"/spec/template/spec/containers/$i/args/-\",\"value\":\"--snapshot-upload-delay=3s\"},{\"op\":\"add\",\"path\":\"/spec/template/spec/containers/$i/args/-\",\"value\":\"--snapshot-detach-delay=10s\"}]" >> 11-patches.log 2>&1;;
  esac
  sleep 5; wait_cluster
  kc -n ate-system get ds atelet -o json | jq -r --argjson i $i '.spec.template.spec.containers[$i].args | join(" ")' > 12-atelet-args-patched.txt
}
unset_timers() {
  i=$(idx ds/atelet atelet containers)
  new=$(kc -n ate-system get ds atelet -o json | jq -c --argjson i $i '.spec.template.spec.containers[$i].args | map(select(test("snapshot-(upload|detach)-delay")|not))')
  kc -n ate-system patch ds atelet --type=json -p "[{\"op\":\"replace\",\"path\":\"/spec/template/spec/containers/$i/args\",\"value\":$new}]" >> 11-patches.log 2>&1
  sleep 5; wait_cluster
}
shape() {
  d=$1; r=$2
  sudo tc qdisc del dev $WAN root 2>/dev/null; sudo tc qdisc del dev $BR root 2>/dev/null
  if [ "$d" != 0 ] || [ "$r" != 0 ]; then
    up="netem"; [ "$d" != 0 ] && up="$up delay ${d}ms"; [ "$r" != 0 ] && up="$up rate ${r}mbit"
    sudo tc qdisc add dev $WAN root handle 1: prio bands 3 priomap 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
    sudo tc qdisc add dev $WAN parent 1:3 handle 30: $up
    for p in 19000 19001; do sudo tc filter add dev $WAN protocol ip parent 1:0 prio 1 u32 match ip dst $GWIP/32 match ip dport $p 0xffff flowid 1:3; done
    if [ "$r" != 0 ]; then
      sudo tc qdisc add dev $BR root handle 1: prio bands 3 priomap 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
      sudo tc qdisc add dev $BR parent 1:3 handle 30: netem rate ${r}mbit
      for p in 19000 19001; do sudo tc filter add dev $BR protocol ip parent 1:0 prio 1 u32 match ip src $GWIP/32 match ip sport $p 0xffff flowid 1:3; done
    fi
  fi
}
pathcheck() {
  lbl=$1; ep=${2:-$EXT}
  {
    echo "### $lbl $(ts) endpoint $ep"
    echo "wan: $(sudo tc qdisc show dev $WAN | tr '\n' ';')"; echo "bridge: $(sudo tc qdisc show dev $BR | tr '\n' ';')"
    for i in 1 2 3 4 5; do sg docker -c "docker exec $O curl -s -k -o /dev/null -w 'from-node connect=%{time_connect} total=%{time_total} code=%{http_code}\n' $ep/"; done
    [ -f ~/x/blob300 ] || dd if=/dev/urandom of=$HOME/x/blob300 bs=1M count=300 status=none
    s0=$(now); s3x $ep s3 cp /x/blob300 s3://ate-snapshots/x-path/blob300 --only-show-errors | tail -1; u=$(el3 $s0)
    s0=$(now); s3x $ep s3 cp s3://ate-snapshots/x-path/blob300 /x/blob300.back --only-show-errors | tail -1; dl=$(el3 $s0)
    echo "aws s3 cp 300 MiB from the guest: upload ${u} s, download ${dl} s (includes about 1 s of container start)"
    s0=$(now); s3x $ep s3 ls s3://ate-snapshots/x-path/ > /dev/null; echo "aws s3 ls (container start plus one list call): $(el3 $s0) s"
    rm -f ~/x/blob300.back; s3x $ep s3 rm s3://ate-snapshots/x-path/blob300 --only-show-errors
  } >> 13-path.txt 2>&1
}
snapmb() { echo "$(sg docker -c "docker exec $V du -sm /var/lib/ate/snapshots" | cut -f1)+$(sg docker -c "docker exec $O du -sm /var/lib/ate/snapshots" | cut -f1)"; }
tmpl3() {
  pre=$1
  for mb in 0 200 1000; do
    sed -e "s/name: tb-$mb\$/name: $pre-$mb/" $TD/02-tmpl-tb-$mb.yaml > 14-tmpl-$pre-$mb.yaml
    K create actor-template -f 14-tmpl-$pre-$mb.yaml >> 15-templates.log 2>&1
  done
  for i in $(seq 1 120); do [ "$(K get actor-templates -a $S | grep -c -E "$pre-[0-9]+ +[0-9a-f-]{36}")" = 3 ] && break; sleep 4; done
  K get actor-templates -a $S >> 15-templates.log
}
OUT=22-store-cycles.tsv
[ -f $OUT ] || echo "ts	label	added_rtt_ms	rate_mbit	mb	cycle	suspend_sync_s	suspend_out	detach_wait_s	local_mib_before_request	first_code	first_s	tries	total_to_200_s	body	state_after" > $OUT
until200() {
  port=$1; a=$2; q0=$(now); FIRST=""; TRIES=0
  for k in $(seq 1 40); do
    r="$(call $port 400)"; TRIES=$k
    [ -z "$FIRST" ] && FIRST="$(echo "$r" | cut -f1,2)"
    case "$r" in 200*) break;; esac
    case "$(st $a | cut -f1)" in ACTOR_STATE_CRASHED) K revert actor $a -a $S > /dev/null 2>&1; log "$a was CRASHED after a failed request; reverted";; esac
    sleep 1
  done
  TOTAL=$(el3 $q0); BODY="$(echo "$r" | cut -f3)"; LASTCODE="$(echo "$r" | cut -f1)"
}
cycles() {
  lbl=$1; rtt=$2; rate=$3; sizes=$4; n=${5:-5}
  for mb in $sizes; do
    free_gb=$(df -BG / | awk 'NR==2{gsub("G","",$4); print $4}')
    if [ "$free_gb" -lt 5 ]; then log "SKIP $lbl rtt=$rtt rate=$rate mb=$mb: only $free_gb GB free on the guest disk"; continue; fi
    a=$lbl-$rtt-$rate-$mb; port=$((9200 + RANDOM % 500))
    K create actor $a -a $S --template xb-$mb > /dev/null; proxy $a $port
    until200 $port $a; log "$a first activation: first answer $FIRST, tries $TRIES, 200 after $TOTAL s | $(st $a | cut -f1,2)"
    for c in $(seq 1 $n); do
      call $port 60 > /dev/null
      s0=$(now); so=$(K suspend actor $a -a $S --mode sync | tail -1 | cut -c1-160 | tr '\t' ' '); sus=$(el3 $s0)
      d0=$(now); for i in $(seq 1 200); do [ "$(nodeof $a)" = "-" ] && break; sleep 1; done; det=$(el $d0)
      sleep 2; lm=$(snapmb)
      until200 $port $a
      echo "$(ts)	$lbl	$rtt	$rate	$mb	$c	$sus	$so	$det	$lm	$FIRST	$TRIES	$TOTAL	$BODY	$(st $a | cut -f1,2 | tr '\t' ' ') last=$LASTCODE" >> $OUT
    done
    K suspend actor $a -a $S --mode sync > /dev/null 2>&1; K delete actor $a -a $S > /dev/null 2>&1; pkill -f "proxy actor $a " 2>/dev/null
    log "$a done; guest disk free $(df -h / | awk 'NR==2{print $4}'); local snapshots MiB $(snapmb)"
  done
  sudo fstrim / 2>/dev/null
}

if [ "$PH" = prep ]; then
  log "phase prep: remove what experiment T left, timers, endpoint to the store on the other guest"
  sg docker -c "docker rm -f t-store" >> 10-store-run.log 2>&1; sg docker -c "docker volume rm t-store-data" >> 10-store-run.log 2>&1
  mkdir -p ~/x
  delall; rebalance; set_timers
  for i in $(seq 1 20); do s3x $EXT s3api create-bucket --bucket ate-snapshots >> 16-store.log && break; sleep 3; done
  s3x $EXT s3 ls >> 16-store.log
  shape 0 0
  pathcheck "no shaping, plain HTTP"
  set_endpoint $EXT
  tmpl3 xb
  s3x $EXT s3 ls s3://ate-snapshots --recursive --summarize | tail -3 >> 16-store.log
  log "PREP-DONE"
fi

if [ "$PH" = plain ]; then
  shape 0 0; log "phase plain: no shaping"
  cycles remote 0 0 "0 200 1000" 5
  log "PLAIN-DONE"
fi

if [ "$PH" = rtt100 ]; then
  shape 100 0; log "phase rtt100"; pathcheck "100 ms added, plain HTTP"
  cycles remote 100 0 "0 200 1000" 5
  shape 0 0
  log "RTT100-DONE"
fi

if [ "$PH" = rate ]; then
  for r in 100 20; do
    shape 0 $r; log "phase rate $r mbit"; pathcheck "rate ${r} Mbit/s both directions, plain HTTP"
    cycles remote 0 $r "200" 5
  done
  shape 0 0
  log "RATE-DONE"
fi

if [ "$PH" = tls ]; then
  shape 0 0; log "phase tls: endpoint $EXTTLS with AWS_CA_BUNDLE"
  set_ca; set_endpoint $EXTTLS
  pathcheck "no shaping, TLS" $EXTTLS
  cycles remote-tls 0 0 "0 200 1000" 5
  for p in $(kc -n ate-system get pods -o name | grep -E "atelet"); do kc -n ate-system logs $p -c objectstore-plugin --since=30m 2>/dev/null | grep -i -E "x509|tls|certificate" | tail -5 | cut -c1-300; done > 17-tls-plugin-log.txt
  log "TLS-DONE"
fi

if [ "$PH" = restore ]; then
  log "phase restore"
  sudo iptables -D FORWARD -d $GWIP -p tcp -m multiport --dports 19000,19001 -j DROP 2>/dev/null
  sudo iptables -D OUTPUT -d $GWIP -p tcp -m multiport --dports 19000,19001 -j DROP 2>/dev/null
  shape 0 0
  pkill -f "context $C proxy actor" 2>/dev/null
  delall
  for t in xb-0 xb-200 xb-1000; do K delete actor-template $t -a $S >> 15-templates.log 2>&1; done
  set_endpoint $INT
  unset_ca
  sleep 5; wait_cluster
  unset_timers
  rebalance
  K create actor chk -a $S --template tb-50 > /dev/null; proxy chk 9990
  log "check after restore: $(call 9990 60) | $(st chk | cut -f1,2)"
  K suspend actor chk -a $S --mode sync > /dev/null; log "sync suspend after restore: $(st chk)"; K delete actor chk -a $S > /dev/null; pkill -f "proxy actor chk "
  kc -n ate-system get ds atelet -o json | jq -r '.spec.template.spec.containers[] | select(.name=="atelet") | (.args|join(" "))' > 12-atelet-args-restored.txt
  { echo "wan: $(sudo tc qdisc show dev $WAN | tr '\n' ';')"; echo "bridge: $(sudo tc qdisc show dev $BR | tr '\n' ';')"; sudo iptables -S FORWARD | grep -c 10.0.2.2; } > 18-shaping-after-restore.txt 2>&1
  sudo fstrim / 2>/dev/null
  log "RESTORE-DONE $(endpoints)"
fi
echo "$(ts) STORE-$PH-DONE" >> 00-run.log
