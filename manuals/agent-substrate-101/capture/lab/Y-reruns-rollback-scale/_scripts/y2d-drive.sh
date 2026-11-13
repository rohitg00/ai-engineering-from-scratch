. ~/scripts/y-lib.sh
O=$EV/10-outages/90-teardown; mkdir -p $O
usecluster yout
kubectl get pods -A -o wide > $O/00-pods-before-delete.txt 2>&1
cd $U/new && sg docker -c "hack/kind.sh delete cluster --name yout" > $O/01-delete.log 2>&1
sg docker -c "docker volume prune -f" >> $O/01-delete.log 2>&1
df -h / | tail -1 >> $O/01-delete.log
cd ~/scripts
bash y2a-install.sh > ~/logs/y2a.log 2>&1
bash y2b-actors.sh > ~/logs/y2b.log 2>&1
bash y2c-upgrade.sh upgrade > ~/logs/y2c-up.log 2>&1
sleep 20
bash y2c-upgrade.sh rollback > ~/logs/y2c-rb.log 2>&1
echo ALL-DONE
