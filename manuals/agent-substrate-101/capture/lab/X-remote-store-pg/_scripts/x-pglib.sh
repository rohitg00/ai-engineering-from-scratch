export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
X=~/x; EV=~/evidence/X-remote-store-pg; mkdir -p $X $EV
export ATE_RECORD_DIR=$X/rec
export KUBECONFIG=$X/kc-xpg KIND_CLUSTER_NAME=xpg ATE_INSTALL_KIND=true
PGHOST_IP=10.0.2.2; PGPORT_N=15432; WAN=ens3
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
now() { date +%s.%N; }
el() { awk -v a="$1" -v b="$(date +%s.%N)" 'BEGIN{printf "%.3f", b-a}'; }
step() { n="$1"; shift; s=$(date +%s); sg docker -c "$*" > "$O/$n.log" 2>&1; rc=$?; printf '%s\t%s\t%s\n' "$n" "$rc" "$(( $(date +%s) - s ))" >> "$O/steps.tsv"; return $rc; }
scrub() { sed -E 's#(postgresql://[^:/@]+):[^@]+@#\1:REDACTED@#g; s#(PASSWORD[= ]+)[^ ]+#\1REDACTED#g; s#(password=)[^ &]+#\1REDACTED#g'; }
pgc() { sg docker -c "docker exec -i x-pgc sh -c '$1'"; }
pgc_start() {
  sg docker -c "docker ps --format '{{.Names}}'" | grep -q '^x-pgc$' && return 0
  sg docker -c "docker rm -f x-pgc" > /dev/null 2>&1
  sg docker -c "docker run -q -d --name x-pgc --network host --env-file $X/pg.env -v $X/tls/ca.crt:/ca.crt:ro -v $X/src/pkg/postgressetup/setup.sql:/setup.sql:ro postgres:18-alpine sleep 86400" > /dev/null
}
pgq() { sg docker -c "docker exec -i x-pgc sh -c 'PGPASSWORD=\$POSTGRES_PASSWORD psql \"$ADMIN\" ${2--At}'"; }
ADMIN="host=$PGHOST_IP port=$PGPORT_N dbname=atepg user=postgres sslmode=verify-full sslrootcert=/ca.crt"
pgdelay() {
  if [ "$1" = 0 ]; then
    [ -f $X/pgdelay.on ] && sudo tc qdisc del dev $WAN root 2>/dev/null; rm -f $X/pgdelay.on; return 0
  fi
  sudo tc qdisc del dev $WAN root 2>/dev/null
  sudo tc qdisc add dev $WAN root handle 1: prio bands 3 priomap 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
  sudo tc qdisc add dev $WAN parent 1:3 handle 30: netem delay ${1}ms
  sudo tc filter add dev $WAN protocol ip parent 1:0 prio 1 u32 match ip dst $PGHOST_IP/32 match ip dport $PGPORT_N 0xffff flowid 1:3
  touch $X/pgdelay.on
}
prober_yaml() {
cat <<'EOF'
apiVersion: v1
kind: Pod
metadata: {name: x-prober, namespace: ate-system, labels: {app: x-prober}}
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
}
mkprober() {
  kubectl -n ate-system get sa atenet-client >/dev/null 2>&1 || kubectl -n ate-system create sa atenet-client
  prober_yaml | kubectl apply -f - ; kubectl -n ate-system wait --for=condition=Ready pod/x-prober --timeout=180s
}
PX() { kubectl -n ate-system exec x-prober -- sh -c "$1"; }
