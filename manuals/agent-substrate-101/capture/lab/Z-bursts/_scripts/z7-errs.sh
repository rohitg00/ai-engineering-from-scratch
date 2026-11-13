. ~/scripts/z-lib.sh
O=$EV/10-run; D=$O/40-errors; mkdir -p $D
K get actors -a $S > $D/00-actors-$(date -u +%H%M%S).txt
for p in $(kubectl -n ate-system get pods -o name | grep ate-api-server); do
  n=$(basename $p)
  kubectl -n ate-system logs $p -c ate-api-server --since=15m 2>/dev/null | grep -i -E 'error|fail|t-023|t-039|t-059|t-091|t-096|t-142|t-144' | tail -200 > $D/10-$n.log
  wc -l < $D/10-$n.log | sed "s/^/$n error lines: /"
done
kubectl -n ate-system logs deploy/atenet-router --since=15m 2>/dev/null | grep -i -E 'error|t-023|t-039|t-096|500|504|503' | tail -200 > $D/20-router.log
kubectl -n ate-system logs ds/atelet --since=15m 2>/dev/null | grep -i -E 'error|t-023|t-039|t-059|t-091' | tail -200 > $D/30-atelet.log
wc -l $D/*.log
for f in $D/10-*.log; do grep -h -o -E '"(msg|error|err)":"[^"]{0,160}' $f | sort | uniq -c | sort -rn | head -6; done
grep -h -o -E '"(msg|error|err)":"[^"]{0,160}' $D/30-atelet.log | sort | uniq -c | sort -rn | head -8
