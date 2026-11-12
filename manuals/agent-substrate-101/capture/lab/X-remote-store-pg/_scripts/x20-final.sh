. ~/scripts/t-lib.sh
E=~/evidence/X-remote-store-pg; cd $E
for i in $(seq 1 40); do grep -q ALL-STORE-DONE 00-run.log && break; sleep 5; done
rm -f body-*.tmp t0-* ~/x/blob300 ~/x/blob300.back
{
echo "### state left on this guest, $(ts)"
echo "clusters: $(cd ~/x/src && sg docker -c 'hack/kind.sh get clusters' 2>/dev/null | tr '\n' ' ')"
kc get nodes --no-headers | awk '{print $1,$2}'
kc -n ate-system get pods --no-headers | awk '{print $1,$2,$3}'
echo "object-store settings of the plugin:"
for w in ds/atelet deploy/ate-api-server; do kc -n ate-system get $w -o json | jq -r --arg w $w '.spec.template.spec.initContainers[] | select(.name=="objectstore-plugin") | $w + " " + ([.env[] | select(.name=="AWS_ENDPOINT_URL" or .name=="AWS_CA_BUNDLE") | .name + "=" + .value] | join(",")) + " mounts=" + ([.volumeMounts[]?.name] | join(","))'; done
echo "configmap x-store-ca: $(kc -n ate-system get configmap x-store-ca 2>&1 | tail -1 | cut -c1-80)"
echo "atelet args: $(kc -n ate-system get ds atelet -o json | jq -r '.spec.template.spec.containers[] | select(.name=="atelet") | (.args|join(" "))')"
echo "atelet args before the run: $(cat 12-atelet-args-before.txt)"
podsn
K get workers | awk 'NR>1{print $3}' | sort | uniq -c
echo "actors in $S: $(K get actors -a $S | awk 'NR>1' | wc -l)"
K get actor-templates -a $S | awk '{print $1,$2}'
echo "tc ens3: $(sudo tc qdisc show dev ens3 | tr '\n' ';')"
echo "tc bridge: $(for b in $(ip -o link | awk -F': ' '$2 ~ /^br-/{print $2}'); do sudo tc qdisc show dev $b | tr '\n' ';'; done)"
echo "iptables rules that name 10.0.2.2: $(sudo iptables -S | grep -c 10.0.2.2)"
echo "containers: $(sg docker -c "docker ps -a --format '{{.Names}}'" | tr '\n' ' ')"
echo "volumes with x- or t- prefix: $(sg docker -c 'docker volume ls -q' | grep -E '^(x|t)-' | tr '\n' ' ')"
echo "images added in this run: postgres:18-alpine (client), localhost:5001/x-drill:v1"
ls ~/x | tr '\n' ' '; echo
df -h / | tail -1; free -g | sed -n 2p
sysctl fs.inotify.max_user_instances fs.inotify.max_user_watches | tr '\n' ' '; echo
tail -3 10-store-run.log | cut -c1-200
} > 99-state-left.txt 2>&1
cat 99-state-left.txt
