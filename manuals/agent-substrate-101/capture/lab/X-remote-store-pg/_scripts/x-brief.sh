cd ~/evidence/X-remote-store-pg
date -u +%T; tail -3 00-run.log 2>/dev/null | cut -c1-110; tail -${N:-6} 10-store-run.log 2>/dev/null | cut -c1-230
for f in "$@"; do [ -f "$f" ] || continue; echo "--- $f"; tail -${M:-12} "$f" | cut -c1-${W:-260}; done
free -g | sed -n 2p | awk '{print "guest mem avail GB", $7}'; df -h / | awk 'NR==2{print "guest disk free", $4}'
pgrep -af "scripts/x[0-9]" | cut -c1-80
