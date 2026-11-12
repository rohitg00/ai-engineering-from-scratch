. ~/scripts/vlib.sh
cycle() {
  a=$1; label=$2; port=$3; OUT=$4
  s=$(now); K create actor $a -a $S --template $label > /dev/null; echo "$label	create-actor	1	-	$(el $s)	cli" >> $OUT
  proxy $a $port
  echo "$label	first-call-golden	1	$(call $port)" >> $OUT
  echo "$label	warm-call	0	$(call $port)" >> $OUT
  for c in $(seq 1 10); do
    s=$(now); K suspend actor $a -a $S > /dev/null; echo "$label	suspend-async	$c	-	$(el $s)	cli" >> $OUT
    if [ $c = 1 ]; then echo "$label	local-snapshot-kib	1	-	$(localsize $a)	du" >> $OUT; echo "$label	state-after-async	1	-	0	$(st $a)" >> $OUT; fi
    sleep 1
    echo "$label	resume-local	$c	$(call $port)" >> $OUT
    echo "$label	warm-call	$c	$(call $port)" >> $OUT
  done
  for c in 1 2 3; do
    s=$(now); K suspend actor $a -a $S --mode sync > /dev/null; echo "$label	suspend-sync	$c	-	$(el $s)	cli" >> $OUT
    if [ $c = 1 ]; then echo "$label	store-snapshot-kib	1	-	$(storesize $a)	du-in-rustfs" >> $OUT; echo "$label	local-after-sync-kib	1	-	$(localsize $a)	du" >> $OUT; K get actor $a -a $S -o yaml > actor-$a-suspended.yaml; fi
    echo "$label	resume-after-sync	$c	$(call $port)" >> $OUT
  done
  K logs actor $a -a $S --source=lifecycle > lifecycle-$a.log 2>&1
  K suspend actor $a -a $S --mode sync > /dev/null
  pkill -f "proxy actor $a " ; K delete actor $a -a $S > /dev/null
}

mkdir -p $V/01-compressible; cd $V/01-compressible
OUT=10-compressible.tsv; echo "template	phase	i	http	value	detail" > $OUT
tmpl zero-200 200 MEMORY --fill=zero; tmpl zero-500 500 MEMORY --fill=zero
tmpl mixed-200 200 MEMORY --fill=mixed; tmpl mixed-500 500 MEMORY --fill=mixed
tmpl rand-200 200 MEMORY --fill=random; tmpl rand-500 500 MEMORY --fill=random
port=9100
for t in zero-200 zero-500 mixed-200 mixed-500 rand-200 rand-500; do
  s=$(now); waitgold $t; echo "$t	golden-ready-wait	1	-	$(el $s)	poll-1s" >> $OUT
  port=$((port+1)); cycle c-$t $t $port $OUT
done
K get actor-templates -a $S > 11-templates.txt
echo DONE >> $OUT

mkdir -p $V/04-fidelity; cd $V/04-fidelity
OUT=10-fidelity.tsv; echo "template	phase	i	http	value	detail" > $OUT
VOL=1
tmpl fid-memory 50 MEMORY --rootfs-file=/rootfs.txt --data-file=/data/a.txt --spawn-child
tmpl fid-rootfs 50 ROOTFS --rootfs-file=/rootfs.txt --data-file=/data/a.txt --spawn-child
tmpl fid-volumes 50 VOLUMES --rootfs-file=/rootfs.txt --data-file=/data/a.txt --spawn-child
for t in fid-memory fid-rootfs fid-volumes; do
  s=$(now); waitgold $t; echo "$t	golden-ready-wait	1	-	$(el $s)	poll-1s" >> $OUT
  port=$((port+1)); cycle f-$t $t $port $OUT
  K get actor-template $t -a $S -o yaml > template-$t.yaml
done
unset VOL
echo DONE >> $OUT
sudo fstrim -v / > /dev/null
