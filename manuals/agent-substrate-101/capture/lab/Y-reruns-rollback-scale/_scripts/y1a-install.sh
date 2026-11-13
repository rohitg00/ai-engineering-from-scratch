. ~/scripts/y-lib.sh
O=$EV/00-boot; mkdir -p $O
{
echo "inotify after fix: $(sysctl -n fs.inotify.max_user_instances) $(sysctl -n fs.inotify.max_user_watches)"
echo "== disk before"; df -h / | tail -1
echo "== old source-built cluster after the reboot"
KUBECONFIG=~/.kube/config kubectl get pods -A --no-headers 2>&1 | awk '{print $4}' | sort | uniq -c
echo "== delete uscale"
cd $U/x && KUBECONFIG=$U/kc-uscale sg docker -c "hack/kind.sh delete cluster --name uscale" 2>&1 | tail -3
sg docker -c "docker volume prune -f" 2>&1 | tail -1
rm -rf $U/x $U/kc-uscale $U/kc-uext $U/kc-uupg $U/ate-upgrade $U/img2/*.tar 2>/dev/null
echo "== disk after"; df -h / | tail -1
} > $O/00-boot.txt 2>&1
O=$EV/10-outages/00-install; mkdir -p $O; : > $O/steps.tsv
install_release new v1.0.0 yout
cat $O/steps.tsv
kubectl get pods -A --no-headers | awk '{print $4}' | sort | uniq -c
df -h / | tail -1
