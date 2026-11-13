export PATH=$HOME/u/bin-new:$PATH:/usr/local/go/bin:$HOME/go/bin
U=~/u; EV=~/evidence/Z-bursts; mkdir -p $EV
export ATE_RECORD_DIR=$U/rec
export KUBECONFIG=$U/kc-zb
export KIND_CLUSTER_NAME=zb
NODE=zb-control-plane
S=sc-lab
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
log() { echo "$(date -u +%T) $*" | tee -a $O/00-run.log; }
disk_mb() { df -m / | awk 'NR==2{print $4}'; }
mem_mb() { free -m | awk 'NR==2{print $7}'; }
ms() { date +%s%3N; }
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
