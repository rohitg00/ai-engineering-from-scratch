DP=envoy
E=~/evidence/G-dataplane/$DP/ingress-auth; mkdir -p "$E"; cd "$E"
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
kubectl -n ate-system get sa > 00-serviceaccounts.txt
cat > probe.yaml <<'EOF'
apiVersion: v1
kind: Namespace
metadata:
  name: probe
---
apiVersion: v1
kind: Pod
metadata:
  name: wrong-id
  namespace: probe
spec:
  containers:
  - name: c
    image: curlimages/curl:8.11.1
    command: ["sleep", "86400"]
    volumeMounts:
    - {name: podidentity, mountPath: /run/id}
    - {name: servicedns-ca, mountPath: /run/ca}
  volumes:
  - name: podidentity
    projected:
      sources:
      - podCertificate: {credentialBundlePath: credential-bundle.pem, keyType: ECDSAP256, signerName: podidentity.podcert.ate.dev/identity}
  - name: servicedns-ca
    projected:
      sources:
      - clusterTrustBundle: {labelSelector: {matchLabels: {podcert.ate.dev/canarying: live}}, path: trust-bundle.pem, signerName: servicedns.podcert.ate.dev/identity}
---
apiVersion: v1
kind: Pod
metadata:
  name: right-id
  namespace: ate-system
  labels: {app: probe-right-id}
spec:
  serviceAccountName: atenet-client
  containers:
  - name: c
    image: curlimages/curl:8.11.1
    command: ["sleep", "86400"]
    volumeMounts:
    - {name: podidentity, mountPath: /run/id}
    - {name: servicedns-ca, mountPath: /run/ca}
  volumes:
  - name: podidentity
    projected:
      sources:
      - podCertificate: {credentialBundlePath: credential-bundle.pem, keyType: ECDSAP256, signerName: podidentity.podcert.ate.dev/identity}
  - name: servicedns-ca
    projected:
      sources:
      - clusterTrustBundle: {labelSelector: {matchLabels: {podcert.ate.dev/canarying: live}}, path: trust-bundle.pem, signerName: servicedns.podcert.ate.dev/identity}
EOF
kubectl apply -f probe.yaml > 01-apply.log 2>&1
kubectl -n probe wait --for=condition=Ready pod/wrong-id --timeout=120s >> 01-apply.log 2>&1
kubectl -n ate-system wait --for=condition=Ready pod/right-id --timeout=120s >> 01-apply.log 2>&1
tail -3 01-apply.log
T="ate-demo-counter/my-counter-1"
R=atenet-router.ate-system.svc
RIP=$(kubectl -n ate-system get pod -l app=atenet-router -o jsonpath='{.items[0].status.podIP}')
x() { ns=$1; pod=$2; name=$3; shift 3; echo "### $name: $*" >> 10-results.txt; kubectl -n $ns exec $pod -- sh -c "$*" > "$name.out" 2>&1; echo "exit=$?" >> "$name.out"; grep -E 'HTTP/|SSL|TLS alert|alert|error|refused|exit=|count|denied|unauthor|certificate|< ' "$name.out" | grep -v -E 'CAfile|CApath|ALPN|TLSv1.3 \((OUT|IN)\), TLS handshake, (Client|Server) hello|Encrypted|Finished|change cipher' | tail -14 | cut -c1-220 >> 10-results.txt; }
: > 10-results.txt
for id in "probe wrong-id" "ate-system right-id"; do
  set -- $id
  kubectl -n $1 exec $2 -- sh -c 'cat /run/id/credential-bundle.pem' | openssl x509 -noout -subject -ext subjectAltName 2>/dev/null | tr '\n' ' ' > cert-$2.txt
  echo "cert $2: $(cat cert-$2.txt)" >> 10-results.txt
done
C="-sS -v -m 15 -o /dev/null -w 'code=%{http_code}\n'"
x probe wrong-id 20-nocert-https-443      "curl $C --cacert /run/ca/trust-bundle.pem -X POST -H 'ate-target-actor: $T' https://$R:443/"
x probe wrong-id 21-nocert-insecure-443   "curl $C -k -X POST -H 'ate-target-actor: $T' https://$R:443/"
x probe wrong-id 22-wrongid-https-443     "curl $C --cacert /run/ca/trust-bundle.pem --cert /run/id/credential-bundle.pem --key /run/id/credential-bundle.pem -X POST -H 'ate-target-actor: $T' https://$R:443/"
x ate-system right-id 23-rightid-https-443 "curl -sS -v -m 15 --cacert /run/ca/trust-bundle.pem --cert /run/id/credential-bundle.pem --key /run/id/credential-bundle.pem -X POST -H 'ate-target-actor: $T' https://$R:443/"
x probe wrong-id 24-nocert-connect-8444   "curl $C --proxytunnel --proxy https://$R:8444 --proxy-cacert /run/ca/trust-bundle.pem --proxy-header 'ate-target-actor: $T' -X POST http://actor:80/"
x probe wrong-id 25-wrongid-connect-8444  "curl $C --proxytunnel --proxy https://$R:8444 --proxy-cacert /run/ca/trust-bundle.pem --proxy-cert /run/id/credential-bundle.pem --proxy-key /run/id/credential-bundle.pem --proxy-header 'ate-target-actor: $T' -X POST http://actor:80/"
x ate-system right-id 26-rightid-connect-8444 "curl -sS -v -m 15 --proxytunnel --proxy https://$R:8444 --proxy-cacert /run/ca/trust-bundle.pem --proxy-cert /run/id/credential-bundle.pem --proxy-key /run/id/credential-bundle.pem --proxy-header 'ate-target-actor: $T' -X POST http://actor:80/"
for p in 80 8081 8080 8443 8444 9901 9902 9090 9091 15000; do
  x probe wrong-id 30-plain-svc-$p "curl -sS -m 6 -o /dev/null -w 'code=%{http_code}\n' -X POST -H 'ate-target-actor: $T' http://$R:$p/"
  x probe wrong-id 31-plain-pod-$p "curl -sS -m 6 -o /dev/null -w 'code=%{http_code}\n' -X POST -H 'ate-target-actor: $T' http://$RIP:$p/"
done
x probe wrong-id 32-plain-pod-80-body "curl -sS -m 10 -X POST -H 'ate-target-actor: $T' http://$RIP:80/"
x probe wrong-id 33-plain-connect-8081 "curl -sS -v -m 10 --proxytunnel --proxy http://$R:8081 --proxy-header 'ate-target-actor: $T' -X POST http://actor:80/"
(kubectl ate proxy actor my-counter-1 -a ate-demo-counter 8000:80 > 40-proxy.log 2>&1 &)
sleep 4
echo "### kubectl ate proxy" >> 10-results.txt
curl -s -m 20 -w ' code=%{http_code} t=%{time_total}\n' -X POST http://127.0.0.1:8000/ >> 10-results.txt 2>&1
pkill -f "proxy actor my-counter-1"
kubectl ate get actor my-counter-1 -a ate-demo-counter 2>&1 | grep -v Warning >> 10-results.txt
cat 10-results.txt
