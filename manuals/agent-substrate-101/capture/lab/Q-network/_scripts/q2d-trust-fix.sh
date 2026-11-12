export KUBECONFIG=$HOME/.kube/kind-kind.config
E=~/evidence/Q-network/i-model-gateway; cd "$E"
NS=model-gw
kubectl -n ate-system logs deploy/atenet-egress --all-containers --since=20m 2>/dev/null | grep -E "http.status=503" | grep modelgw | tail -2 | cut -c1-1500 > 41-egress-503-line.log
kubectl -n ate-system logs deploy/atenet-egress --all-containers --since=20m 2>/dev/null | grep -i -E "UnknownIssuer|invalid peer certificate|InvalidCertificate" | tail -3 | cut -c1-900 >> 41-egress-503-line.log
python3 - <<'EOF'
p = 'mock.py'
s = open(p).read()
if 'wbufsize' not in s:
    s = s.replace('    protocol_version = "HTTP/1.1"\n', '    protocol_version = "HTTP/1.1"\n    wbufsize = 65536\n', 1)
    s = s.replace('        self.wfile.write(out)\n', '        self.wfile.write(out)\n        self.wfile.flush()\n', 1)
    open(p, 'w').write(s)
EOF
kubectl -n $NS create configmap mock --from-file=mock.py --dry-run=client -o yaml | kubectl apply -f - > 42-mock-v2.log 2>&1
kubectl -n $NS rollout restart deploy/mock-a deploy/mock-b >> 42-mock-v2.log 2>&1
kubectl -n $NS rollout status deploy/mock-a --timeout=120s >> 42-mock-v2.log 2>&1; kubectl -n $NS rollout status deploy/mock-b --timeout=120s >> 42-mock-v2.log 2>&1
cat /etc/ssl/certs/ca-certificates.crt ~/modelgw-work/ca.crt > ~/modelgw-work/combined-roots.crt
echo "system roots: $(grep -c BEGIN /etc/ssl/certs/ca-certificates.crt) certificates; combined: $(grep -c BEGIN ~/modelgw-work/combined-roots.crt)" > 43-trust-patch.log
kubectl -n ate-system create configmap egress-extra-roots --from-file=ca-certificates.crt=$HOME/modelgw-work/combined-roots.crt --dry-run=client -o yaml | kubectl apply -f - >> 43-trust-patch.log 2>&1
cat > 43-trust-patch.json <<'EOF'
[
  {"op": "add", "path": "/spec/template/spec/volumes/-", "value": {"name": "extra-roots", "configMap": {"name": "egress-extra-roots"}}},
  {"op": "add", "path": "/spec/template/spec/containers/0/volumeMounts/-", "value": {"name": "extra-roots", "mountPath": "/etc/ssl/certs/ca-certificates.crt", "subPath": "ca-certificates.crt"}}
]
EOF
kubectl -n ate-system get deploy atenet-egress -o json | jq -e '.spec.template.spec.volumes[] | select(.name=="extra-roots")' > /dev/null 2>&1 || kubectl -n ate-system patch deploy atenet-egress --type=json --patch-file 43-trust-patch.json >> 43-trust-patch.log 2>&1
kubectl -n ate-system rollout status deploy/atenet-egress --timeout=180s >> 43-trust-patch.log 2>&1
kubectl -n ate-system get pods -l app=atenet-egress -o wide >> 43-trust-patch.log 2>&1
kubectl -n ate-system get pods | grep atenet-egress >> 43-trust-patch.log
sleep 10
cat 41-egress-503-line.log | cut -c1-900; tail -4 43-trust-patch.log
