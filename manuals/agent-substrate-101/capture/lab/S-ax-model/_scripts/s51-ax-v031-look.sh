cd ~/ax
E=~/evidence/S-ax-model/50-ax-v031; mkdir -p $E
[ -d ~/ax-v031 ] || git worktree add ~/ax-v031 v0.3.1 > $E/07-worktree.log 2>&1
cd ~/ax-v031
ls; ls deploy cmd
echo "== server yaml"; grep -v "^#" deploy/ax-server.yaml | head -90
echo "== controller yaml"; grep -v "^#" deploy/ax-controller.yaml | head -80
echo "== redis"; grep -v "^#" deploy/redis.yaml 2>/dev/null | grep -n -E "kind:|image:|name:" | head
echo "== README install"; grep -n -i -B2 -A30 -E "^## .*(install|quick|getting)" README.md | head -90
echo "== ate api import"; grep -rn "ateapi\|substrate/" --include=*.go internal cmd | grep import -A0 | head -5; grep -rhn "agent-substrate/substrate/" --include=*.go . | sed 's/.*"\(.*\)".*/\1/' | sort | uniq -c
