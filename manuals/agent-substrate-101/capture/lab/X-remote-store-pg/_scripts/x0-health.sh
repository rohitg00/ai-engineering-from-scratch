. ~/scripts/t-lib.sh
E=~/evidence/X-remote-store-pg; mkdir -p "$E"; cd "$E"
{
echo "### $(ts) after boot"
uptime
free -g | sed -n 2p
df -h / | tail -1
sg docker -c "docker ps --format '{{.Names}} {{.Status}}'"
sg docker -c "docker ps -a --format '{{.Names}} {{.Status}} {{.Image}}'" | grep -v -E "^(multi|kind)-"
sg docker -c "docker volume ls -q" | head -20
kind get clusters 2>/dev/null
kc get nodes --no-headers
kc -n ate-system get pods --no-headers | awk '{print $1,$2,$3,$4}'
podsn
K get workers
K get actors -a $S | head
K get actor-templates -a $S
echo "endpoints:"
for w in ds/atelet deploy/ate-api-server; do kc -n ate-system get $w -o json | jq -r '.spec.template.spec.initContainers[] | select(.name=="objectstore-plugin") | [.image, (.env[] | select(.name|test("AWS|S3|BUCKET|CA|TLS|SSL")) | .name + "=" + (.value // "<from-secret>"))] | join(" ")'; done
kc -n ate-system get ds atelet -o json | jq -r '.spec.template.spec.containers[] | select(.name=="atelet") | (.args|join(" "))'
ls ~/ballast-t 2>/dev/null | head
du -sh ~/ballast-t 2>/dev/null
ip -o -4 addr | awk '{print $2,$4}'
ip route | head -5
} > 00-health.txt 2>&1
cat 00-health.txt
