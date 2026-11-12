DP=__DP__
export KUBECONFIG=$HOME/.kube/kind-kind.config
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
E=~/evidence/Q-network/l-credential-rotation/$DP; mkdir -p "$E"; cd "$E"
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
S=lab-f; WH=whoami.egress-target.svc.cluster.local
setsecret() { kubectl -n cred-ns create secret generic rot-key --from-literal=token="$1" --dry-run=client -o yaml | kubectl apply -f - > /dev/null 2>&1; }
setsecret "rot-value-$DP-0"
cat > Prot.yaml <<EOF
rules:
- http:
    hostnames: ["$WH"]
    effects:
      replaceHeaders:
      - header: X-Lab
        credentialUri: ate-secret://k8s.io/default/cred-ns/rot-key/token
EOF
K get egress-policy f-main -a $S -o json > live.tmp 2>/dev/null
{ echo "metadata:"; echo "  uid: $(jq -r .metadata.uid live.tmp)"; echo "  version: \"$(jq -r .metadata.version live.tmp)\""; cat Prot.yaml; } > applied-Prot.yaml
K update egress-policy f-main -a $S -f applied-Prot.yaml > 00-policy.log 2>&1
K get egress-policy f-main -a $S -o yaml > 01-policy-live.yaml 2>&1
pkill -f "proxy actor f-main" 2>/dev/null; (kubectl ate proxy actor f-main -a $S 8202:80 > proxy-f-main.log 2>&1 &); for t in $(seq 1 30); do grep -q Proxying proxy-f-main.log 2>/dev/null && break; sleep 0.3; done
jq -n --arg c "curl -s -m 3 -H 'X-Lab: placeholder-from-actor' http://$WH/ | grep -i '^X-Lab' | tr -d '\r'" '{command:["sh","-c",$c],timeout:"8s"}' > req.json
P=10-probe.tsv; echo "epoch	value_seen_by_upstream" > $P
rm -f stop
( while [ ! -f stop ]; do
    v=$(curl -s -m 8 -X POST -H 'Content-Type: application/json' -d @req.json http://127.0.0.1:8202/process | jq -r '.stdout' 2>/dev/null | tr -d '\n' | cut -c1-80)
    echo "$(date +%s.%N | cut -c1-14)	${v:-none}" >> $P
    sleep 0.9
  done ) &
R=20-rotations.tsv; echo "rotation	wait_before_s	secret_changed_epoch	first_seen_epoch	lag_s	old_values_after_change" > $R
sleep 15
i=0
for w in 5 100 200; do
  i=$((i+1)); sleep $w
  new="rot-value-$DP-$i"
  t0=$(date +%s.%N | cut -c1-14); setsecret "$new"
  seen=""
  for k in $(seq 1 420); do
    seen=$(awk -F'\t' -v n="$new" 'index($2, n){print $1; exit}' $P)
    [ -n "$seen" ] && break
    sleep 1
  done
  if [ -n "$seen" ]; then lag=$(echo "$seen - $t0" | bc -l | xargs printf '%.1f'); else lag="not-seen-in-420s"; seen="-"; fi
  old=$(awk -F'\t' -v t="$t0" -v n="$new" '$1>t && !index($2, n) && $2 ~ /rot-value/' $P | wc -l)
  echo "$i	$w	$t0	$seen	$lag	$old" >> $R
done
sleep 5; touch stop; sleep 2
awk -F'\t' 'NR>1{c[$2]++} END{for(k in c) print c[k], k}' $P | sort -rn > 30-values-seen.txt
kubectl -n ate-system get deploy k8s-credential-provider -o json | jq -c '.spec.template.spec.containers[0].args' > 31-credential-provider-args.json 2>&1
cat $R; cat 30-values-seen.txt
echo "ROTATION-$DP-DONE" >> $R
