. ~/scripts/x-pglib.sh
O=$EV/50-pg-tests; cd $O
S=x-lab
R() { PX "sh /tmp/req.sh $*"; }
head -24 39-x-run-diagnosis-2.txt | cut -c1-220
{
echo "### $(date -u +%FT%TZ) recovery of x-run"
echo "request before any command: $(R x-run 12)"
echo "--- goroutine hint: api-server lines that name x-run during the outage window"
for p in $(kubectl -n ate-system get pods -l app=ate-api-server -o name); do kubectl -n ate-system logs $p --all-containers --since=15m 2>&1 | scrub | grep '"x-run"' | jq -r -c '[.time[11:23], .method, ((.err // "-")|tostring|.[0:150]), (.["elapsed-time"] // "-")] | @tsv' 2>/dev/null | grep -v -E "GetActor	-	" | tail -12; done
echo "--- kubectl ate resume actor x-run"
t=$(now); timeout 40 kubectl ate resume actor x-run -a $S 2>&1 | grep -v Warning | tail -2 | cut -c1-200; echo "resume command: $(el $t) s"
echo "request: $(R x-run 12)"
echo "--- kubectl ate suspend actor x-run --mode sync"
t=$(now); timeout 60 kubectl ate suspend actor x-run -a $S --mode sync 2>&1 | grep -v Warning | tail -2 | cut -c1-200; echo "suspend command: $(el $t) s"
echo "state: $(kubectl ate get actor x-run -a $S -o json 2>/dev/null | jq -r .status.state)"
echo "request: $(R x-run 15)"
echo "request: $(R x-run 15)"
echo "state: $(kubectl ate get actor x-run -a $S -o json 2>/dev/null | jq -r .status.state)"
} > 41-x-run-recovery.txt 2>&1
cat 41-x-run-recovery.txt
