export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
E=~/evidence/C-resume-vs-size; cd "$E"
S=lab-c
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
now() { date +%s.%N; }
el() { echo "$(now) - $1" | bc -l | xargs printf '%.3f'; }
OUT=10-local.tsv
echo "mb	phase	i	http	seconds	detail" > $OUT
K get actor-templates -a $S > 09-templates-at-start.txt
port=8100
for mb in 0 50 200 500 1000; do
  for i in 1 2 3 4 5; do
    a=b$mb-$i; port=$((port+1))
    s=$(now); K create actor $a -a $S --template ballast-$mb > /dev/null; echo "$mb	create-actor	$i	-	$(el $s)	cli" >> $OUT
    (kubectl ate proxy actor $a -a $S $port:80 > proxy-$a.log 2>&1 &)
    for t in 1 2 3 4 5 6 7 8 9 10; do grep -q Proxying proxy-$a.log 2>/dev/null && break; sleep 0.3; done
    r=$(curl -s -m 120 -o body.tmp -w '%{http_code}\t%{time_total}' http://127.0.0.1:$port/)
    echo "$mb	first-call-golden	$i	$r	$(tr -d '\n' < body.tmp)" >> $OUT
    r=$(curl -s -m 120 -o body.tmp -w '%{http_code}\t%{time_total}' http://127.0.0.1:$port/)
    echo "$mb	warm-call	$i	$r	$(tr -d '\n' < body.tmp)" >> $OUT
    if [ $i = 1 ]; then p1=$port; fi
  done
  a=b$mb-1
  for c in 1 2 3 4 5 6 7 8 9 10; do
    s=$(now); K suspend actor $a -a $S > /dev/null; echo "$mb	suspend-async	$c	-	$(el $s)	cli" >> $OUT
    if [ $c = 1 ]; then
      K get actor $a -a $S -o json > actor-$a-suspended.json
      sg docker -c "docker exec kind-control-plane sh -c 'du -sm /var/lib/ate/snapshots/* 2>/dev/null | sort -n | tail -5; du -sm /var/lib/ate/snapshots'" > snapdir-after-$a.txt 2>&1
    fi
    sleep 1
    r=$(curl -s -m 120 -o body.tmp -w '%{http_code}\t%{time_total}' http://127.0.0.1:$p1/)
    echo "$mb	resume-local	$c	$r	$(tr -d '\n' < body.tmp)" >> $OUT
  done
  K logs actor $a -a $S --source=lifecycle > lifecycle-$a.log 2>&1
done
K get actors -a $S > 11-actors-end.txt
K get workers -a $S > 12-workers-end.txt
echo DONE >> $OUT
