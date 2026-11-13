. ~/scripts/t-lib.sh
cd ~/evidence/X-remote-store-pg
for t in xb-0 xb-200 xb-1000; do K delete actor-template $t -a $S 2>&1 | tail -1 | cut -c1-120; done
sg docker -c "docker rmi postgres:18-alpine" > /dev/null 2>&1
sudo rm -rf ~/x
sudo fstrim / 2>/dev/null
{ echo; echo "### after the last clean-up, $(ts)"; echo "templates: $(K get actor-templates -a $S | awk 'NR>1{print $2}' | tr '\n' ' ')"; echo "folder ~/x removed (lab CA, keys, database passwords, source clone): $(ls -d ~/x 2>&1 | cut -c1-60)"; echo "postgres client image removed: $(sg docker -c 'docker images -q postgres:18-alpine' | wc -l) left"; df -h / | tail -1; } >> 99-state-left.txt
tail -5 99-state-left.txt
