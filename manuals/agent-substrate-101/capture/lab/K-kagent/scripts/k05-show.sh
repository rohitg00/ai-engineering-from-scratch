E=~/evidence/K-kagent/inventory; cd "$E"
cat kagent-cli-help.txt | cut -c1-200
echo ==== MODELCONFIG
sg docker -c "kubectl -n kagent get modelconfig default-model-config -o yaml" | sed -n '/^spec:/,$p'
echo ==== WORKERPOOL
sed -n '/spec:/,/status:/p' workerpools.yaml | head -60
echo ==== atelet args
grep -n -A30 'args:' ds-atelet.yaml | grep -E '^\S*\s+- ' | head -30
echo ==== ateapi args
grep -n -E '^\s+- --' deploy-ate-api-server.yaml | head -40
echo ==== agw
grep -n -E 'image:|^\s+- --|name: RUST_LOG|value:|containerPort|mountPath' deploy-atenet-router.yaml | head -40
echo ==== docs verify/next
sed -n '472,545p' ~/evidence/K-kagent/docs/setup_installation.md | cut -c1-300
