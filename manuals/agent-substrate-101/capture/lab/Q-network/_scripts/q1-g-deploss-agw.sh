export KUBECONFIG=$HOME/.kube/kind-kind.config
[ -s $KUBECONFIG ] || (cd ~/substrate && PATH=$PATH:/usr/local/go/bin hack/kind.sh get kubeconfig --name kind > $KUBECONFIG)
kubectl config current-context
E=~/evidence/Q-network/g-dependency-loss-agw; mkdir -p "$E"; cd "$E"
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
S=lab-e
tl() { echo "$(date +%s)	$(date -u +%T)	$*" | tee -a 10-timeline.tsv; }
: > 10-timeline.tsv
WI=$(kubectl get workerpool counter -n ate-demo-counter -o jsonpath='{.spec.workerImage}')
CI=$(kubectl ate get actor-template counter -a ate-demo-counter -o json 2>/dev/null | jq -r '.containers[0].image')
cat > pool.yaml <<EOF
apiVersion: v1
kind: Namespace
metadata: {name: lab-e}
---
apiVersion: ate.dev/v1
kind: WorkerPool
metadata:
  name: e-pool
  namespace: lab-e
  labels: {workload: e-pool}
spec:
  replicas: 3
  workerImage: $WI
  sandboxClasses:
  - name: gvisor
  template:
    resources:
      limits: {cpu: "5", memory: 5Gi}
      requests: {cpu: 250m, memory: 512Mi}
EOF
kubectl apply -f pool.yaml > 00-setup.log 2>&1
K create atespace $S >> 00-setup.log
cat > template.yaml <<EOF
metadata:
  atespace: $S
  name: e-counter
workerSelector:
  matchLabels: {workload: e-pool}
containers:
- name: counter
  image: $CI
  command: ["/ko-app/counter"]
  wakeupProbe:
    httpGet: {path: /readyz, port: 80}
  volumeMounts:
  - {name: data, mountPath: /home/counter}
resources:
  limits:
    cpuMillicores: 100
    memoryBytes: 100663296
snapshotConfig:
  preferredFidelity: SNAPSHOT_FIDELITY_MEMORY
volumes:
- name: data
  durableDir: {}
EOF
K create actor-template -f template.yaml >> 00-setup.log
kubectl -n lab-e rollout status deploy/e-pool --timeout=180s >> 00-setup.log 2>&1
for i in $(seq 1 40); do K get actor-templates -a $S | grep -q -E 'e-counter +[0-9a-f-]{36}' && break; sleep 2; done
K get actor-templates -a $S | tee -a 00-setup.log
K create actor e-run -a $S --template e-counter >> 00-setup.log
for n in $(seq 1 130); do K create actor $(printf 'e-s-%03d' $n) -a $S --template e-counter > /dev/null; done
K get actors -a $S | awk '{print $4}' | sort | uniq -c | tee -a 00-setup.log
kubectl -n ate-system get sa atenet-client >/dev/null 2>&1 || kubectl -n ate-system create sa atenet-client
cat > prober.yaml <<'EOF'
apiVersion: v1
kind: Pod
metadata: {name: e-prober, namespace: ate-system, labels: {app: e-prober}}
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
kubectl apply -f prober.yaml >> 00-setup.log 2>&1
kubectl -n ate-system wait --for=condition=Ready pod/e-prober --timeout=120s >> 00-setup.log 2>&1
cat > loop.sh <<'EOF'
R=https://atenet-router.ate-system.svc:443/
C="--cacert /run/ca/trust-bundle.pem --cert /run/id/credential-bundle.pem --key /run/id/credential-bundle.pem"
i=0; n=0
while [ ! -f /tmp/stop ]; do
  t=$(date +%s)
  ( r=$(curl -s -m 9 -o /tmp/b.$t -w '%{http_code}\t%{time_total}' $C -X POST -H 'ate-target-actor: lab-e/e-run' $R); printf '%s\trunning\te-run\t%s\t%s\n' "$t" "$r" "$(head -c 140 /tmp/b.$t | tr '\n\t' '  ')" >> /tmp/probe.tsv; rm -f /tmp/b.$t ) &
  if [ $((i % 5)) -eq 0 ]; then
    n=$((n+1)); a=$(printf 'e-s-%03d' $n)
    ( r=$(curl -s -m 14 -o /tmp/f.$t -w '%{http_code}\t%{time_total}' $C -X POST -H "ate-target-actor: lab-e/$a" $R); printf '%s\tsuspended\t%s\t%s\t%s\n' "$t" "$a" "$r" "$(head -c 140 /tmp/f.$t | tr '\n\t' '  ')" >> /tmp/probe.tsv; rm -f /tmp/f.$t ) &
  fi
  i=$((i+1))
  sleep 1
