. ~/scripts/y-lib.sh
DIRECTION=$1
OLD=v1.0.0-rc.3; NEW=v1.0.0
usecluster yupg
S=up-lab
R() { PX "sh /tmp/req.sh $*"; }
st() { kubectl ate get actor "$1" -a $S -o json 2>/dev/null | jq -r .status.state; }
RECORD=$ATE_RECORD_DIR/installs/kind-yupg.yaml
NS=$S; WORKERPOOL=up-pool
if [ $DIRECTION = upgrade ]; then
  export PATH=$U/bin-rc3:$PATH
  O=$EV/20-upgrade/20-upgrade; SRC=$U/new; CFG=$U/ate-upgrade/new.yaml; TO=$NEW; AFTERCLI=$U/bin-new
else
  export PATH=$U/bin-new:$PATH
  O=$EV/20-upgrade/40-rollback; SRC=$U/rc3; CFG=$U/ate-upgrade/old.yaml; TO=$OLD; AFTERCLI=$U/bin-rc3
fi
mkdir -p $O; cd $O; TL=$O/00-timeline.tsv; : > $TL
cat > loop.sh <<'EOF'
C="--cacert /run/ca/trust-bundle.pem --cert /run/id/credential-bundle.pem --key /run/id/credential-bundle.pem"
U=https://atenet-router.ate-system.svc:443/
while [ ! -f /tmp/stop ]; do
  t=$(date +%s)
  for a in a-run a-term; do
    ( r=$(curl -s -m 9 -o /tmp/b.$a.$t -w '%{http_code}\t%{time_total}' $C -X POST -H "ate-target-actor: up-lab/$a" $U); printf '%s\trunning\t%s\t%s\t%s\n' "$t" "$a" "$r" "$(head -c 140 /tmp/b.$a.$t | tr '\n\t' '  ')" >> /tmp/probe.tsv; rm -f /tmp/b.$a.$t ) &
  done
  sleep 1
done
EOF
kubectl -n ate-system exec -i u-prober -- sh -c 'cat > /tmp/loop.sh; rm -f /tmp/stop /tmp/probe.tsv' < loop.sh
{ for a in a-run a-term a-cyc; do echo "$a $(st $a) $(R $a)"; done; K get actors -a $S; } > 01-before.txt 2>&1
kubectl -n ate-system exec u-prober -- sh -c 'nohup sh /tmp/loop.sh > /tmp/loop.log 2>&1 &'
( while [ ! -f stop ]; do
    t=$(date +%s); s0=$(now)
    a=$(kubectl ate suspend actor a-cyc -a $S --mode sync 2>&1 | grep -v '^Warning' | tail -1 | cut -c1-200); sd=$(el $s0)
    r=$(R a-cyc 14 2>&1 | tail -1)
    printf '%s\tcycle\tsuspend %s s: %s\tresume: %s\n' "$t" "$sd" "$a" "$r" >> 02-cycle-stream.tsv
    sleep 3
  done ) &
