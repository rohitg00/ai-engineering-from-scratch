C="--cacert /run/ca/trust-bundle.pem --cert /run/id/credential-bundle.pem --key /run/id/credential-bundle.pem"
U=https://atenet-router.ate-system.svc:443/
while [ ! -f /tmp/stop ]; do
  t=$(date +%s)
  for a in a-run a-term; do
    ( r=$(curl -s -m 9 -o /tmp/b.$a.$t -w '%{http_code}\t%{time_total}' $C -X POST -H "ate-target-actor: up-lab/$a" $U); printf '%s\trunning\t%s\t%s\t%s\n' "$t" "$a" "$r" "$(head -c 140 /tmp/b.$a.$t | tr '\n\t' '  ')" >> /tmp/probe.tsv; rm -f /tmp/b.$a.$t ) &
  done
  sleep 1
done
