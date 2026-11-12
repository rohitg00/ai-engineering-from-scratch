. ~/scripts/x1-store.sh none
LOC=http://172.18.0.1:9100
log "phase local100: the method of experiment T (store as a container on this guest, host network), 100 ms added on the bridge"
s3l() { sg docker -c "docker run --rm --network host -e AWS_ACCESS_KEY_ID=$AK -e AWS_SECRET_ACCESS_KEY=$SK -e AWS_REGION=us-east-1 $AWSIMG --endpoint-url http://127.0.0.1:9100 $*" 2>&1; }
sg docker -c "docker rm -f x-local" > /dev/null 2>&1; sg docker -c "docker volume create x-local-data" > /dev/null
sg docker -c "docker run -d --name x-local --network host -v x-local-data:/data -e RUSTFS_ADDRESS=:9100 -e RUSTFS_CONSOLE_ENABLE=false -e RUSTFS_VOLUMES=/data -e RUSTFS_ACCESS_KEY=$AK -e RUSTFS_SECRET_KEY=$SK rustfs/rustfs:1.0.3" >> 16-store.log 2>&1
for i in $(seq 1 40); do s3l s3api create-bucket --bucket ate-snapshots >> 16-store.log && break; sleep 3; done
shape 0 0
delall
set_endpoint $LOC
for mb in 200 1000; do
  sed -e "s/name: tb-$mb\$/name: lb-$mb/" $TD/02-tmpl-tb-$mb.yaml > 14-tmpl-lb-$mb.yaml
  K create actor-template -f 14-tmpl-lb-$mb.yaml >> 15-templates.log 2>&1
done
for i in $(seq 1 120); do [ "$(K get actor-templates -a $S | grep -c -E "lb-[0-9]+ +[0-9a-f-]{36}")" = 2 ] && break; sleep 4; done
K get actor-templates -a $S >> 15-templates.log
sudo tc qdisc add dev $BR root handle 1: prio bands 3 priomap 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
sudo tc qdisc add dev $BR parent 1:3 handle 30: netem delay 100ms
sudo tc filter add dev $BR protocol ip parent 1:0 prio 1 u32 match ip sport 9100 0xffff flowid 1:3
{ echo "### local store, 100 ms added on the bridge $(ts)"; sudo tc qdisc show dev $BR | tr '\n' ';'; echo; for i in 1 2 3 4 5; do sg docker -c "docker exec $O curl -s -o /dev/null -w 'from-node connect=%{time_connect} total=%{time_total} code=%{http_code}\n' $LOC/"; done; } >> 13-path.txt 2>&1
for mb in 200 1000; do
  a=local-100-0-$mb; port=$((9200 + RANDOM % 500))
  K create actor $a -a $S --template lb-$mb > /dev/null; proxy $a $port
  until200 $port $a; log "$a first activation: first answer $FIRST, tries $TRIES, 200 after $TOTAL s | $(st $a | cut -f1,2)"
  for c in 1 2 3 4 5; do
    call $port 60 > /dev/null
    s0=$(now); so=$(K suspend actor $a -a $S --mode sync | tail -1 | cut -c1-160 | tr '\t' ' '); sus=$(el3 $s0)
    d0=$(now); for i in $(seq 1 200); do [ "$(nodeof $a)" = "-" ] && break; sleep 1; done; det=$(el $d0)
    sleep 2; lm=$(snapmb)
    until200 $port $a
    echo "$(ts)	local	100	0	$mb	$c	$sus	$so	$det	$lm	$FIRST	$TRIES	$TOTAL	$BODY	$(st $a | cut -f1,2 | tr '\t' ' ') last=$LASTCODE" >> $OUT
  done
  K suspend actor $a -a $S --mode sync > /dev/null 2>&1; K delete actor $a -a $S > /dev/null 2>&1; pkill -f "proxy actor $a " 2>/dev/null
  log "$a done; guest disk free $(df -h / | awk 'NR==2{print $4}')"
done
sudo tc qdisc del dev $BR root 2>/dev/null
delall
for t in lb-200 lb-1000; do K delete actor-template $t -a $S >> 15-templates.log 2>&1; done
set_endpoint $EXT
sg docker -c "docker rm -f x-local" > /dev/null 2>&1; sg docker -c "docker volume rm x-local-data" > /dev/null 2>&1
sudo fstrim / 2>/dev/null
log "LOCAL100-DONE $(endpoints)"
echo "$(ts) LOCAL100-DONE" >> 00-run.log