( while [ ! -f stop ]; do t=$(date +%s); s0=$(now); n=$(kubectl ate get actors -a $S 2>&1 | grep -c ACTOR_STATE); printf '%s\tapi\t%s actors listed\t%s s\n' "$t" "$n" "$(el $s0)" >> 03-api-stream.tsv; sleep 2; done ) &
( while [ ! -f stop ]; do printf '%s\t%s\n' "$(date +%s)" "$(kubectl get pods -A --no-headers 2>/dev/null | grep -v -E 'Running|Completed' | awk '{print $1"/"$2":"$4}' | tr '\n' ' ')"; sleep 3; done > 04-pods-not-running.tsv ) &
( while [ ! -f stop ]; do printf '%s\t%s\t%s\n' "$(date +%s)" "$(st a-run)" "$(st a-term)" >> 06-states.tsv; sleep 2; done ) &
tl start-baseline; sleep 30
run() { n="$1"; shift; tl "$n begin"; s0=$(now); sg docker -c "$*" > "$O/$n.log" 2>&1; rc=$?; tl "$n end rc=$rc seconds=$(el $s0)"; return $rc; }
roll_pool() {
  IMAGE=$1
  tl "pool-patch begin image=$IMAGE"
  kubectl -n $NS patch workerpool $WORKERPOOL --type merge -p "{\"spec\":{\"workerImage\":\"$IMAGE\"}}" > $O/23c-patch.log 2>&1
  kubectl -n $NS wait deployment/$WORKERPOOL --for=jsonpath='{.spec.template.spec.containers[0].image}'="$IMAGE" --timeout=2m >> $O/23c-patch.log 2>&1
  tl "pool-deployment-has-image"
  for i in $(seq 1 24); do printf '%s\t%s\t%s\t%s\n' "$(date +%s)" "$(st a-run)" "$(st a-term)" "$(kubectl -n $NS get pods --no-headers 2>/dev/null | awk '{print $3}' | sort | uniq -c | tr '\n' ' ')" >> $O/23d-roll-watch.tsv; sleep 5; done
  kubectl -n $NS get pods -o wide > $O/23e-pods-120s-after-patch.txt 2>&1
  tl "owner-suspends-a-term state-before=$(st a-term) a-run-state=$(st a-run)"
  s0=$(now); K suspend actor a-term -a $S --mode sync > $O/23f-suspend-a-term.txt 2>&1; tl "a-term-suspended seconds=$(el $s0) state=$(st a-term)"
  if [ "$(st a-run)" = ACTOR_STATE_RUNNING ]; then s0=$(now); K suspend actor a-run -a $S --mode sync > $O/23f-suspend-a-run.txt 2>&1; tl "a-run-suspended seconds=$(el $s0) state=$(st a-run)"; fi
  s0=$(now); kubectl -n $NS rollout status deployment/$WORKERPOOL --timeout=900s > $O/23g-rollout-status.log 2>&1; tl "pool-roll-done rc=$? seconds=$(el $s0)"
  for i in $(seq 1 60); do [ "$(kubectl -n $NS get pods --no-headers 2>/dev/null | grep -c Terminating)" = 0 ] && break; sleep 5; done; tl "no-terminating-worker-left"
  kubectl -n $NS get pods -o wide > $O/23h-pods-after-roll.txt 2>&1
  { echo "a-term after the roll: $(R a-term)"; echo "a-run state $(st a-run): $(R a-run)"; } > $O/23i-after-roll.txt 2>&1
  if [ "$(st a-run)" = ACTOR_STATE_CRASHED ]; then s0=$(now); K revert actor a-run -a $S >> $O/23i-after-roll.txt 2>&1; tl "a-run-reverted seconds=$(el $s0)"; echo "a-run after revert: $(R a-run)" >> $O/23i-after-roll.txt; fi
}
if [ $DIRECTION = upgrade ]; then
  OLD_RELEASE=$(sed -n 's/^ *substrateVersion: //p' $RECORD)
  echo "Upgrading '$OLD_RELEASE' -> '$NEW'" > 10-before-you-start.txt
  rm -rf $U/ate-upgrade; mkdir $U/ate-upgrade && cd $U/ate-upgrade
  cp $RECORD old.yaml && cp $RECORD new.yaml
  sed -i.bak "s/^  tag: .*/  tag: $NEW/" new.yaml
  grep 'tag:' old.yaml new.yaml >> $O/10-before-you-start.txt
  ln -s $U/rc3 old; ln -s $U/new new
  kubectl -n ate-system exec postgres-0 -c postgres -- pg_dump -U postgres -d atepg > $U/ate-upgrade/backup.sql 2>> $O/10-before-you-start.txt; echo "pg_dump bytes $(wc -c < $U/ate-upgrade/backup.sql)" >> $O/10-before-you-start.txt
  cd $SRC
  run 21-step1-podcertificate-controller "go run ./cmd/ate-setup deploy podcertificate-controller --config $CFG"
  run 22-step2-atelet "go run ./cmd/ate-setup deploy atelet --config $CFG --rollout-timeout 1h"
  kubectl -n ate-system rollout status ds/atelet --timeout=600s >> $O/22-step2-atelet.log 2>&1
  kubectl get workerpools -A -o custom-columns='NAMESPACE:.metadata.namespace,NAME:.metadata.name,CLASS:.spec.sandboxClasses[0].name,IMAGE:.spec.workerImage' | tee $U/ate-upgrade/before-workerpools.txt > $O/23a-before-workerpools.txt
  CLASS=$(kubectl -n $NS get workerpool $WORKERPOOL -o jsonpath='{.spec.sandboxClasses[0].name}')
  NEW_IMAGE=$(sed -n 's/^  repo: //p' $CFG)/ateworker-$CLASS:$NEW
  DIG=$(docker buildx imagetools inspect $NEW_IMAGE --format '{{json .Manifest}}' 2>/dev/null | jq -r .digest)
  echo "$NS/$WORKERPOOL $CLASS $NEW_IMAGE@$DIG" > $O/23b-image.txt
  roll_pool $NEW_IMAGE@$DIG
  run 24a-step4a-apiserver "go run ./cmd/ate-setup deploy apiserver --config $CFG"
  kubectl -n ate-system rollout status deploy/ate-api-server --timeout=300s >> $O/24a-step4a-apiserver.log 2>&1
  kubectl -n ate-system rollout status deploy/ate-idp-server --timeout=300s >> $O/24a-step4a-apiserver.log 2>&1; tl "24a-rollouts-done"
  run 24b-step4b-ate-controller "go run ./cmd/ate-setup deploy ate-controller --config $CFG"
  run 24c-step4c-atenet "go run ./cmd/ate-setup deploy atenet --config $CFG"
  kubectl -n ate-system rollout status deploy/atenet-router --timeout=300s >> $O/24c-step4c-atenet.log 2>&1
  kubectl -n ate-system rollout status deploy/atenet-egress --timeout=300s >> $O/24c-step4c-atenet.log 2>&1; tl "24c-rollouts-done"
  run 24d-step4d-sandboxconfig "go run ./cmd/ate-setup deploy sandboxconfig --config $CFG"
  run 24e-step4e-ate-system "go run ./cmd/ate-setup deploy ate-system --config $CFG --setup-csi=none"
