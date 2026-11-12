. ~/scripts/vlib.sh
mkdir -p $V/11-process-exit-long-watch; cd $V/11-process-exit-long-watch
T=10-watch.tsv; echo "ts	actor	event	detail" > $T
tmpl tiny-0 0 MEMORY --fill=zero; waitgold tiny-0
for a in e1 e2; do K create actor $a -a $S --template tiny-0 > /dev/null; done
proxy e1 9601; proxy e2 9602
for a in 1 2; do
  echo "$(ts)	e$a	call	$(call 960$a)" >> $T
  K suspend actor e$a -a $S --mode sync > /dev/null
  echo "$(ts)	e$a	call-after-sync-suspend	$(call 960$a)" >> $T
  echo "$(ts)	e$a	exit-request	$(call 960$a /exit)" >> $T
done
echo "$(ts)	e1	plan	no request for 20 minutes" >> $T
echo "$(ts)	e2	plan	one request each 60 s" >> $T
for i in $(seq 1 80); do
  sleep 15
  echo "$(ts)	e1	state	$(st e1)" >> $T
  echo "$(ts)	e2	state	$(st e2)" >> $T
  if [ $((i % 4)) = 0 ]; then echo "$(ts)	e2	call	$(call 9602)" >> $T; fi
done
K get workers -n lab-v > 11-workers-end.txt
K get actor e1 -a $S -o yaml > 12-e1-after-20min.yaml
kubectl -n lab-v logs deploy/vpool --all-pods=true --tail=2000 2>/dev/null | grep -i -E "exit|crash|died|terminated" | tail -20 > 13-worker-log-lines.log
echo "$(ts)	e1	call-after-watch	$(call 9601)" >> $T
echo "$(ts)	e1	state	$(st e1)" >> $T
echo "$(ts)	e1	suspend-attempt	$(K suspend actor e1 -a $S --mode sync | tr '\n' ' ' | cut -c1-260)" >> $T
echo "$(ts)	e1	state	$(st e1)" >> $T
for a in e1 e2; do K revert actor $a -a $S > /dev/null 2>&1; echo "$(ts)	$a	after-revert	$(st $a)" >> $T; echo "$(ts)	$a	call-after-revert	$(call 960${a#e})" >> $T; done
pkill -f "proxy actor e[12] "
for a in e1 e2; do K suspend actor $a -a $S --mode sync > /dev/null 2>&1; K delete actor $a -a $S > /dev/null; done
echo DONE >> $T
