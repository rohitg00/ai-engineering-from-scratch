date -u +%T
tail -n ${1:-90} ~/logs/k17-parallel.sh.log | cut -c1-420
