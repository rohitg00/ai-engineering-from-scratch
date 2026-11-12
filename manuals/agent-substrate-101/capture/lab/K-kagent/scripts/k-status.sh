E=~/evidence/K-kagent/install
date -u +%T
cat "$E/steps.tsv"
last=$(ls -t "$E" | grep -E '^[0-9]+-.*log$' | head -1)
echo "--- tail $last"
tail -n ${1:-25} "$E/$last" | cut -c1-240
df -h / | tail -1
