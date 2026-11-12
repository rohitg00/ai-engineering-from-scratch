C="--cacert /run/ca/trust-bundle.pem --cert /run/id/credential-bundle.pem --key /run/id/credential-bundle.pem"
U=https://atenet-router.ate-system.svc:443/
while [ ! -f /tmp/stop ]; do
  t=$(date +%s)
  ( r=$(curl -s -m 9 -o /tmp/b.$t -w '%{http_code}\t%{time_total}' $C -X POST -H 'ate-target-actor: up-lab/a-run' $U); printf '%s\trunning\ta-run\t%s\t%s\n' "$t" "$r" "$(head -c 140 /tmp/b.$t | tr '\n\t' '  ')" >> /tmp/probe.tsv; rm -f /tmp/b.$t ) &
  sleep 1
done
