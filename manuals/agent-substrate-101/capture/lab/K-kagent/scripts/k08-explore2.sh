E=~/evidence/K-kagent/agent; cd "$E"
A() { sg docker -c "kubectl ate $*"; }
P() { sg docker -c "kubectl -n kagent exec deploy/kagent-postgresql -c postgresql -- psql -U postgres -d kagent -At -F '|' -c \"$1\"" 2>&1; }
s=$(date +%s.%N); A get atespace 2>&1 | head -5; e=$(date +%s.%N); echo "kubectl-ate call took $(echo "$e - $s" | bc)s"
A get actor-template -a kagent 2>&1 | cut -c1-220
A get actor -a kagent 2>&1 | cut -c1-220
A get worker 2>&1 | cut -c1-220
echo ---tables
P "select table_schema, table_name from information_schema.tables where table_schema in ('substrate','kagent') order by 1,2" | paste -sd' ' - | fold -w 220
echo ---actors cols
P "select column_name, data_type from information_schema.columns where table_schema='substrate' and table_name='actors' order by ordinal_position" | paste -sd' ' - | fold -w 220
P "select count(*) from substrate.actors"
echo ---kagent session cols
P "select table_name, column_name from information_schema.columns where table_schema='kagent' and table_name like '%session%' order by 1, ordinal_position" | paste -sd' ' - | fold -w 220
ss -ltnp 2>/dev/null | grep -E ":8083" | cut -c1-140
docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | cut -c1-200
sg docker -c "docker ps --format '{{.Names}} {{.Ports}}'" | cut -c1-200
