L=$1; PROCS=$2; HTTP=$3; shift 3
rm -f /tmp/cfg.$L.* /tmp/burst-$L.*
i=0
for a in "$@"; do
  f=/tmp/cfg.$L.$((i % PROCS))
  [ -s $f ] && echo next >> $f
  printf 'url = "https://atenet-router.ate-system.svc:443/"\nrequest = POST\nheader = "ate-target-actor: sc-lab/%s"\ncacert = /run/ca/trust-bundle.pem\ncert = /run/id/credential-bundle.pem\nkey = /run/id/credential-bundle.pem\nmax-time = 90\noutput = /dev/null\nwrite-out = "%s\\t%%{http_code}\\t%%{time_total}\\t%%{time_starttransfer}\\t%%{http_version}\\t%%{num_connects}\\n"\n' "$a" "$a" >> $f
  i=$((i+1))
done
X=""; [ "$HTTP" = h1 ] && X="--http1.1"
s=$(cut -d' ' -f1 /proc/uptime)
for p in $(seq 0 $((PROCS-1))); do
  [ -s /tmp/cfg.$L.$p ] && curl -s -Z --parallel-immediate --parallel-max 300 $X -K /tmp/cfg.$L.$p > /tmp/burst-$L.$p 2>/tmp/burst-$L.err.$p &
done
wait
e=$(cut -d' ' -f1 /proc/uptime)
cat /tmp/burst-$L.[0-9]* > /tmp/burst-$L.tsv
awk -v s=$s -v e=$e 'BEGIN{printf "%.2f\n", e-s}'
