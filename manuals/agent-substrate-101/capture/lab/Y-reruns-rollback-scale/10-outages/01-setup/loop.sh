C="--cacert /run/ca/trust-bundle.pem --cert /run/id/credential-bundle.pem --key /run/id/credential-bundle.pem"
U=https://atenet-router.ate-system.svc:443/
P=$1
i=0; n=0
one() { ( r=$(curl -s -m $4 -o /tmp/$1.$2.$3 -w '%{http_code}\t%{time_total}' $C -X POST -H "ate-target-actor: y-lab/$2" $U); printf '%s\t%s\t%s\t%s\t%s\n' "$3" "$1" "$2" "$r" "$(head -c 140 /tmp/$1.$2.$3 | tr '\n\t' '  ')" >> /tmp/probe.tsv; rm -f /tmp/$1.$2.$3 ) & }
while [ ! -f /tmp/stop ]; do
  t=$(date +%s)
  one running y-run $t 9
  one running2 y-r1 $t 9
  one running2 y-r2 $t 9
  if [ $((i % 5)) -eq 0 ]; then
    n=$((n+1)); one suspended $(printf '%s-s-%03d' $P $n) $t 14
  fi
  i=$((i+1)); sleep 1
done
