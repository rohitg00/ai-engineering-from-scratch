export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
U=~/u; EV=~/evidence/Y-reruns-rollback-scale; mkdir -p $U $EV
export ATE_RECORD_DIR=$U/rec
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
now() { date +%s.%N; }
el() { awk -v a="$1" -v b="$(date +%s.%N)" 'BEGIN{printf "%.3f", b-a}'; }
usecluster() { export KUBECONFIG=$U/kc-$1; export KIND_CLUSTER_NAME=$1; NODE=$1-control-plane; }
step() { n="$1"; shift; s=$(date +%s); sg docker -c "$*" > "$O/$n.log" 2>&1; rc=$?; printf '%s\t%s\t%s\n' "$n" "$rc" "$(( $(date +%s) - s ))" >> "$O/steps.tsv"; return $rc; }
tl() { echo "$(date +%s.%N | cut -c1-14)	$(date -u +%T)	$*" | tee -a $TL; }
prober_yaml() {
cat <<'EOF'
apiVersion: v1
kind: Pod
metadata: {name: u-prober, namespace: ate-system, labels: {app: u-prober}}
spec:
  serviceAccountName: atenet-client
  containers:
  - name: c
    image: curlimages/curl:8.11.1
    command: ["sleep", "864000"]
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
}
mkprober() {
  kubectl -n ate-system get sa atenet-client >/dev/null 2>&1 || kubectl -n ate-system create sa atenet-client
  prober_yaml | kubectl apply -f - ; kubectl -n ate-system wait --for=condition=Ready pod/u-prober --timeout=180s
}
PX() { kubectl -n ate-system exec u-prober -- sh -c "$1"; }
install_release() {
  DIR=$1; TAG=$2; NAME=$3
  cd $U/$DIR; git describe --tags > $O/00-checkout.txt
  usecluster $NAME
  export ATE_INSTALL_KIND=true
  step 10-kind-cluster "hack/create-kind-cluster.sh" || { echo "DONE FAIL kind" >> $O/steps.tsv; return 1; }
  step 20-deploy-ate-system "go run ./cmd/ate-setup deploy ate-system --credential-provider='{\"name\":\"k8s.io\"}' --ingress-allowed-spiffe-ids=spiffe://cluster.local/ns/ate-system/sa/atenet-client --image-repo ghcr.io/agent-substrate/substrate --image-tag $TAG"
  rc=$?
  kubectl get pods -A -o wide > $O/40-pods.txt 2>&1
  kubectl get pods -A -o json | jq -r '.items[]|.metadata.namespace+"/"+.metadata.name+"\t"+([.spec.containers[].image]|join(","))' > $O/41-images.txt
  echo "DONE rc=$rc" >> $O/steps.tsv
  return $rc
}
