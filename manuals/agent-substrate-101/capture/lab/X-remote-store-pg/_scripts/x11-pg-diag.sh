. ~/scripts/x-pglib.sh
O=$EV/50-pg-tests; cd $O
S=x-lab
R() { PX "sh /tmp/req.sh $*"; }
{
echo "### $(date -u +%FT%TZ) diagnosis of x-run"
kubectl ate get actor x-run -a $S -o json 2>/dev/null | jq -c '.status'
echo "request: $(R x-run 12)"
echo "--- api-server lines for x-run in the last 2 min (method, err, elapsed)"
kubectl -n ate-system logs deploy/ate-api-server --all-containers --since=2m 2>&1 | scrub | grep '"x-run"' | jq -r -c '[.time[11:23], .method, (.err // "-"), (.["elapsed-time"] // "-")] | @tsv' 2>/dev/null | tail -8
for p in $(kubectl -n ate-system get pods -o name | grep ate-api-server); do echo "--- $p"; kubectl -n ate-system logs $p --all-containers --since=2m 2>&1 | scrub | grep -i -E "x-run|5f9e5835" | grep -v GetActor | tail -4 | cut -c1-420; done
echo "--- router, non-access lines"
kubectl -n ate-system logs deploy/atenet-router --all-containers --since=2m 2>/dev/null | grep -v -E '^\[20' | grep -i -E "x-run|error|timeout|park|resum" | tail -6 | cut -c1-400
echo "--- atelet"
kubectl -n ate-system logs ds/atelet --all-containers --since=8m 2>/dev/null | grep -i -E "x-run|5f9e5835" | tail -6 | cut -c1-400
echo "--- worker pod of x-run"
W=$(kubectl ate get actor x-run -a $S 2>/dev/null | awk 'NR==2{print $5}'); echo "$W"
kubectl -n $S logs ${W#*/} --all-containers --since=8m 2>/dev/null | tail -6 | cut -c1-300
} > 38-x-run-diagnosis.txt 2>&1
cat 38-x-run-diagnosis.txt