else
  cd $SRC
  echo "rollback from $NEW to $OLD with old.yaml, from the old checkout, in the order of the guide" > $O/10-before-you-start.txt
  grep 'tag:' $U/ate-upgrade/old.yaml >> $O/10-before-you-start.txt; cat $U/ate-upgrade/before-workerpools.txt >> $O/10-before-you-start.txt
  run 24d-rb4-sandboxconfig "go run ./cmd/ate-setup deploy sandboxconfig --config $CFG"
  run 24c-rb4-atenet "go run ./cmd/ate-setup deploy atenet --config $CFG"
  kubectl -n ate-system rollout status deploy/atenet-router --timeout=300s >> $O/24c-rb4-atenet.log 2>&1
  kubectl -n ate-system rollout status deploy/atenet-egress --timeout=300s >> $O/24c-rb4-atenet.log 2>&1; tl "24c-rollouts-done"
  run 24b-rb4-ate-controller "go run ./cmd/ate-setup deploy ate-controller --config $CFG"
  run 24a-rb4-apiserver "go run ./cmd/ate-setup deploy apiserver --config $CFG"
  kubectl -n ate-system rollout status deploy/ate-api-server --timeout=300s >> $O/24a-rb4-apiserver.log 2>&1
  kubectl -n ate-system rollout status deploy/ate-idp-server --timeout=300s >> $O/24a-rb4-apiserver.log 2>&1; tl "24a-rollouts-done"
  OLD_IMAGE=$(awk -v ns=$NS -v name=$WORKERPOOL '$1 == ns && $2 == name {print $4}' $U/ate-upgrade/before-workerpools.txt)
  echo "$NS/$WORKERPOOL $OLD_IMAGE" > $O/23b-image.txt
  roll_pool $OLD_IMAGE
  kubectl get pods -A -l ate.dev/worker-pool > $O/22a-no-terminating-before-atelet.txt 2>&1
  run 22-rb2-atelet "go run ./cmd/ate-setup deploy atelet --config $CFG --rollout-timeout 1h"
  kubectl -n ate-system rollout status ds/atelet --timeout=600s >> $O/22-rb2-atelet.log 2>&1
  run 21-rb1-podcertificate-controller "go run ./cmd/ate-setup deploy podcertificate-controller --config $CFG"
fi
sleep 45
tl commands-done; sleep 20; tl end
kubectl -n ate-system exec u-prober -- touch /tmp/stop; touch $O/stop; sleep 20
kubectl -n ate-system exec u-prober -- cat /tmp/probe.tsv | sort -n > $O/05-running-stream.tsv
rm -f $O/stop
kubectl get pods -A -o json | jq -r '.items[]|.metadata.namespace+"/"+.metadata.name+"\t"+([.spec.containers[].image]|join(","))' > $O/30-images-after.txt
kubectl get pods -A -o wide > $O/31-pods-after.txt
kubectl -n ate-system exec postgres-0 -c postgres -- psql -U postgres -d atepg -Atc "select * from substrate.schema_migrations" > $O/33-schema-migrations-after.txt 2>&1
cat $RECORD > $O/34-record-after.yaml
kubectl get crd -o json | jq -r '.items[]|select(.spec.group|test("ate"))|.metadata.name+"\t"+(.spec.versions[0].schema.openAPIV3Schema|tostring|length|tostring)' > $O/35-crds-after.txt 2>&1
kubectl get sandboxconfigs -A -o yaml > $O/36-sandboxconfigs-after.yaml 2>&1
export PATH=$AFTERCLI:$PATH
{
kubectl ate version 2>&1 | head -3
K get actors -a $S
for a in a-run a-term a-sync a-def a-tag a-fresh a-cyc; do echo "$a $(st $a): $(R $a)"; done
n=new-$DIRECTION
K create actor a-$n -a $S --template up-drill | tail -1; echo "a-$n (from the golden snapshot): $(R a-$n)"
K create actor a-tag-$n -a $S --template up-drill --tag pre-up | tail -1; echo "a-tag-$n (from tag pre-up, made at count 5 on $OLD): $(R a-tag-$n)"
K suspend actor a-$n -a $S --mode sync; echo "a-$n after a sync suspend on $TO: $(R a-$n)"
for a in a-sync a-def a-tag a-fresh a-$n a-tag-$n; do K suspend actor $a -a $S --mode sync > /dev/null; done
K get actors -a $S
K get actor-templates -a $S; K get tags -a $S
} > $O/40-actors-after.txt 2>&1
awk -F'\t' '{k=$3; n[k]++; if($4!=200) f[k]++} END{for(k in n) printf "%s\t%d of %d failed\n", k, f[k]+0, n[k]}' $O/05-running-stream.tsv > $O/41-summary.txt
awk -F'\t' '{n++; if($4 !~ /resume: 200/) f++} END{printf "cycle\t%d of %d not 200\n", f+0, n}' $O/02-cycle-stream.tsv >> $O/41-summary.txt
echo DONE > $O/99-done; cat $O/41-summary.txt; grep -E "begin|end rc|suspended|reverted|roll-done" $TL | cut -f3
