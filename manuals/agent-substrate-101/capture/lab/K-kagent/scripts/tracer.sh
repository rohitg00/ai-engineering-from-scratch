#!/bin/bash
# usage: tracer.sh <outfile> <stopfile>   polls the actor list, logs every change with a UTC timestamp
out="$1"; stop="$2"; prev=""
while [ ! -f "$stop" ]; do
  ts=$(date -u +%FT%T.%3NZ)
  cur=$(kubectl ate get actor -a kagent -o json 2>/dev/null | jq -c '[.actors[]? | {n:.metadata.name, v:.metadata.version, st:(.status | del(.snapshots)), snaps:[.status.snapshots[]? | {o:.owner, g:.generation, f:.fidelity, loc:.locality, d:(.durableSnapshot.state // null)}]}]' 2>/dev/null)
  if [ -n "$cur" ] && [ "$cur" != "$prev" ]; then
    echo "$ts $cur" >> "$out"
    prev="$cur"
  fi
  sleep 0.1
done
