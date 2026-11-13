# usage: burst.sh <label> <parallel-max> <actor names...>  -> /tmp/burst-<label>.tsv, prints wall seconds
L=$1; P=$2; shift 2
: > /tmp/cfg.$L; first=1
for a in "$@"; do
  [ $first = 1 ] || echo next >> /tmp/cfg.$L
  first=0
  printf 'url = "https://atenet-router.ate-system.svc:443/"\nrequest = POST\nheader = "ate-target-actor: sc-lab/%s"\ncacert = /run/ca/trust-bundle.pem\ncert = /run/id/credential-bundle.pem\nkey = /run/id/credential-bundle.pem\nmax-time = 60\noutput = /dev/null\nwrite-out = "%s\\t%%{http_code}\\t%%{time_total}\\t%%{time_starttransfer}\\t%%{http_version}\\t%%{num_connects}\\n"\n' "$a" "$a" >> /tmp/cfg.$L
done
s=$(cut -d' ' -f1 /proc/uptime)
curl -s -Z --parallel-max $P -K /tmp/cfg.$L > /tmp/burst-$L.tsv 2>/tmp/burst-$L.err
e=$(cut -d' ' -f1 /proc/uptime)
awk -v s=$s -v e=$e 'BEGIN{printf "%.2f\n", e-s}'
