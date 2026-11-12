. ~/scripts/vlib.sh
cd $V/03-parallel-resume
python3 - <<'EOF' | tee 24-summary.tsv
import csv,statistics as st
for f in ('20-parallel.tsv','10-parallel-first-run-n16-n32.tsv'):
    g={}
    for r in csv.reader(open(f),delimiter='\t'):
        if len(r)<5 or r[0] in('n','DONE'): continue
        g.setdefault(r[0],[]).append((r[3],float(r[4])))
    print(f"# {f}"); print("n\trequests\tcodes\tok_min\tok_p50\tok_p90\tok_max\tfail_p50")
    for k,v in g.items():
        codes={}
        for c,_ in v: codes[c]=codes.get(c,0)+1
        ok=sorted(t for c,t in v if c=='200'); bad=[t for c,t in v if c!='200']
        f3=lambda x: f"{x:.3f}"
        p90=ok[int(0.9*(len(ok)-1))] if ok else None
        print(k,len(v),codes, f3(ok[0]) if ok else '-', f3(st.median(ok)) if ok else '-', f3(p90) if ok else '-', f3(ok[-1]) if ok else '-', f3(st.median(bad)) if bad else '-', sep='\t')
EOF
cat 21-workers-before.txt | cut -c1-110
grep -c . 22-lifecycle-tails.log
cd $V
K delete actor-template cross-none -a xa > /dev/null 2>&1
for t in $(K get actor-templates -a xa -o json | jq -r '.. | objects | select(.metadata.atespace? == "xa" and .containers? != null) | .metadata.name' | sort -u); do K delete actor-template $t -a xa > /dev/null 2>&1; done
K delete atespace xa > /dev/null 2>&1
kubectl delete ns ate-users --wait=false > /dev/null 2>&1
kubectl -n lab-v delete deploy/echo svc/echo > /dev/null 2>&1
K get actors -a lab-v; K get actor-templates -a xa 2>&1 | tail -2
rm -rf ~/vtmp
find $V -name 'body.tmp' -delete; find $V -name 'proxy-*.log' -delete; find $V -name 'b-*.tmp' -delete
grep -rl -E "eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}" $V | head
du -sh $V; find $V -type f -size +200k | head
sudo fstrim -v / > /dev/null; df -h / | tail -1
