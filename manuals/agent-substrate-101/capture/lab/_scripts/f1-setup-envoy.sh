DP=envoy
E=~/evidence/F-egress/$DP; mkdir -p "$E"; cd "$E"
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
export ATE_INSTALL_KIND=true
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
s=$(date +%s)
(cd ~/substrate && sg docker -c "go run ./cmd/ate-setup deploy demo egress") > 00-deploy-demo-egress.log 2>&1
echo "deploy-demo-egress rc=$? seconds=$(( $(date +%s) - s ))" | tee 00-timing.txt
s=$(date +%s)
(cd ~/substrate && sg docker -c "./demos/egress/test-egress.sh") > 01-official-test-egress.log 2>&1
echo "official-test-egress rc=$? seconds=$(( $(date +%s) - s ))" | tee -a 00-timing.txt
tail -12 01-official-test-egress.log | cut -c1-220

mkdir -p ~/shellprobe && cd ~/shellprobe
(cd ~/substrate && CGO_ENABLED=0 go build -o ~/shellprobe/sandbox ./demos/sandbox) || exit 1
cat > Dockerfile <<'EOF'
FROM alpine:3.20
RUN apk add --no-cache curl bind-tools openssl ca-certificates
COPY sandbox /sandbox
ENV PORT=80
ENTRYPOINT ["/sandbox"]
EOF
sg docker -c "docker build -q -t localhost:5001/shellprobe:v1 . && docker push -q localhost:5001/shellprobe:v1" > "$E/02-build-shellprobe.log" 2>&1
IMG=$(sg docker -c "docker inspect --format '{{index .RepoDigests 0}}' localhost:5001/shellprobe:v1")
cd "$E"; echo "$IMG" > 02-shellprobe-image.txt

cat > targets.yaml <<'EOF'
apiVersion: v1
kind: Namespace
metadata: {name: egress-target}
---
apiVersion: apps/v1
kind: Deployment
metadata: {name: whoami, namespace: egress-target}
spec:
  replicas: 1
  selector: {matchLabels: {app: whoami}}
  template:
    metadata: {labels: {app: whoami}}
    spec:
      containers:
      - {name: whoami, image: traefik/whoami:v1.10.3, ports: [{containerPort: 80}]}
---
apiVersion: v1
kind: Service
metadata: {name: whoami, namespace: egress-target}
spec: {selector: {app: whoami}, ports: [{port: 80, targetPort: 80}]}
---
apiVersion: v1
kind: ConfigMap
metadata: {name: drip, namespace: egress-target}
data:
  drip.py: |
    import time, http.server, urllib.parse
    class H(http.server.BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"
        def do_GET(self):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            n = int(q.get("n", ["10"])[0])
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Transfer-Encoding", "chunked")
            self.end_headers()
            try:
                for i in range(1, n + 1):
                    line = ("chunk %d %s\n" % (i, time.strftime("%H:%M:%S"))).encode()
                    self.wfile.write(b"%x\r\n%s\r\n" % (len(line), line)); self.wfile.flush()
                    time.sleep(1)
                self.wfile.write(b"0\r\n\r\n")
            except Exception as e:
                print("client gone at chunk", i, e, flush=True)
    http.server.ThreadingHTTPServer(("", 80), H).serve_forever()
---
apiVersion: apps/v1
kind: Deployment
metadata: {name: drip, namespace: egress-target}
spec:
  replicas: 1
  selector: {matchLabels: {app: drip}}
  template:
    metadata: {labels: {app: drip}}
    spec:
      containers:
      - name: drip
        image: python:3.12-alpine
        command: ["python", "-u", "/app/drip.py"]
        volumeMounts: [{name: app, mountPath: /app}]
      volumes: [{name: app, configMap: {name: drip}}]
---
apiVersion: v1
kind: Service
metadata: {name: drip, namespace: egress-target}
spec: {selector: {app: drip}, ports: [{port: 80, targetPort: 80}]}
---
apiVersion: v1
kind: Namespace
metadata: {name: cred-ns}
---
apiVersion: v1
kind: Namespace
metadata: {name: cred-ns-not-granted}
EOF
kubectl apply -f targets.yaml > 03-apply-targets.log 2>&1
M1="lab-granted-marker-$(date +%s)"; M2="lab-ungranted-marker-$(date +%s)"
echo "$M1" > 03-marker-granted.txt; echo "$M2" > 03-marker-ungranted.txt
kubectl -n cred-ns create secret generic api-token --from-file=token=03-marker-granted.txt >> 03-apply-targets.log 2>&1
kubectl -n cred-ns-not-granted create secret generic api-token --from-file=token=03-marker-ungranted.txt >> 03-apply-targets.log 2>&1
kubectl -n egress-target rollout status deploy/whoami --timeout=120s >> 03-apply-targets.log 2>&1
kubectl -n egress-target rollout status deploy/drip --timeout=120s >> 03-apply-targets.log 2>&1

kubectl -n ate-system get cm k8s-credential-provider-namespace-policy -o yaml > 04-provider-policy-before.yaml 2>&1
if kubectl -n ate-system get deploy k8s-credential-provider >/dev/null 2>&1; then
  cat > provider-policy.yaml <<'EOF'
policies:
- atespace: lab-f
  allowedNamespaces:
  - cred-ns
EOF
  kubectl -n ate-system create cm k8s-credential-provider-namespace-policy --from-file=namespace-policy.yaml=provider-policy.yaml --dry-run=client -o yaml | kubectl apply -f - > 04-provider-policy-apply.log 2>&1
  kubectl -n ate-system rollout restart deploy/k8s-credential-provider >> 04-provider-policy-apply.log 2>&1
  kubectl -n ate-system rollout status deploy/k8s-credential-provider --timeout=120s >> 04-provider-policy-apply.log 2>&1
  kubectl -n ate-system get cm k8s-credential-provider-namespace-policy -o yaml > 04-provider-policy-after.yaml
else
  echo "no k8s-credential-provider deployment on this install" > 04-provider-policy-apply.log
fi
tail -2 04-provider-policy-apply.log

K create atespace lab-f | tail -1
cat > shell-template.yaml <<EOF
metadata:
  atespace: lab-f
  name: shell
workerSelector:
  matchLabels:
    workload: egress
containers:
- name: shell
  image: $IMG
  env:
  - name: PORT
    value: "80"
  volumeMounts:
  - name: system-info
    mountPath: /run/ate
volumes:
- name: system-info
  systemInfo:
    dataSources:
    - trustBundle:
        names:
        - egress-mitm.ate.dev
        - system-roots.ate.dev
        path: egress-trust-bundle/trust-bundle.pem
resources:
  limits:
    cpuMillicores: 500
    memoryBytes: 268435456
snapshotConfig:
  preferredFidelity: SNAPSHOT_FIDELITY_MEMORY
EOF
K create actor-template -f shell-template.yaml | tail -2
for i in $(seq 1 30); do K get actor-templates -a lab-f | grep -q -E 'shell +[0-9a-f-]{36}' && break; sleep 2; done
K get actor-templates -a lab-f | tee 05-template.txt
K get actor-template shell -a lab-f -o yaml > 05-template.yaml
kubectl get workerpool -A | tee 06-workerpools.txt
kubectl get svc -n egress-target -o wide | tee 07-targets.txt
