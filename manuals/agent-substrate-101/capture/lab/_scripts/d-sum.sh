cd ~/evidence/D-durability
tail -1 10-watch.tsv
grep -E "first-call|second-call|suspended-async|resume-after-detach|warm" 10-watch.tsv | cut -c1-230
echo "== transitions per actor (first time each distinct status string seen)"
awk -F'\t' '$3=="state"{k=$2 FS $4 FS $5 FS $6; if(!(k in seen)){seen[k]=1; print $1, $2, $4, $5, $6}}' 10-watch.tsv | cut -c1-230
echo "== node local snapshot MiB over time"
grep local-snapshots 10-watch.tsv | awk -F'\t' '{print $1, $4}' | awk 'NR==1||NR%4==0' | head -14
