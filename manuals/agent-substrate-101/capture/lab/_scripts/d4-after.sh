export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
S=lab-c; cd ~/evidence/D-durability
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
{
date -u +%FT%TZ
echo "== workers (all)"; K get workers
echo "== pool pods"; kubectl get pods -n lab-c -o wide; kubectl get pods -n ate-demo-counter -o wide
echo "== actors"; K get actors -a lab-c; K get actors -a ate-demo-counter
echo "== call r1"; curl -s -m 30 -w ' -> %{http_code} %{time_total}s\n' http://127.0.0.1:8501/
echo "== call my-counter-1 (was RUNNING before the node restart)"
(kubectl ate proxy actor my-counter-1 -a ate-demo-counter 8601:80 > /tmp/p.log 2>&1 &); sleep 4
curl -s -m 30 -X POST -w ' -> %{http_code} %{time_total}s\n' http://127.0.0.1:8601/
K get actor my-counter-1 -a ate-demo-counter
} > 46-after-reboot-followup.txt 2>&1
cut -c1-220 46-after-reboot-followup.txt
