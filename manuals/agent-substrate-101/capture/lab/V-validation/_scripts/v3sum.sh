cd ~/evidence/V-validation/03-parallel-resume
python3 - ${1:-10-parallel.tsv} <<'EOF'
import sys,csv,statistics as st
g={}
for r in csv.reader(open(sys.argv[1]),delimiter='\t'):
    if len(r)<5 or r[0] in('n','DONE'): continue
    g.setdefault((r[0],r[1]),[]).append((r[3],float(r[4])))
print("n\tround\tcodes\tok_min\tok_p50\tok_max\tfail_p50")
for k,v in g.items():
    codes={}
    for c,_ in v: codes[c]=codes.get(c,0)+1
    ok=[t for c,t in v if c=='200']; bad=[t for c,t in v if c!='200']
    f=lambda x: f"{x:.3f}"
    print(k[0],k[1],codes, f(min(ok)) if ok else '-', f(st.median(ok)) if ok else '-', f(max(ok)) if ok else '-', f(st.median(bad)) if bad else '-', sep='\t')
EOF
