export KUBECONFIG=$HOME/.kube/kind-kind.config
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
E=~/evidence/Q-network/i-model-gateway; mkdir -p "$E"; cd "$E"
W=~/modelgw-work; mkdir -p $W; chmod 700 $W
NS=model-gw; H=modelgw.$NS.svc.cluster.local
if [ ! -f $W/ca.crt ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=lab-private-ca" -keyout $W/ca.key -out $W/ca.crt 2>/dev/null
  openssl req -newkey rsa:2048 -nodes -subj "/CN=$H" -keyout $W/tls.key -out $W/tls.csr 2>/dev/null
  printf 'subjectAltName=DNS:%s,DNS:modelgw.%s.svc,DNS:modelgw\nextendedKeyUsage=serverAuth\n' "$H" "$NS" > $W/ext.cnf
  openssl x509 -req -in $W/tls.csr -CA $W/ca.crt -CAkey $W/ca.key -CAcreateserial -days 30 -extfile $W/ext.cnf -out $W/tls.crt 2>/dev/null
fi
openssl x509 -in $W/tls.crt -noout -subject -issuer -ext subjectAltName -dates > 00-server-cert.txt 2>&1
cp $W/ca.crt 00-private-ca.crt
IMG=$(kubectl -n ate-system get deploy atenet-egress -o jsonpath='{.spec.template.spec.containers[0].image}')
echo "$IMG" > 00-agentgateway-image.txt
kubectl create ns $NS --dry-run=client -o yaml | kubectl apply -f - > 01-apply.log 2>&1
kubectl -n $NS create secret tls modelgw-tls --cert=$W/tls.crt --key=$W/tls.key --dry-run=client -o yaml | kubectl apply -f - >> 01-apply.log 2>&1
kubectl -n $NS create configmap private-ca --from-file=ca.crt=$W/ca.crt --dry-run=client -o yaml | kubectl apply -f - >> 01-apply.log 2>&1
cat > mock.py <<'EOF'
import json, os, http.server, time
NAME = os.environ.get("NAME", "backend")
class H(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def reply(self, obj):
        out = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)
    def do_POST(self):
        n = int(self.headers.get("content-length", "0"))
        body = self.rfile.read(n)
        try:
            req = json.loads(body)
        except Exception:
            req = {}
        rec = {"t": time.strftime("%H:%M:%S"), "backend": NAME, "path": self.path, "model": req.get("model"), "authorization": self.headers.get("authorization"), "x_lab": self.headers.get("x-lab"), "host": self.headers.get("host")}
        print(json.dumps(rec), flush=True)
        text = "served_by=%s model=%s authorization=%s x_lab=%s" % (NAME, req.get("model"), self.headers.get("authorization"), self.headers.get("x-lab"))
        self.reply({"id": "chatcmpl-lab", "object": "chat.completion", "created": int(time.time()), "model": req.get("model"), "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}], "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}})
    def do_GET(self):
        self.reply({"object": "list", "data": []})
    def log_message(self, *a):
        pass
http.server.ThreadingHTTPServer(("", 80), H).serve_forever()
EOF
kubectl -n $NS create configmap mock --from-file=mock.py --dry-run=client -o yaml | kubectl apply -f - >> 01-apply.log 2>&1
cat > gw-tls.yaml <<'EOF'
config: {}
llm:
  port: 8443
  tls:
    cert: /tls/tls.crt
    key: /tls/tls.key
  models:
  - name: fast
    provider: openAI
    params:
      model: small-1
      hostOverride: mock-a.model-gw.svc.cluster.local:80
      apiKey: $KEY_A
  - name: smart
    provider: openAI
    params:
      model: big-1
      hostOverride: mock-b.model-gw.svc.cluster.local:80
      apiKey: $KEY_B
EOF
sed -e 's/port: 8443/port: 8080/' -e '/^  tls:/,/key: \/tls\/tls.key/d' gw-tls.yaml > gw-plain.yaml
kubectl -n $NS create configmap gw-config --from-file=tls.yaml=gw-tls.yaml --from-file=plain.yaml=gw-plain.yaml --dry-run=client -o yaml | kubectl apply -f - >> 01-apply.log 2>&1
cat > workloads.yaml <<EOF
apiVersion: apps/v1
kind: Deployment
metadata: {name: mock-a, namespace: $NS}
spec:
  replicas: 1
  selector: {matchLabels: {app: mock-a}}
  template:
    metadata: {labels: {app: mock-a}}
    spec:
      containers:
      - name: mock
        image: python:3.12-alpine
        command: ["python", "-u", "/app/mock.py"]
        env: [{name: NAME, value: backend-a}]
        volumeMounts: [{name: app, mountPath: /app}]
      volumes: [{name: app, configMap: {name: mock}}]
