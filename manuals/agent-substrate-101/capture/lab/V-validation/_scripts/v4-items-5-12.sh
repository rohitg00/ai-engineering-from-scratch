. ~/scripts/vlib.sh
while ! grep -q DONE $V/03-parallel-resume/10-parallel.tsv 2>/dev/null; do sleep 5; done
mkdir -p ~/vtmp

# ---------- 5 golden race
mkdir -p $V/05-golden-race; cd $V/05-golden-race
T=10-race.tsv; echo "ts	event	detail" > $T
tmpl race-200 200 MEMORY --fill=random
K create actor rc1 -a $S --template race-200 > create-rc1.txt 2>&1
echo "$(ts)	created-rc1-right-after-template	$(tr '\n' ' ' < create-rc1.txt | cut -c1-200)" >> $T
echo "$(ts)	template-status	$(kubectl ate get actor-template race-200 -a $S -o json 2>/dev/null | jq -c .status)" >> $T
echo "$(ts)	rc1-state	$(st rc1)" >> $T
K get actor rc1 -a $S -o yaml > 11-rc1-before-call.yaml
proxy rc1 9701
echo "$(ts)	rc1-first-call	$(call 9701)" >> $T
echo "$(ts)	rc1-state	$(st rc1)" >> $T
s=$(now); waitgold race-200; echo "$(ts)	golden-ready	waited $(el $s) s more" >> $T
K create actor rc2 -a $S --template race-200 > /dev/null; proxy rc2 9702
echo "$(ts)	rc2-state-new	$(st rc2)" >> $T
echo "$(ts)	rc2-first-call	$(call 9702)" >> $T
K suspend actor rc1 -a $S --mode sync > /dev/null; echo "$(ts)	rc1-after-suspend	$(st rc1)" >> $T
echo "$(ts)	rc1-resume	$(call 9701)" >> $T
K logs actor rc1 -a $S --source=lifecycle > 12-rc1-lifecycle.log 2>&1
K logs actor rc2 -a $S --source=lifecycle > 12-rc2-lifecycle.log 2>&1
tmpl race-0 0 MEMORY --fill=zero
for i in 1 2 3 4 5; do K create actor rz$i -a $S --template race-0 > /dev/null 2>&1; echo "$(ts)	rz$i-created	$(st rz$i)" >> $T; done
sleep 25
for i in 1 2 3 4 5; do echo "$(ts)	rz$i-later	$(st rz$i)" >> $T; done
pkill -f "proxy actor rc"
for a in rc1 rc2 rz1 rz2 rz3 rz4 rz5; do K suspend actor $a -a $S --mode sync > /dev/null 2>&1; K delete actor $a -a $S > /dev/null 2>&1; done
echo DONE >> $T

# ---------- 6 template move
mkdir -p $V/06-template-move/imgb; cd $V/06-template-move
T=10-move.tsv; echo "ts	event	detail" > $T
cp ~/ballast3/ballast imgb/; mkdir -p imgb/data; touch imgb/data/.keep; echo "image B" > imgb/marker.txt
printf 'FROM scratch\nCOPY ballast /ballast\nCOPY data /data\nCOPY marker.txt /marker.txt\nENTRYPOINT ["/ballast"]\n' > imgb/Dockerfile
sg docker -c "docker build -q -t localhost:5001/ballast:v3b imgb && docker push -q localhost:5001/ballast:v3b" > /dev/null 2>&1
IMGB=$(sg docker -c "docker inspect --format '{{index .RepoDigests 0}}' localhost:5001/ballast:v3b")
echo "A $IMG" > 11-images.txt; echo "B $IMGB" >> 11-images.txt
VOL=1
tmpl mv-a 20 MEMORY --tag=A --rootfs-file=/rootfs.txt --data-file=/data/a.txt
TIMG=$IMGB tmpl mv-b 20 MEMORY --tag=B --rootfs-file=/rootfs.txt --data-file=/data/a.txt
unset VOL
waitgold mv-a; waitgold mv-b
K create actor mv1 -a $S --template mv-a > /dev/null; proxy mv1 9711
for i in 1 2 3; do echo "$(ts)	call-on-A	$(call 9711)" >> $T; done
K update actor --help > 12-update-help.txt 2>&1
echo "$(ts)	update-while-running	$(K update actor mv1 -a $S --template mv-b | tr '\n' ' ' | cut -c1-260)" >> $T
K suspend actor mv1 -a $S --mode sync > /dev/null; echo "$(ts)	suspended	$(st mv1)" >> $T
echo "$(ts)	update-while-suspended	$(K update actor mv1 -a $S --template mv-b | tr '\n' ' ' | cut -c1-260)" >> $T
K get actor mv1 -a $S -o yaml > 13-mv1-after-update.yaml
for i in 1 2; do echo "$(ts)	call-after-move	$(call 9711)" >> $T; done
echo "$(ts)	state	$(st mv1)" >> $T
K suspend actor mv1 -a $S --mode sync > /dev/null
echo "$(ts)	call-after-second-suspend	$(call 9711)" >> $T
K get actor mv1 -a $S -o yaml > 14-mv1-end.yaml
K logs actor mv1 -a $S --source=lifecycle > 15-lifecycle.log 2>&1
pkill -f "proxy actor mv1 "; K suspend actor mv1 -a $S --mode sync > /dev/null; K delete actor mv1 -a $S > /dev/null
echo DONE >> $T

