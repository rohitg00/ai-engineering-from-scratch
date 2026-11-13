. ~/scripts/z-lib.sh
O=$EV/10-run; D=$O/40-errors
grep -h -o -E '"err":"[^"]{0,400}' $D/10-*.log | sort | uniq -c | sort -rn | head -6 | cut -c1-460
P=$(kubectl -n ate-system get pods -l app=postgres -o name 2>/dev/null | head -1); [ -z "$P" ] && P=$(kubectl -n ate-system get pods -o name | grep postgres | head -1)
echo "postgres pod: $P"
kubectl -n ate-system exec $P -- psql -U postgres -tAc "show max_connections; select count(*) from pg_stat_activity;" 2>&1 | head -3
kubectl -n ate-system logs $P --since=20m 2>/dev/null | grep -i -E 'too many|remaining connection|FATAL' | sort | uniq -c | sort -rn | head -5 > $D/40-postgres.log; cat $D/40-postgres.log
kubectl -n ate-system logs ds/atelet --since=40m 2>/dev/null | grep -E 'Restore timing breakdown|Checkpoint timing breakdown' > $O/50-atelet-timing.log
wc -l < $O/50-atelet-timing.log
grep 'Restore timing' $O/50-atelet-timing.log | head -2 | cut -c1-900
