. ~/scripts/t-lib.sh
E=~/evidence/X-remote-store-pg; mkdir -p "$E"; cd "$E"
for i in $(seq 1 60); do
  bad=$(kc -n ate-system get pods --no-headers | grep -v Completed | awk '{split($2,a,"/"); if (a[1]!=a[2]) print $1}' | wc -l)
  [ "$bad" = 0 ] && break
  sleep 5
done
{
echo "### $(ts) waited $((i*5)) s, pods not ready: $bad"
kc -n ate-system get pods --no-headers | awk '{print $1,$2,$3,$4}'
K get workers
K get actors -a $S | head -5
K get actor-templates -a $S
} > 01-health-after-wait.txt 2>&1
cat 01-health-after-wait.txt
K create actor xchk -a $S --template tb-50 > /dev/null; proxy xchk 9990
echo "check: $(call 9990 60) | $(st xchk | cut -f1,2)" | tee -a 01-health-after-wait.txt
s0=$(now); K suspend actor xchk -a $S --mode sync | tail -1; echo "sync suspend $(el $s0) s: $(st xchk)" | tee -a 01-health-after-wait.txt
echo "resume: $(call 9990 60)" | tee -a 01-health-after-wait.txt
K suspend actor xchk -a $S --mode sync > /dev/null; K delete actor xchk -a $S > /dev/null; pkill -f "proxy actor xchk "
echo "tcp to 10.0.2.2:19000 from guest: $(timeout 5 bash -c '</dev/tcp/10.0.2.2/19000' 2>&1 && echo open || echo closed-or-refused)" | tee -a 01-health-after-wait.txt
echo "tcp to 10.0.2.2:2223 (a forward to the other guest) from guest: $(timeout 5 bash -c '</dev/tcp/10.0.2.2/2223' 2>&1 && echo open || echo closed)" | tee -a 01-health-after-wait.txt
echo "from a kind node: $(sg docker -c "docker exec $O bash -c 'timeout 5 bash -c \"</dev/tcp/10.0.2.2/2223\" && echo open || echo closed'" 2>&1)" | tee -a 01-health-after-wait.txt
sg docker -c "docker images --format '{{.Repository}}:{{.Tag}} {{.Size}}'" | grep -E "rustfs|aws-cli|postgres" | tee -a 01-health-after-wait.txt