# ---------- 7 pool in another namespace
mkdir -p $V/07-cross-namespace-pool; cd $V/07-cross-namespace-pool
T=10-cross.tsv; echo "ts	event	detail" > $T
K create atespace xa > 11-create-atespace.txt 2>&1
kubectl get ns xa > 12-kubernetes-namespace-xa.txt 2>&1
TS=xa tmpl cross-0 0 MEMORY --fill=zero
cat create-tmpl-cross-0.txt >> $T
waitgold cross-0 xa && echo "$(ts)	golden-ready	yes" >> $T || echo "$(ts)	golden-ready	no after 90 s" >> $T
K create actor x1 -a xa --template cross-0 > /dev/null; proxy x1 9721 xa
echo "$(ts)	call	$(call 9721)" >> $T
K get actors -a xa > 13-actors.txt; K get workers -a xa > 14-workers-serving-xa.txt
TS=xa POOL=no-such-pool tmpl cross-none 0 MEMORY --fill=zero
sleep 20
K get actor-templates -a xa > 15-templates-with-unmatched-selector.txt
K get actor-template cross-none -a xa -o yaml > 16-template-unmatched.yaml
K create actor x2 -a xa --template cross-none > 17-create-x2.txt 2>&1; proxy x2 9722 xa
echo "$(ts)	call-unmatched-selector	$(CT=30 call 9722)" >> $T
pkill -f "proxy actor x[12] "
for a in x1 x2; do K suspend actor $a -a xa --mode sync > /dev/null 2>&1; K delete actor $a -a xa > /dev/null 2>&1; done
echo DONE >> $T

