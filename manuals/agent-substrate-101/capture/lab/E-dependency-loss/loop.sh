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
