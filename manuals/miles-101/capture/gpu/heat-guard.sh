#!/bin/sh
L="$HOME/miles-lab/runs/thermostat.log"
DONE="$HOME/miles-lab/queue2.done"
paused=0
c=
pc=
release() {
  if [ "$paused" = 1 ] && [ -n "$pc" ] && docker unpause "$pc" >/dev/null; then
    echo "$(date -u +%FT%TZ) resume on exit after $(( $(date +%s) - since )) s" >> "$L"
  fi
  paused=0
}
trap 'release; exit 1' INT TERM HUP
while [ ! -f "$DONE" ]; do
  t=$(nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits | head -1)
  if [ "$paused" = 1 ]; then
    if found=$(docker ps -q --filter "id=$pc"); then
      if [ -z "$found" ]; then paused=0
      elif { [ "$t" -le 74 ] && [ $(( $(date +%s) - since )) -ge 45 ]; } || [ $(( $(date +%s) - since )) -ge 120 ]; then docker unpause "$pc" >/dev/null && paused=0 && echo "$(date -u +%FT%TZ) resume at ${t}C after $(( $(date +%s) - since )) s" >> "$L"
      fi
    fi
  else
    c=$(docker ps -q --filter ancestor=radixark/miles:latest --filter status=running | head -1)
    if [ -n "$c" ] && [ "$t" -ge 84 ]; then docker pause "$c" >/dev/null && pc=$c && paused=1 && since=$(date +%s) && echo "$(date -u +%FT%TZ) pause at ${t}C" >> "$L"
    fi
  fi
  sleep 5
done
release
