cd ~/evidence/X-remote-store-pg
awk -F'\t' -v mb="${MB:-all}" 'NR>1 && (mb=="all" || $5==mb){print $2,"rtt="$3,"rate="$4,"mb="$5,"c="$6,"sus="$7,"det="$9,"local="$10,"first="$11"/"$12,"tries="$13,"to200="$14,substr($15,1,22),"|",$16}' 22-store-cycles.tsv | tail -${N:-30}
tail -${L:-4} 10-store-run.log | cut -c1-210
tail -2 00-run.log | cut -c1-80
