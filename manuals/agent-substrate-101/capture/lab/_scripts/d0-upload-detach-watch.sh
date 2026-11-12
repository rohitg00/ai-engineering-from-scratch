export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
E=~/evidence/D-durability; mkdir -p "$E"; cd "$E"
S=lab-c; T=10-watch.tsv
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
now() { date -u +%FT%T.%3NZ; }
st() { kubectl ate get actor $1 -a $S -o json 2>/dev/null | jq -r '[.status.state, (.status.assignedNode // "-"), ((.status.snapshots // []) | map(.owner + ":" + (.durableSnapshot.state // "none") + ":gen" + (.generation|tostring) + ":" + (.locality // "-" | tostring)) | join(","))] | @tsv'; }
call() { curl -s -m 180 -o body.tmp -w '%{http_code}\t%{time_total}' http://127.0.0.1:$1/; printf '\t%s' "$(tr -d '\n' < body.tmp)"; }
kubectl -n ate-system get ds atelet -o json | jq -r '.spec.template.spec.containers[] | .name + " " + (.args // [] | join(" "))' > 00-atelet-args.txt
echo "ts	actor	event	detail" > $T
port=8200
for mb in 0 50 200 500 1000; do
  a=d$mb; port=$((port+1))
  K create actor $a -a $S --template ballast-$mb > /dev/null
  (kubectl ate proxy actor $a -a $S $port:80 > proxy-$a.log 2>&1 &)
  for t in $(seq 1 20); do grep -q Proxying proxy-$a.log 2>/dev/null && break; sleep 0.3; done
  echo "$(now)	$a	first-call	$(call $port)" >> $T
  echo "$(now)	$a	second-call	$(call $port)" >> $T
done
for mb in 0 50 200 500 1000; do
  a=d$mb
  K suspend actor $a -a $S > /dev/null
  echo "$(now)	$a	suspended-async	$(st $a)" >> $T
done
K get actor d200 -a $S -o yaml > 11-d200-just-suspended.yaml
for i in $(seq 1 228); do
  for mb in 0 50 200 500 1000; do echo "$(now)	d$mb	state	$(st d$mb)" >> $T; done
  if [ $((i % 6)) = 0 ]; then
    echo "$(now)	node	local-snapshots-MiB	$(sg docker -c "docker exec kind-control-plane du -sm /var/lib/ate/snapshots" | cut -f1)" >> $T
  fi
  sleep 10
done
K get actor d200 -a $S -o yaml > 12-d200-after-38min.yaml
port=8200
for mb in 0 50 200 500 1000; do
  a=d$mb; port=$((port+1))
  echo "$(now)	$a	resume-after-detach	$(call $port)" >> $T
  echo "$(now)	$a	warm	$(call $port)" >> $T
  echo "$(now)	$a	state	$(st $a)" >> $T
done
echo DONE >> $T
