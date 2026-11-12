. ~/scripts/x-pglib.sh
O=$EV/40-pg-install; mkdir -p $O
[ -d $X/src ] || git clone -q --branch v1.0.0 ~/substrate $X/src 2>&1 | tail -1
cd $X/src
{ df -h / | tail -1; free -g | sed -n 2p; } > $O/00-guest-before.txt
sg docker -c "docker pull -q postgres:18-alpine" > $O/01-client-image.log 2>&1
pgc_start
{
  echo "### path to Postgres on the other guest, $(date -u +%FT%TZ)"
  for i in 1 2 3 4 5; do pgc "pg_isready -h $PGHOST_IP -p $PGPORT_N -d atepg"; done
  pgc "PGPASSWORD=\$POSTGRES_PASSWORD psql \"$ADMIN\" -Atc \"select version()\" -c \"select ssl, version, cipher from pg_stat_ssl where pid = pg_backend_pid()\""
} > $O/10-pg-reach.txt 2>&1
kubectl get nodes >/dev/null 2>&1 || step 20-kind-cluster "hack/create-kind-cluster.sh" || { echo FAIL kind; tail -5 $O/20-kind-cluster.log; exit 1; }
echo "setup.sql run from this guest over TLS with --single-transaction" > $O/30-pg-setup.log
pgc "PGPASSWORD=\$POSTGRES_PASSWORD psql \"$ADMIN\" --no-psqlrc --single-transaction --set=ON_ERROR_STOP=1 -v substrate_schema=substrate -v substrate_owner_role=substrate_owner -v substrate_owner_user=substrate_owner_user -v substrate_owner_password=\$PGOWN -v substrate_readwrite_role=substrate_readwrite -v substrate_readwrite_user=substrate_readwrite_user -v substrate_readwrite_password=\$PGRW -f /setup.sql" 2>&1 | scrub >> $O/30-pg-setup.log
echo "setup.sql rc=${PIPESTATUS[0]}" >> $O/30-pg-setup.log
pgc "PGPASSWORD=\$POSTGRES_PASSWORD psql \"$ADMIN\" -c \"\\du\" -c \"\\dn+\"" >> $O/30-pg-setup.log 2>&1
. $X/pg.env
Q="sslmode=verify-full&sslrootcert=/run/postgres-server-ca/server-ca.pem"
export ATE_API_POSTGRES_READ_WRITE_CONNECTION_STRING="postgresql://substrate_readwrite_user:$PGRW@$PGHOST_IP:$PGPORT_N/atepg?$Q"
export ATE_API_POSTGRES_OWNER_CONNECTION_STRING="postgresql://substrate_owner_user:$PGOWN@$PGHOST_IP:$PGPORT_N/atepg?$Q"
echo "deploy settings for Postgres on the other guest: env ATE_API_POSTGRES_READ_WRITE_CONNECTION_STRING, ATE_API_POSTGRES_OWNER_CONNECTION_STRING (postgresql://<user>:<password>@$PGHOST_IP:$PGPORT_N/atepg?$Q) and --ateapi-postgres-server-ca-file" > $O/39-deploy-diff.txt
step 40-deploy-ate-system "go run ./cmd/ate-setup deploy ate-system --credential-provider='{\"name\":\"k8s.io\"}' --ingress-allowed-spiffe-ids=spiffe://cluster.local/ns/ate-system/sa/atenet-client --image-repo ghcr.io/agent-substrate/substrate --image-tag v1.0.0 --ateapi-postgres-server-ca-file $X/tls/ca.crt"
rc=$?
scrub < $O/40-deploy-ate-system.log > $O/40.tmp && mv $O/40.tmp $O/40-deploy-ate-system.log
kubectl get pods -A -o wide > $O/50-pods.txt 2>&1
kubectl -n ate-system get sts,deploy,ds,svc,networkpolicy > $O/51-ate-system-objects.txt 2>&1
kubectl -n ate-system logs deploy/ate-api-server --tail=60 2>&1 | scrub > $O/52-api-server-log.txt
pgc "PGPASSWORD=\$POSTGRES_PASSWORD psql \"$ADMIN\" -c \"select usename, ssl, version, cipher, client_addr from pg_stat_ssl join pg_stat_activity using (pid) where usename like 'substrate%'\" -c \"\\dt substrate.*\"" > $O/53-pg-connections-and-tables.txt 2>&1
scrub < $ATE_RECORD_DIR/installs/kind-xpg.yaml > $O/55-install-record.yaml 2>/dev/null
{ df -h / | tail -1; free -g | sed -n 2p; } > $O/56-guest-after.txt
echo "DONE rc=$rc" >> $O/steps.tsv
cat $O/steps.tsv; tail -3 $O/30-pg-setup.log; kubectl -n ate-system get pods --no-headers | awk '{print $1,$2,$3}'
