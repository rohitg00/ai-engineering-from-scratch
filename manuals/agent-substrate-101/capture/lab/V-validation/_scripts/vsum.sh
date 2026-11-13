cd ~/evidence/V-validation/$1
python3 - "$2" <<'EOF'
import sys,csv,statistics as st
rows=[r for r in csv.reader(open(sys.argv[1]),delimiter='\t') if len(r)>=5 and r[0] not in('template','DONE','n')]
g={}; order=[]
for r in rows:
    k=(r[0],r[1])
    if k not in g: g[k]=[]; order.append(k)
    try: g[k].append((r[3],float(r[4])))
    except ValueError: pass
print("key\tphase\tn\tmin\tp50\tmax\tnon200")
for k in order:
    v=[x[1] for x in g[k]]
    if not v: continue
    bad=sum(1 for x in g[k] if x[0] not in('200','-'))
    print(f"{k[0]}\t{k[1]}\t{len(v)}\t{min(v):.3f}\t{st.median(v):.3f}\t{max(v):.3f}\t{bad}")
EOF
