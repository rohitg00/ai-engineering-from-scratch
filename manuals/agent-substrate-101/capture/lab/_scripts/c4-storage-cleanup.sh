export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
E=~/evidence/C-resume-vs-size; cd "$E"
S=lab-c
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
{
echo "== node: /var/lib/ate"
sg docker -c "docker exec kind-control-plane sh -c 'du -sm /var/lib/ate/* 2>/dev/null | sort -n'"
echo "== node: snapshots per actor uid (MiB)"
sg docker -c "docker exec kind-control-plane sh -c 'du -sm /var/lib/ate/snapshots/* | sort -n | tail -30'"
echo "== rustfs pod data"
RP=$(kubectl -n ate-system get pod -l app=rustfs -o name | head -1)
kubectl -n ate-system exec $RP -- sh -c 'df -h 2>/dev/null | grep -v -E "tmpfs|shm|overlay" | head; du -sm /data 2>/dev/null; du -sm /data/* 2>/dev/null | sort -n | tail -5' 2>&1
echo "== kind node disk"
sg docker -c "docker exec kind-control-plane df -h /var/lib/ate /var/lib/containerd" 2>&1
echo "== actors"
K get actors -a $S
} > 20-storage-footprint.txt 2>&1
K get actor b1000-1 -a $S -o yaml > 21-actor-b1000-1.yaml
K get actor b500-2 -a $S -o yaml > 21-actor-b500-2.yaml
pkill -f "proxy actor b"
for a in $(K get actors -a $S -o json | jq -r '.. | objects | select(.metadata.atespace? == "lab-c" and .actorTemplate? != null) | .metadata.name' | sort -u); do
  s=$(date +%s.%N); K delete actor $a -a $S > /dev/null; echo "delete $a $(echo "$(date +%s.%N) - $s" | bc -l)"
done > 22-delete-actors.log 2>&1
sleep 20
{
echo "== after delete: node snapshots"
sg docker -c "docker exec kind-control-plane sh -c 'du -sm /var/lib/ate/* | sort -n'"
RP=$(kubectl -n ate-system get pod -l app=rustfs -o name | head -1)
kubectl -n ate-system exec $RP -- sh -c 'du -sm /data' 2>&1
} > 23-storage-after-delete.txt 2>&1
sudo fstrim -v /
df -h / | tail -1
cat 20-storage-footprint.txt | cut -c1-150
echo; cat 23-storage-after-delete.txt