done
EOF
kubectl -n ate-system cp loop.sh e-prober:/tmp/loop.sh >> 00-setup.log 2>&1 || kubectl -n ate-system exec -i e-prober -- sh -c 'cat > /tmp/loop.sh' < loop.sh
(kubectl ate proxy actor e-run -a $S 8301:80 > proxy-e-run.log 2>&1 &)
sleep 4
curl -s -m 20 -X POST http://127.0.0.1:8301/ | tee -a 00-setup.log
K get actor e-run -a $S | tee -a 00-setup.log
kubectl -n ate-system exec e-prober -- sh -c 'nohup sh /tmp/loop.sh > /tmp/loop.log 2>&1 &'
# VM-side probe through kubectl ate proxy, with a watchdog that restarts the proxy when it dies
( while [ ! -f stop ]; do
    t=$(date +%s)
    if ! pgrep -f "proxy actor e-run" > /dev/null; then echo "$t	proxy-restart" >> 11-proxy-restarts.tsv; (kubectl ate proxy actor e-run -a $S 8301:80 >> proxy-e-run.log 2>&1 &); fi
    ( r=$(curl -s -m 9 -o b.$t -w '%{http_code}\t%{time_total}' -X POST http://127.0.0.1:8301/); printf '%s\tproxy\te-run\t%s\t%s\n' "$t" "$r" "$(head -c 140 b.$t | tr '\n\t' '  ')" >> 12-probe-proxy.tsv; rm -f b.$t ) &
    sleep 1
  done ) &
kapi() { sg docker -c "docker exec kind-control-plane curl -sk -m 2 -o /dev/null -w '%{http_code}' https://127.0.0.1:6443/livez" 2>/dev/null; }
tl start-baseline
sleep 30

tl T1-postgres-scale-0
kubectl -n ate-system scale sts postgres --replicas=0 >> 13-actions.log 2>&1
sleep 20
K get actor e-run -a $S > 14-T1-cli-during.txt 2>&1
kubectl -n ate-system get pods > 14-T1-pods-during.txt 2>&1
kubectl -n ate-system logs deploy/atenet-router --all-containers --since=25s > 14-T1-router-during.log 2>&1
kubectl -n ate-system logs deploy/ate-api-server --all-containers --since=25s 2>&1 | tail -40 > 14-T1-ateapi-during.log
sleep 40
tl T1-postgres-scale-1
kubectl -n ate-system scale sts postgres --replicas=1 >> 13-actions.log 2>&1
kubectl -n ate-system rollout status sts/postgres --timeout=180s >> 13-actions.log 2>&1
tl T1-postgres-ready
sleep 90
kubectl -n ate-system get pods > 14-T1-pods-after.txt 2>&1

tl T2-ateapi-scale-0
kubectl -n ate-system scale deploy ate-api-server --replicas=0 >> 13-actions.log 2>&1
sleep 20
K get actor e-run -a $S > 15-T2-cli-during.txt 2>&1
kubectl -n ate-system logs deploy/atenet-router --all-containers --since=25s > 15-T2-router-during.log 2>&1
sleep 40
tl T2-ateapi-scale-2
kubectl -n ate-system scale deploy ate-api-server --replicas=2 >> 13-actions.log 2>&1
kubectl -n ate-system rollout status deploy/ate-api-server --timeout=180s >> 13-actions.log 2>&1
tl T2-ateapi-ready
sleep 90
kubectl -n ate-system get pods > 15-T2-pods-after.txt 2>&1

tl T3-kube-apiserver-manifest-moved-out "livez=$(kapi)"
sg docker -c "docker exec kind-control-plane mv /etc/kubernetes/manifests/kube-apiserver.yaml /root/kube-apiserver.yaml"
for i in $(seq 1 60); do
  echo "$(date +%s)	$(kapi)" >> 16-T3-kube-apiserver-livez.tsv
  [ $i = 25 ] && { kubectl get nodes > 16-T3-kubectl-during.txt 2>&1; K get actor e-run -a $S > 16-T3-cli-during.txt 2>&1; }
  sleep 1
done
tl T3-kube-apiserver-manifest-moved-back
sg docker -c "docker exec kind-control-plane mv /root/kube-apiserver.yaml /etc/kubernetes/manifests/kube-apiserver.yaml"
for i in $(seq 1 120); do c=$(kapi); echo "$(date +%s)	$c" >> 16-T3-kube-apiserver-livez.tsv; [ "$c" = 200 ] && break; sleep 1; done
tl T3-kube-apiserver-livez-200
sleep 90
tl end
touch stop
kubectl -n ate-system exec e-prober -- touch /tmp/stop
sleep 3
kubectl -n ate-system exec e-prober -- cat /tmp/probe.tsv > 12-probe-incluster.tsv
kubectl get pods -A > 17-pods-end.txt 2>&1
K get actors -a $S | awk '{print $4}' | sort | uniq -c > 17-actors-end.txt
kubectl -n ate-system logs deploy/atenet-router --all-containers --since=15m > 18-router-full.log 2>&1
rm -f stop
pkill -f "proxy actor e-run"
echo E-DONE | tee -a 10-timeline.tsv
