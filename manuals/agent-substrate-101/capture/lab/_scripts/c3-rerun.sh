export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
pkill -f c2-measure-local.sh; sleep 1
E=~/evidence/C-resume-vs-size; cd "$E"
S=lab-c
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
mkdir -p ~/evidence/I-capacity
cp 10-local.tsv ~/evidence/I-capacity/01-unplanned-full-pool-503.tsv
K get workers -a $S > ~/evidence/I-capacity/02-workers-when-full.txt
K get actors -a $S > ~/evidence/I-capacity/03-actors-when-full.txt
pkill -f "proxy actor b" ; sleep 1
for a in $(K get actors -a $S -o json | jq -r '.. | objects | select(.metadata.atespace=="lab-c" and (.metadata.name|startswith("b"))) | .metadata.name' | sort -u); do K delete actor $a -a $S > /dev/null; done
rm -f proxy-b*.log lifecycle-b*.log actor-b*.json snapdir-after-*.txt
K get actors -a $S
now() { date +%s.%N; }
el() { echo "$(now) - $1" | bc -l | xargs printf '%.3f'; }
call() { curl -s -m 180 -o body.tmp -w '%{http_code}\t%{time_total}' http://127.0.0.1:$1/; printf '\t%s' "$(tr -d '\n' < body.tmp)"; }
OUT=10-local.tsv
echo "mb	phase	i	http	seconds	detail" > $OUT
K get actor-templates -a $S > 09-templates-at-start.txt
port=8100
for mb in 0 50 200 500 1000; do
  for i in 1 2 3 4 5; do
    a=b$mb-$i; port=$((port+1))
    s=$(now); K create actor $a -a $S --template ballast-$mb > /dev/null; echo "$mb	create-actor	$i	-	$(el $s)	cli" >> $OUT
    (kubectl ate proxy actor $a -a $S $port:80 > proxy-$a.log 2>&1 &)
    for t in $(seq 1 20); do grep -q Proxying proxy-$a.log 2>/dev/null && break; sleep 0.3; done
    echo "$mb	first-call-golden	$i	$(call $port)" >> $OUT
    echo "$mb	warm-call	$i	$(call $port)" >> $OUT
    if [ $i = 1 ]; then
      for c in $(seq 1 10); do
        s=$(now); K suspend actor $a -a $S > /dev/null; echo "$mb	suspend-async	$c	-	$(el $s)	cli" >> $OUT
        if [ $c = 1 ]; then
          K get actor $a -a $S -o json > actor-$a-suspended.json
          uid=$(jq -r .metadata.uid actor-$a-suspended.json)
          sg docker -c "docker exec kind-control-plane sh -c 'du -sk /var/lib/ate/snapshots/$uid; find /var/lib/ate/snapshots/$uid -type f -printf \"%s %p\n\" | sort -n | tail -8'" > snapdir-$a.txt 2>&1
        fi
        sleep 1
        echo "$mb	resume-local	$c	$(call $port)" >> $OUT
      done
      K logs actor $a -a $S --source=lifecycle > lifecycle-$a.log 2>&1
    fi
    s=$(now); K suspend actor $a -a $S --mode sync > /dev/null; echo "$mb	suspend-sync	$i	-	$(el $s)	cli" >> $OUT
  done
done
K get actors -a $S > 11-actors-end.txt
echo DONE >> $OUT
