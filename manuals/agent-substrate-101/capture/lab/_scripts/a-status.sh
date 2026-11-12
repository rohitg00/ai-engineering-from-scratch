E=~/evidence/A-quickstart
date -u +%T
cat "$E/02-steps.tsv"
last=$(ls -t "$E" | grep -E '^[0-9]+-' | head -1)
echo "--- tail $last"
tail -n ${1:-8} "$E/$last" | cut -c1-220
echo "--- procs"
ps -eo etimes,pcpu,cmd --sort=-pcpu | grep -E 'ko |go |ate-setup|kubectl|docker build|buildx' | grep -v grep | cut -c1-140 | head -6
df -h / | tail -1
