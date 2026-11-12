export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
V=~/evidence/V-validation
S=lab-v
IMG=$(cat $V/00-setup/image.txt)
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
now() { date +%s.%N; }
ts() { date -u +%FT%T.%3NZ; }
el() { echo "$(now) - $1" | bc -l | xargs printf '%.3f'; }
call() { curl -s -m ${CT:-180} -o body.tmp -w '%{http_code}\t%{time_total}' "http://127.0.0.1:$1${2:-/}"; printf '\t%s' "$(tr -d '\n' < body.tmp | cut -c1-260)"; }
st() { kubectl ate get actor $1 -a ${2:-$S} -o json 2>/dev/null | jq -r '[.status.state, (.status.assignedNode // "-"), ((.status.snapshots // []) | map(.owner + ":" + (.fidelity // "-") + ":" + (.durableSnapshot.state // "none") + ":gen" + (.generation|tostring)) | join(","))] | @tsv'; }
proxy() { (kubectl ate proxy actor $1 -a ${3:-$S} $2:80 > proxy-$1.log 2>&1 &); for t in $(seq 1 40); do grep -q Proxying proxy-$1.log 2>/dev/null && break; sleep 0.25; done; }
tmpl() {
  name=$1; mb=$2; fid=$3; shift 3
  {
  echo "metadata:"; echo "  atespace: ${TS:-$S}"; echo "  name: $name"
  echo "workerSelector:"; echo "  matchLabels:"; echo "    workload: ${POOL:-vpool}"
  echo "containers:"; echo "- name: ballast"; echo "  image: ${TIMG:-$IMG}"; echo "  command:"; echo "  - /ballast"; echo "  - --mb=$mb"
  for a in "$@"; do echo "  - $a"; done
  echo "  wakeupProbe:"; echo "    httpGet:"; echo "      path: /readyz"; echo "      port: 80"
  if [ -n "${VOL:-}" ]; then echo "  volumeMounts:"; echo "  - name: data"; echo "    mountPath: /data"; fi
  echo "resources:"; echo "  limits:"; echo "    cpuMillicores: ${CPU:-1000}"; echo "    memoryBytes: $(( (mb + 256) * 1048576 ))"
  echo "snapshotConfig:"; echo "  preferredFidelity: SNAPSHOT_FIDELITY_$fid"
  if [ -n "${VOL:-}" ]; then echo "volumes:"; echo "- name: data"; echo "  durableDir: {}"; fi
  } > tmpl-$name.yaml
  K create actor-template -f tmpl-$name.yaml > create-tmpl-$name.txt 2>&1
}
waitgold() { for i in $(seq 1 90); do kubectl ate get actor-template $1 -a ${2:-$S} -o json 2>/dev/null | jq -e '.status.goldenSnapshotStatus.goldenTag.name' >/dev/null 2>&1 && return 0; sleep 1; done; return 1; }
localsize() { uid=$(kubectl ate get actor $1 -a ${2:-$S} -o json 2>/dev/null | jq -r .metadata.uid); sg docker -c "docker exec kind-control-plane du -sk /var/lib/ate/snapshots/$uid" 2>/dev/null | cut -f1; }
storesize() {
  uri=$(kubectl ate get actor $1 -a ${2:-$S} -o json 2>/dev/null | jq -r '[.status.snapshots[] | select(.owner=="SNAPSHOT_OWNER_ACTOR") | .durableSnapshot.object.snapshotUri] | last')
  p=${uri#gs://}
  RP=$(kubectl -n ate-system get pod -l app=rustfs -o name | head -1)
  kubectl -n ate-system exec $RP -- du -sk /data/$p 2>/dev/null | cut -f1
}
