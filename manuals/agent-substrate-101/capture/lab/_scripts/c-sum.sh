cd ~/evidence/C-resume-vs-size
f=${1:-10-local.tsv}
tail -1 $f | cut -c1-80
python3 - "$f" <<'EOF'
import sys,csv,statistics as st
rows=[r for r in csv.reader(open(sys.argv[1]),delimiter='\t') if len(r)>=5 and r[0].isdigit()]
g={}
for r in rows:
    g.setdefault((int(r[0]),r[1]),[]).append((r[3],float(r[4])))
print("mb\tphase\tn\tmin\tp50\tmax\tnon200")
for k in sorted(g):
    v=[x[1] for x in g[k]]; bad=sum(1 for x in g[k] if x[0] not in('200','-'))
    print(f"{k[0]}\t{k[1]}\t{len(v)}\t{min(v):.3f}\t{st.median(v):.3f}\t{max(v):.3f}\t{bad}")
EOF
for a in b0-1 b50-1 b200-1 b500-1 b1000-1; do [ -f snapdir-$a.txt ] && echo "$a local-snapshot-KiB $(head -1 snapdir-$a.txt | cut -f1)"; done
grep -h -v '^Warn' 09-templates-at-start.txt | head -8
