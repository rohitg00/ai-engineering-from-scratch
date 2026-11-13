cd ~/evidence/E-dependency-loss
python3 - <<'EOF' | tee 20-analysis.txt
import csv, collections, statistics as st
tl=[r for r in csv.reader(open('10-timeline.tsv'),delimiter='\t') if len(r)>=3 and r[0].isdigit()]
T={r[2].split()[0]:int(r[0]) for r in tl}
print("timeline:"); [print("  ",r[1],r[2]) for r in tl]
def load(fn):
    out=[]
    for r in csv.reader(open(fn),delimiter='\t'):
        if len(r)<5 or not r[0].isdigit(): continue
        out.append(dict(t=int(r[0]),kind=r[1],actor=r[2],code=r[3],lat=float(r[4]),body=r[5] if len(r)>5 else ''))
    return sorted(out,key=lambda x:x['t'])
series={'proxy/running (VM, kubectl ate proxy)':[x for x in load('12-probe-proxy.tsv')],
        'incluster/running (pod, mTLS to router)':[x for x in load('12-probe-incluster.tsv') if x['kind']=='running'],
        'incluster/suspended (fresh actor each 5 s)':[x for x in load('12-probe-incluster.tsv') if x['kind']=='suspended']}
tests=[('T1 Postgres','T1-postgres-scale-0','T1-postgres-scale-1','T1-postgres-ready'),
       ('T2 ate-api-server','T2-ateapi-scale-0','T2-ateapi-scale-2','T2-ateapi-ready'),
       ('T3 kube-apiserver','T3-kube-apiserver-manifest-moved-out','T3-kube-apiserver-manifest-moved-back','T3-kube-apiserver-livez-200')]
def rle(xs):
    out=[];
    for x in xs:
        if out and out[-1][0]==x: out[-1][1]+=1
        else: out.append([x,1])
    return ' '.join(f"{c}x{n}" for c,n in out)
base=[x for x in series['incluster/running (pod, mTLS to router)'] if x['t']<T['T1-postgres-scale-0'] and x['code']=='200']
if base: print(f"\nbaseline in-cluster running actor: n={len(base)} p50={st.median([x['lat'] for x in base])*1000:.0f} ms")
bs=[x for x in series['incluster/suspended (fresh actor each 5 s)'] if x['t']<T['T1-postgres-scale-0'] and x['code']=='200']
if bs: print(f"baseline in-cluster suspended (resume) : n={len(bs)} p50={st.median([x['lat'] for x in bs])*1000:.0f} ms")
for name,a,b,c in tests:
    t0,t1,t2=T[a],T[b],T[c]
    print(f"\n== {name}: down at +0 s, restore action at +{t1-t0} s, dependency ready at +{t2-t0} s")
    for sn,rows in series.items():
        w=[x for x in rows if t0-10<=x['t']<=t2+85]
        if not w: print("  ",sn,": no rows"); continue
        seq=rle([x['code'] for x in w])
        fails=[x for x in w if x['code']!='200']
        first=min((x['t'] for x in fails),default=None); last=max((x['t'] for x in fails),default=None)
        bodies=collections.Counter((x['code'],x['body'].strip()[:110]) for x in fails)
        print(f"  {sn}")
        print(f"     codes from -10 s: {seq}")
        if fails:
            print(f"     first failure at +{first-t0} s, last failure at +{last-t0} s (= {last-t1:+d} s from restore action, {last-t2:+d} s from dependency ready); failed {len(fails)} of {len(w)}")
            lat=[x['lat'] for x in fails]
            print(f"     failure latency p50 {st.median(lat):.2f} s max {max(lat):.2f} s")
            for (code,body),n in bodies.most_common(4): print(f"     {n}x code={code} body={body!r}")
        else:
            print("     no failures")
EOF
echo; echo "proxy restarts:"; cat 11-proxy-restarts.tsv 2>/dev/null | wc -l
echo "kube-apiserver livez during T3:"; awk '{print $2}' 16-T3-kube-apiserver-livez.tsv | uniq -c | tr '\n' ' '; echo
for f in 14-T1-cli-during.txt 15-T2-cli-during.txt 16-T3-cli-during.txt 16-T3-kubectl-during.txt; do echo "-- $f"; head -4 $f | cut -c1-260; done
cat 17-actors-end.txt
