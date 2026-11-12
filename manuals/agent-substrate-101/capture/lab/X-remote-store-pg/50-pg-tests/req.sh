curl -s -m ${2:-20} -o /tmp/r.$$ -w '%{http_code}\t%{time_total}\t' --cacert /run/ca/trust-bundle.pem --cert /run/id/credential-bundle.pem --key /run/id/credential-bundle.pem -X POST -H "ate-target-actor: x-lab/$1" https://atenet-router.ate-system.svc:443/
head -c 140 /tmp/r.$$ | tr '\n\t' '  '; echo; rm -f /tmp/r.$$
