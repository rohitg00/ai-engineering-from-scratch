mkdir -p ~/x/tls && cd ~/x/tls
if [ ! -f ca.crt ]; then
  umask 077
  openssl req -x509 -newkey rsa:2048 -nodes -days 30 -keyout ca.key -out ca.crt -subj "/CN=x-lab-ca" 2>/dev/null
  for n in store pg; do
    openssl req -newkey rsa:2048 -nodes -keyout $n.key -out $n.csr -subj "/CN=x-$n" 2>/dev/null
    printf 'subjectAltName=IP:10.0.2.2,DNS:x-%s\n' $n > $n.cnf
    openssl x509 -req -in $n.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 30 -extfile $n.cnf -out $n.crt 2>/dev/null
  done
  umask 022; chmod 644 ca.crt
fi
ls ~/x/tls | tr '\n' ' '
openssl x509 -in store.crt -noout -subject -ext subjectAltName 2>/dev/null | tr '\n' ' '
cd ~/evidence/X-remote-store-pg
. ~/scripts/x1-store.sh none


for ph in plain rtt100 rate; do bash ~/scripts/x1-store.sh $ph > ~/logs/x1-$ph.log 2>&1; done
echo "$(date -u +%FT%TZ) CHAIN1-DONE" >> 00-run.log
