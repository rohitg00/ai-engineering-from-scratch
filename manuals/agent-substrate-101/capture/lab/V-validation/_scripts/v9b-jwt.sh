. ~/scripts/vlib.sh
mkdir -p ~/vtmp; cd $V/09-actor-jwt
T=20-jwt-second-try.tsv; echo "ts	event	detail" > $T
cat 11-echo-apply.txt | tail -2 >> $T
kubectl -n lab-v get pods -l app=echo -o wide --no-headers | awk '{print $1,$2,$3}' >> $T
kubectl -n lab-v get svc echo --no-headers | awk '{print $1,$2,$5}' >> $T
K create actor jw2 -a $S --template tiny-0 > /dev/null; proxy jw2 9732
echo "$(ts)	create-egress-policy	$(K create egress-policy jw2 -a $S -f policy-jwt.yaml | tr '\n' ' ' | cut -c1-200)" >> $T
echo "$(ts)	first-call	$(call 9732)" >> $T
U="http://echo.lab-v.svc.cluster.local/hdr"
ok=0
for i in $(seq 1 30); do
  code=$(curl -s -m 30 -o ~/vtmp/jwt-body.txt -w '%{http_code}' "http://127.0.0.1:9732/fetch?url=$U&auth=Bearer%20placeholder")
  if grep -q '^status=' ~/vtmp/jwt-body.txt; then ok=1; echo "$(ts)	fetch-try-$i	resolved, $(head -1 ~/vtmp/jwt-body.txt)" >> $T; break; fi
  echo "$(ts)	fetch-try-$i	$(head -c 160 ~/vtmp/jwt-body.txt | tr '\n' ' ')" >> $T
  sleep 2
done
python3 - <<'EOF' > 24-jwt-decoded.txt 2>&1
import base64, json, os, re, time
body = open(os.path.expanduser('~/vtmp/jwt-body.txt')).read()
m = re.search(r'Authorization: Bearer ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)', body)
print('headers the upstream saw, without Authorization:')
print('\n'.join(l for l in body.splitlines() if not l.lower().startswith('authorization')))
if not m:
    print('NO JWT FOUND; authorization line shape:', [re.sub(r'[A-Za-z0-9_.-]{12,}', '<long>', l) for l in body.splitlines() if l.lower().startswith('authorization')])
else:
    d = lambda s: json.loads(base64.urlsafe_b64decode(s + '=' * (-len(s) % 4)))
    h, c = d(m.group(1)), d(m.group(2))
    print('header:', json.dumps(h, indent=1)); print('claims:', json.dumps(c, indent=1))
    print('signature_chars:', len(m.group(3)))
    print('lifetime_s:', c.get('exp', 0) - c.get('iat', 0), 'nbf_minus_iat:', c.get('nbf', 0) - c.get('iat', 0), 'seconds_until_exp_now:', c.get('exp', 0) - int(time.time()))
EOF
if [ $ok = 1 ]; then
  curl -s -m 30 -o ~/vtmp/b2.txt "http://127.0.0.1:9732/fetch?url=$U"
  echo "$(ts)	fetch-without-header	authorization lines at upstream: $(grep -c -i '^authorization' ~/vtmp/b2.txt)" >> $T
  curl -s -m 30 -o ~/vtmp/b3.txt "http://127.0.0.1:9732/fetch?url=$U&auth=Bearer%20placeholder"
  python3 - <<'EOF' >> $T
import os,re
a=open(os.path.expanduser('~/vtmp/jwt-body.txt')).read(); b=open(os.path.expanduser('~/vtmp/b3.txt')).read()
g=lambda s: (re.search(r'Authorization: Bearer (\S+)', s) or [None,None])[1]
print("-\tsecond-token\tsame token as first request: %s" % (g(a)==g(b) and g(a) is not None))
EOF
  K suspend actor jw2 -a $S --mode sync > /dev/null
  curl -s -m 30 -o ~/vtmp/b4.txt "http://127.0.0.1:9732/fetch?url=$U&auth=Bearer%20placeholder"
  python3 - <<'EOF' >> $T
import os,re,base64,json
a=open(os.path.expanduser('~/vtmp/jwt-body.txt')).read(); b=open(os.path.expanduser('~/vtmp/b4.txt')).read()
g=lambda s: (re.search(r'Authorization: Bearer (\S+)', s) or [None,None])[1]
d=lambda t: json.loads(base64.urlsafe_b64decode(t.split('.')[1]+'==='))
if g(a) and g(b):
    ca,cb=d(g(a)),d(g(b)); print("-\tafter-suspend-resume\tsame token: %s; jti changed: %s; sub same: %s" % (g(a)==g(b), ca.get('jti')!=cb.get('jti'), ca.get('sub')==cb.get('sub')))
else:
    print("-\tafter-suspend-resume\tno token in one of the replies")
EOF
fi
rm -f ~/vtmp/*.txt
pkill -f "proxy actor jw2 "; K delete egress-policy jw2 -a $S > /dev/null 2>&1; K suspend actor jw2 -a $S --mode sync > /dev/null 2>&1; K delete actor jw2 -a $S > /dev/null
echo DONE >> $T
cut -c1-250 $T; cat 24-jwt-decoded.txt | cut -c1-220
