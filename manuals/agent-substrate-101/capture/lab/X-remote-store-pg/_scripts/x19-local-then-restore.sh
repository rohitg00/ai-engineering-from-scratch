bash ~/scripts/x7-local100.sh > ~/logs/x7-local100.log 2>&1
bash ~/scripts/x1-store.sh restore > ~/logs/x1-restore.log 2>&1
echo "$(date -u +%FT%TZ) ALL-STORE-DONE" >> ~/evidence/X-remote-store-pg/00-run.log
