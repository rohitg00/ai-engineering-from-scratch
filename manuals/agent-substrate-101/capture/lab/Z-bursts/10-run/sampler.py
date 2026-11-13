import os, sys, time
INT = {'ateapi', 'atelet', 'envoy', 'postgres', 'kube-apiserver', 'etcd', 'kubelet', 'containerd', 'atenet', 'ate-controller', 'rustfs', 'containerd-shim', 'ateworker-gviso', 'curl'}
hz = os.sysconf('SC_CLK_TCK')
out = open(sys.argv[1], 'w')
out.write('t\tname\tcores\tmax_thread_cores\n')
def snap():
    procs, threads = {}, {}
    for p in os.listdir('/proc'):
        if not p.isdigit():
            continue
        try:
            s = open(f'/proc/{p}/stat').read()
            comm = s[s.index('(') + 1:s.rindex(')')]
            f = s[s.rindex(')') + 2:].split()
            procs[comm] = procs.get(comm, 0) + int(f[11]) + int(f[12])
            if comm in INT or comm.startswith('kube-'):
                for t in os.listdir(f'/proc/{p}/task'):
                    try:
                        s2 = open(f'/proc/{p}/task/{t}/stat').read()
                        g = s2[s2.rindex(')') + 2:].split()
                        threads[(comm, p, t)] = int(g[11]) + int(g[12])
                    except Exception:
                        pass
        except Exception:
            pass
    tot = [int(x) for x in open('/proc/stat').readline().split()[1:]]
    return time.time(), tot, procs, threads
prev = snap()
end = time.time() + float(sys.argv[2])
while time.time() < end and not os.path.exists(sys.argv[1] + '.stop'):
    time.sleep(1)
    cur = snap()
    dt = cur[0] - prev[0]
    tot = [b - a for a, b in zip(prev[1], cur[1])]
    busy = sum(tot) - tot[3] - tot[4]
    out.write(f'{cur[0]:.2f}\tNODE_BUSY\t{busy / hz / dt:.2f}\t\n')
    out.write(f'{cur[0]:.2f}\tNODE_IOWAIT\t{tot[4] / hz / dt:.2f}\t\n')
    mt = {}
    for k, v in cur[3].items():
        if k in prev[3]:
            mt[k[0]] = max(mt.get(k[0], 0), (v - prev[3][k]) / hz / dt)
    d = {k: (v - prev[2].get(k, 0)) / hz / dt for k, v in cur[2].items()}
    for k, v in sorted(d.items(), key=lambda x: -x[1]):
        if v >= 0.05 or k in INT:
            m = f'{mt[k]:.2f}' if k in mt else ''
            out.write(f'{cur[0]:.2f}\t{k}\t{v:.2f}\t{m}\n')
    out.flush()
    prev = cur
