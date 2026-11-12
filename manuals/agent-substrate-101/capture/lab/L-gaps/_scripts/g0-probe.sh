export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
mkdir -p ~/evidence/L-gaps/microvm ~/evidence/L-gaps/multinode ~/evidence/L-gaps/restart
cd ~/substrate
echo "== kind config"; cat bin/kind-config.yaml | head -30
echo "== kvm in node"; sg docker -c "docker exec kind-control-plane ls -la /dev/kvm" 2>&1
echo "== sandboxconfigs"; kubectl get sandboxconfigs -o wide 2>&1
kubectl get sandboxconfigs -o yaml 2>&1 | grep -v -E "^\s*(creationTimestamp|resourceVersion|uid|generation):" | head -80
echo "== runtimeclass"; kubectl get runtimeclass 2>&1
echo "== node ate dirs"; sg docker -c "docker exec kind-control-plane sh -c 'ls /var/lib/ate/sandbox-asset-cache | head; ls /opt 2>/dev/null | head; which kata-runtime cloud-hypervisor containerd-shim-kata-v2 2>&1 | head'"
echo "== microvm in docs"; grep -n -i -A25 "Running on microVM" demos/counter/README.md | cut -c1-220 | head -70
echo "== templates microvm"; grep -v -E '^\s*#|^\s*$' demos/counter/counter-microvm.yaml.tmpl; grep -v -E '^\s*#|^\s*$' demos/counter/counter-microvm-template.yaml.tmpl
echo "== ate-setup sandbox flags"; grep -n -i -E "sandbox-classes|microvm" cmd/ate-setup/commands.md | cut -c1-220 | head -20
echo "== state"; kubectl ate get workers 2>&1 | grep -v Warning; kubectl ate get actors -a lab-c 2>&1 | grep -v Warning; df -h / | tail -1; free -g | sed -n 2p
