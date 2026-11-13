. ~/scripts/x-pglib.sh
S=x-lab
for a in $(K get actors -a $S | awk 'NR>1 && $4=="ACTOR_STATE_RUNNING"{print $2}'); do K suspend actor $a -a $S > /dev/null 2>&1; done
K get actors -a $S | awk 'NR>1{print $4}' | sort | uniq -c
K get workers | awk 'NR>1{print $3}' | sort | uniq -c
