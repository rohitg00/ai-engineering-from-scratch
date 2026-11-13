cd ~/evidence/K-kagent/docs
grep -n -E '^#{1,4} ' setup_installation.md
echo ======
awk 'NR<=150' setup_installation.md | cut -c1-400
