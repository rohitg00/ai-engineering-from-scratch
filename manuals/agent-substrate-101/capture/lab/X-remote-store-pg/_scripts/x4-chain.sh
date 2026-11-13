cd ~/evidence/X-remote-store-pg
. ~/scripts/x1-store.sh none
log "restart of the cycles with retry-until-200 logic; rows so far are in 20-store-cycles.tsv"
shape 0 0
delall
for ph in ${PHASES:-plain rtt100 rate}; do bash ~/scripts/x1-store.sh $ph > ~/logs/x1-$ph.log 2>&1; done
echo "$(date -u +%FT%TZ) CHAIN-${PHASES:-plain-rtt100-rate}-DONE" >> 00-run.log
