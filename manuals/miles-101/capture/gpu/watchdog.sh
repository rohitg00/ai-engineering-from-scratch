#!/bin/sh
name=${1:-miles-plain}
limit=${2:-100}
checks=${3:-10}
for value in "$limit" "$checks"; do
  case $value in
    ''|*[!0-9]*|??????????*) echo "limit and checks must be whole numbers below one billion"; exit 2;;
  esac
done
if [ "$checks" -lt 1 ]; then
  echo "checks must be 1 or more"
  exit 2
fi
strikes=0
while :; do
  if ! running=$(docker ps -q --filter "name=^${name}$"); then
    echo "$(date -u +%FT%TZ) $name: docker ps failed, the watchdog cannot see the run and stops"
    exit 2
  fi
  [ -n "$running" ] || break
  if logs=$(docker logs --since 60s "$name" 2>&1); then
    errors=$(printf '%s\n' "$logs" | grep -c "503 Service Unavailable")
    if [ "$errors" -gt "$limit" ]; then
      strikes=$((strikes + 1))
    else
      strikes=0
    fi
  else
    echo "$(date -u +%FT%TZ) $name: docker logs failed, this check does not count"
  fi
  if [ "$strikes" -ge "$checks" ]; then
    echo "$(date -u +%FT%TZ) $name: more than $limit errors from the rollout engine in each of $checks checks, last $errors in 60 s, stopping the run"
    docker stop "$name"
    exit 1
  fi
  sleep 30
done
echo "$(date -u +%FT%TZ) $name: the run ended"