---
apiVersion: v1
kind: Service
metadata: {name: mock-a, namespace: $NS}
spec: {selector: {app: mock-a}, ports: [{port: 80, targetPort: 80}]}
---
apiVersion: apps/v1
kind: Deployment
metadata: {name: mock-b, namespace: $NS}
spec:
  replicas: 1
  selector: {matchLabels: {app: mock-b}}
  template:
    metadata: {labels: {app: mock-b}}
    spec:
      containers:
      - name: mock
        image: python:3.12-alpine
        command: ["python", "-u", "/app/mock.py"]
        env: [{name: NAME, value: backend-b}]
        volumeMounts: [{name: app, mountPath: /app}]
      volumes: [{name: app, configMap: {name: mock}}]
---
apiVersion: v1
kind: Service
metadata: {name: mock-b, namespace: $NS}
spec: {selector: {app: mock-b}, ports: [{port: 80, targetPort: 80}]}
---
apiVersion: apps/v1
kind: Deployment
metadata: {name: modelgw, namespace: $NS}
spec:
  replicas: 1
  selector: {matchLabels: {app: modelgw}}
  template:
    metadata: {labels: {app: modelgw}}
    spec:
      containers:
      - name: agentgateway
        image: $IMG
        args: ["-f", "/config/tls.yaml"]
        env: [{name: KEY_A, value: provider-key-for-backend-a}, {name: KEY_B, value: provider-key-for-backend-b}]
        volumeMounts: [{name: config, mountPath: /config}, {name: tls, mountPath: /tls}]
      volumes: [{name: config, configMap: {name: gw-config}}, {name: tls, secret: {secretName: modelgw-tls}}]
---
apiVersion: v1
kind: Service
metadata: {name: modelgw, namespace: $NS}
spec: {selector: {app: modelgw}, ports: [{port: 443, targetPort: 8443}]}
---
apiVersion: apps/v1
kind: Deployment
metadata: {name: modelgw-plain, namespace: $NS}
spec:
  replicas: 1
  selector: {matchLabels: {app: modelgw-plain}}
  template:
    metadata: {labels: {app: modelgw-plain}}
    spec:
      containers:
      - name: agentgateway
        image: $IMG
        args: ["-f", "/config/plain.yaml"]
        env: [{name: KEY_A, value: provider-key-for-backend-a}, {name: KEY_B, value: provider-key-for-backend-b}]
        volumeMounts: [{name: config, mountPath: /config}]
      volumes: [{name: config, configMap: {name: gw-config}}]
---
apiVersion: v1
kind: Service
metadata: {name: modelgw-plain, namespace: $NS}
spec: {selector: {app: modelgw-plain}, ports: [{port: 80, targetPort: 8080}]}
---
apiVersion: v1
kind: Pod
metadata: {name: client, namespace: $NS}
spec:
  containers:
  - name: c
    image: curlimages/curl:8.11.1
    command: ["sleep", "86400"]
    volumeMounts: [{name: ca, mountPath: /ca}]
  volumes: [{name: ca, configMap: {name: private-ca}}]
EOF
kubectl apply -f workloads.yaml >> 01-apply.log 2>&1
for d in mock-a mock-b modelgw modelgw-plain; do kubectl -n $NS rollout status deploy/$d --timeout=120s >> 01-apply.log 2>&1; done
kubectl -n $NS wait --for=condition=Ready pod/client --timeout=120s >> 01-apply.log 2>&1
kubectl -n $NS get pods -o wide > 02-pods.txt 2>&1
for d in modelgw modelgw-plain; do kubectl -n $NS logs deploy/$d --tail=30 > 03-log-$d-start.log 2>&1; done
B='{"model":"MODEL","messages":[{"role":"user","content":"hi"}]}'
{
for m in fast smart other; do
  b=$(echo "$B" | sed "s/MODEL/$m/")
  echo "### plain gateway, model=$m"
  kubectl -n $NS exec client -- curl -sS -m 10 -w '\ncode=%{http_code} t=%{time_total}\n' -H 'content-type: application/json' -H 'Authorization: Bearer client-sent-key' -H 'X-Lab: from-client' -d "$b" http://modelgw-plain.$NS.svc.cluster.local/v1/chat/completions 2>&1
  echo "### TLS gateway with the private CA, model=$m"
  kubectl -n $NS exec client -- curl -sS -m 10 --cacert /ca/ca.crt -w '\ncode=%{http_code} t=%{time_total}\n' -H 'content-type: application/json' -H 'Authorization: Bearer client-sent-key' -H 'X-Lab: from-client' -d "$b" https://$H/v1/chat/completions 2>&1
done
echo "### TLS gateway without the private CA"
kubectl -n $NS exec client -- curl -sS -m 10 -o /dev/null -w 'code=%{http_code}\n' https://$H/v1/models 2>&1
} > 04-smoke-from-plain-pod.txt
cut -c1-330 04-smoke-from-plain-pod.txt
tail -5 03-log-modelgw-start.log | cut -c1-300
cat 02-pods.txt | cut -c1-120
kubectl -n $NS logs deploy/mock-a --tail=5; kubectl -n $NS logs deploy/mock-b --tail=5
