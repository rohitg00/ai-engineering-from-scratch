. ~/scripts/vlib.sh
while ! grep -q DONE $V/10-preview-feature/10-preview.tsv 2>/dev/null; do sleep 10; done
cd $V/03-parallel-resume
mv 10-parallel.tsv 10-parallel-first-run-n16-n32.tsv
grep -v -P '^(1|2|4|8)\t' 10-parallel-first-run-n16-n32.tsv > t.tmp && mv t.tmp 10-parallel-first-run-n16-n32.tsv
OUT=20-parallel.tsv; echo "n	round	actor	http	seconds	detail" > $OUT
K get workers -n lab-v > 21-workers-before.txt
ids=$(seq -f %02g 1 16)
for i in $ids; do K create actor q$i -a $S --template par-50 > /dev/null; proxy q$i 93$i; done
for i in $ids; do call 93$i > /dev/null; done
for i in $ids; do K suspend actor q$i -a $S --mode sync > /dev/null & done; wait
burst() {
  n=$1; round=$2; list=$3
  for i in $list; do
    ( r=$(curl -s -m 60 -o b-$i.tmp -w '%{http_code}\t%{time_total}' http://127.0.0.1:93$i/); echo "$n	$round	q$i	$r	$(tr -d '\n' < b-$i.tmp | cut -c1-90)" >> $OUT ) &
  done
  wait
}
for n in 1 2 4 8 16; do
  list=$(seq -f %02g 1 $n | tr '\n' ' ')
  for round in 1 2 3 4 5; do
    burst $n $round "$list"
    for i in $list; do K suspend actor q$i -a $S > /dev/null & done; wait
    sleep 2
  done
done
for i in $ids; do K logs actor q$i -a $S --source=lifecycle 2>/dev/null | tail -2; done > 22-lifecycle-tails.log
kubectl -n ate-system logs deploy/atenet-router --all-containers --since=4m 2>/dev/null | grep -i -c park > 23-router-park-line-count.txt
pkill -f "proxy actor q"
for i in $ids; do K delete actor q$i -a $S > /dev/null 2>&1 & done; wait
rm -f b-*.tmp
echo DONE >> $OUT
sudo fstrim -v / > /dev/null