# ---------- 8 access control
mkdir -p $V/08-access-control; cd $V/08-access-control
T=10-access.tsv; echo "ts	step	exit	output" > $T
run() { label=$1; shift; out=$("$@" 2>&1 | grep -v '^Warning: no --token-file' | tr '\n' ' ' | cut -c1-420); echo "$(ts)	$label	-	$out" >> $T; }
kubectl create ns ate-users > /dev/null 2>&1; kubectl -n ate-users create sa alice > /dev/null 2>&1
grep -n -B2 -A8 "audiences" ~/evidence/A-quickstart/22-deploy-ate-system-retry.log | head -14 > 11-authentication-config.txt
kubectl create token alice -n ate-users --audience api.ate-system.svc --duration 1h > ~/vtmp/alice.token 2> 12-create-token.err
A="--token-file $HOME/vtmp/alice.token"
run default-identity-get-global-policy kubectl ate get access-policy --global -o yaml
kubectl ate get access-policy --global -o yaml 2>/dev/null > 13-global-policy.yaml
run alice-no-role-get-actors kubectl ate $A get actors -a $S
run alice-no-role-get-atespaces kubectl ate $A get atespaces
printf 'metadata:\n  name: default\nbindings:\n- role: viewer\n  members:\n  - user:system:serviceaccount:ate-users:alice\n' > policy-viewer.yaml
run owner-create-policy-viewer kubectl ate create access-policy -a $S -f policy-viewer.yaml
kubectl ate get access-policy -a $S -o yaml 2>/dev/null > 14-policy-lab-v-viewer.yaml
sleep 2
run alice-viewer-get-actors kubectl ate $A get actors -a $S
run alice-viewer-get-templates kubectl ate $A get actor-templates -a $S
run alice-viewer-create-actor kubectl ate $A create actor al1 -a $S --template tiny-0
run alice-viewer-other-atespace kubectl ate $A get actors -a lab-c
run alice-viewer-get-workers kubectl ate $A get workers
kubectl ate get access-policy -a $S -o yaml 2>/dev/null | grep -v '^Warning' | sed 's/role: viewer/role: editor/' > policy-editor.yaml
run owner-update-policy-editor kubectl ate update access-policy -a $S -f policy-editor.yaml
kubectl ate get access-policy -a $S -o yaml 2>/dev/null > 15-policy-lab-v-editor.yaml
sleep 2
run alice-editor-create-actor kubectl ate $A create actor al1 -a $S --template tiny-0
run alice-editor-suspend kubectl ate $A suspend actor al1 -a $S
run alice-editor-create-template-other kubectl ate $A create actor al2 -a lab-c --template ballast-0
run alice-editor-create-access-policy kubectl ate $A create access-policy -a lab-c -f policy-viewer.yaml
run alice-editor-delete-actor kubectl ate $A delete actor al1 -a $S
printf 'not-a-token\n' > ~/vtmp/bad.token
run bad-token kubectl ate --token-file $HOME/vtmp/bad.token get actors -a $S
kubectl create token alice -n ate-users --duration 1h > ~/vtmp/alice-wrong-aud.token 2>/dev/null
run wrong-audience-token kubectl ate --token-file $HOME/vtmp/alice-wrong-aud.token get actors -a $S
run owner-delete-policy kubectl ate delete access-policy -a $S
run alice-after-delete kubectl ate $A get actors -a $S
K delete actor al1 -a $S > /dev/null 2>&1
rm -f ~/vtmp/*.token
echo DONE >> $T

# ---------- 9 actor JWT
mkdir -p $V/09-actor-jwt; cd $V/09-actor-jwt
T=10-jwt.tsv; echo "ts	event	detail" > $T
cat > echo.yaml <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: echo
  namespace: lab-v
spec:
  replicas: 1
  selector:
    matchLabels:
      app: echo
  template:
    metadata:
      labels:
        app: echo
    spec:
      containers:
      - name: echo
        image: ${IMG/localhost:5001/localhost:5001}
        args: ["--mb=0"]
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: echo
  namespace: lab-v
spec:
  selector:
    app: echo
  ports:
  - port: 80
    targetPort: 80
EOF
kubectl apply -f echo.yaml > 11-echo-apply.txt 2>&1
kubectl -n lab-v rollout status deploy/echo --timeout=120s >> 11-echo-apply.txt 2>&1
K create actor jw1 -a $S --template tiny-0 > /dev/null; proxy jw1 9731
U="http://echo.lab-v.svc.cluster.local/hdr"
echo "$(ts)	fetch-no-policy	$(call 9731 "/fetch?url=$U&auth=Bearer%20placeholder")" >> $T
cat > policy-jwt.yaml <<EOF
metadata:
  name: default
rules:
- http:
    effects:
      replaceHeaders:
      - actorJwt:
          audiences:
          - lab-echo
          expirationSeconds: "600"
        header: authorization
        prefix: 'Bearer '
    hostnames:
    - echo.lab-v.svc.cluster.local
    ports:
      numbers:
      - 80
EOF
echo "$(ts)	create-egress-policy	$(K create egress-policy jw1 -a $S -f policy-jwt.yaml | tr '\n' ' ' | cut -c1-200)" >> $T
K get egress-policy jw1 -a $S -o yaml > 12-policy-live.yaml
sleep 4
curl -s -m 30 -o ~/vtmp/jwt-body.txt -w '%{http_code} %{time_total}\n' "http://127.0.0.1:9731/fetch?url=$U&auth=Bearer%20placeholder" > 13-fetch-status.txt
python3 - <<'EOF' > 14-jwt-decoded.txt 2>&1
import base64, json, os, re, time
body = open(os.path.expanduser('~/vtmp/jwt-body.txt')).read()
m = re.search(r'Authorization: Bearer ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)', body)
other = [l for l in body.splitlines() if not l.lower().startswith('authorization')]
print('headers the upstream saw, without Authorization:'); print('\n'.join(other))
if not m:
    print('NO JWT FOUND; authorization line shape:', [re.sub(r'[A-Za-z0-9_-]{12,}', '<long>', l) for l in body.splitlines() if l.lower().startswith('authorization')])
else:
    d = lambda s: json.loads(base64.urlsafe_b64decode(s + '=' * (-len(s) % 4)))
    h, c = d(m.group(1)), d(m.group(2))
    print('header:', json.dumps(h, indent=1)); print('claims:', json.dumps(c, indent=1))
    print('signature_chars:', len(m.group(3)))
    print('lifetime_s:', c.get('exp', 0) - c.get('iat', 0), 'nbf-iat:', c.get('nbf', 0) - c.get('iat', 0), 'seconds_until_exp_now:', c.get('exp', 0) - int(time.time()))
EOF
echo "$(ts)	fetch-with-policy	$(cat 13-fetch-status.txt)" >> $T
echo "$(ts)	fetch-without-header	$(curl -s -m 30 "http://127.0.0.1:9731/fetch?url=$U" | grep -c -i '^authorization')" >> $T
(kubectl -n ate-system port-forward svc/idp 18443:443 > pf-idp.log 2>&1 &); sleep 3
curl -sk -m 10 https://127.0.0.1:18443/.well-known/openid-configuration > 15-openid-configuration.json 2> 15-curl.err
curl -sk -m 10 https://127.0.0.1:18443/openid/v1/jwks | jq '{keys: [.keys[] | {kty, alg, kid, use, crv}]}' > 16-jwks-key-ids.json 2>> 15-curl.err
pkill -f "port-forward svc/idp"
kubectl -n ate-system get svc > 17-ate-system-services.txt
rm -f ~/vtmp/jwt-body.txt pf-idp.log
pkill -f "proxy actor jw1 "; K delete egress-policy jw1 -a $S > /dev/null 2>&1; K suspend actor jw1 -a $S --mode sync > /dev/null 2>&1; K delete actor jw1 -a $S > /dev/null
echo DONE >> $T

# ---------- 12 suspend during a request
mkdir -p $V/12-suspend-during-request; cd $V/12-suspend-during-request
T=10-inflight.tsv; echo "ts	mode	event	detail" > $T
for mode in async sync; do
  a=sl-$mode; K create actor $a -a $S --template tiny-0 > /dev/null; proxy $a 9741
  echo "$(ts)	$mode	call	$(call 9741)" >> $T
  ( r=$(curl -s -m 60 -o slow-$mode.body -w '%{http_code}\t%{time_total}' "http://127.0.0.1:9741/slow?s=10"); echo "$(ts)	$mode	slow-request-ended	$r	$(tr -d '\n' < slow-$mode.body | cut -c1-200)" >> $T ) &
  sleep 2
  s=$(now); out=$(K suspend actor $a -a $S --mode $mode | tr '\n' ' ' | cut -c1-160); echo "$(ts)	$mode	suspend-2s-into-request	$(el $s)s	$out" >> $T
  echo "$(ts)	$mode	state	$(st $a)" >> $T
  wait
  echo "$(ts)	$mode	state-after-client-ended	$(st $a)" >> $T
  echo "$(ts)	$mode	next-call	$(call 9741)" >> $T
  echo "$(ts)	$mode	next-call-2	$(call 9741)" >> $T
  K logs actor $a -a $S --source=lifecycle > lifecycle-$a.log 2>&1
  pkill -f "proxy actor $a "; K suspend actor $a -a $S --mode sync > /dev/null 2>&1; K delete actor $a -a $S > /dev/null
done
echo DONE >> $T
sudo fstrim -v / > /dev/null
