import csv, datetime, json, re, statistics as st, sys, os, collections

os.chdir(os.path.expanduser("~/evidence/S-ax-model/20-kagent/loop"))


def ts(s):
    s = s.rstrip("Z")
    a, _, b = s.partition(".")
    return datetime.datetime.strptime(a, "%Y-%m-%dT%H:%M:%S").timestamp() + float("0." + (b or "0"))


def godur(s):
    total = 0.0
    for v, u in re.findall(r"([0-9.]+)(h|ms|µs|us|ns|m|s)", s):
        total += float(v) * {"h": 3600, "m": 60, "s": 1, "ms": 1e-3, "µs": 1e-6, "us": 1e-6, "ns": 1e-9}[u]
    return total


turns = []
for r in csv.reader(open("timings.tsv"), delimiter="\t"):
    if r[1] == "session-create":
        continue
    end = ts(r[0]); dur = float(r[3])
    turns.append({"name": r[1], "sid": r[2], "start": end - dur, "end": end, "wall": dur, "rc": r[4], "state": r[5], "model": [], "resume": [], "suspend": []})

calls = []
for l in open("ollama.log", errors="replace"):
    m = re.match(r"(\S+) \[GIN\] .*\| +(\d+) \| +([0-9.a-zµ]+) \|.*POST +\"/v1/chat/completions\"", l)
    if m:
        calls.append((ts(m.group(1)), godur(m.group(3)), int(m.group(2))))
aborted = [(t, d, c) for t, d, c in calls if c != 200]
for t, d, code in calls:
    if code != 200:
        continue
    for u in turns:
        if u["start"] - 0.5 <= t <= u["end"] + 0.5:
            u["model"].append(d)
            break

for l in open("ate-api.log", errors="replace"):
    if "ResumeActor" not in l and "SuspendActor" not in l:
        continue
    try:
        d = json.loads(l)
    except Exception:
        continue
    name = d.get("req", {}).get("actor", {}).get("name", "")
    t = ts(d["time"]); e = godur(d.get("elapsed-time", "0s"))
    kind = "resume" if d["method"].endswith("ResumeActor") else "suspend"
    for u in turns:
        if name == "session-" + u["sid"] and u["start"] - 1.0 <= t <= u["end"] + 6.0:
            u[kind].append(e)
            break

with open("per-turn.tsv", "w") as f:
    f.write("turn\twall_s\tstate\tmodel_calls\tmodel_s\tresume_s\tsuspend_s\trest_s\tanswer_has_number\n")
    for u in turns:
        try:
            out = open(u["name"] + ".out").read()
        except Exception:
            out = ""
        u["ok"] = bool(re.search(r"\d+\.\d+", out))
        u["model_s"] = sum(u["model"]); u["resume_s"] = sum(u["resume"]); u["suspend_s"] = sum(u["suspend"])
        u["rest"] = u["wall"] - u["model_s"] - u["resume_s"]
        f.write(f"{u['name']}\t{u['wall']:.3f}\t{u['state']}\t{len(u['model'])}\t{u['model_s']:.3f}\t{u['resume_s']:.3f}\t{u['suspend_s']:.3f}\t{u['rest']:.3f}\t{int(u['ok'])}\n")

g = collections.defaultdict(list)
for u in turns:
    g[u["name"].rsplit("-", 1)[0]].append(u)


def q(v):
    v = sorted(v)
    return f"median {st.median(v):.3f} (min {v[0]:.3f}, max {v[-1]:.3f})"


with open("summary.txt", "w") as f:
    for k, us in g.items():
        f.write(f"== {k}: n={len(us)} completed={sum(1 for u in us if u['state']=='TASK_STATE_COMPLETED')} answer_has_number={sum(u['ok'] for u in us)}\n")
        f.write(f"  wall_s      {q([u['wall'] for u in us])}\n")
        f.write(f"  model_s     {q([u['model_s'] for u in us])}\n")
        f.write(f"  model_calls {collections.Counter(len(u['model']) for u in us)}\n")
        f.write(f"  resume_s    {q([u['resume_s'] for u in us])}  (turns with a resume record: {sum(1 for u in us if u['resume'])})\n")
        f.write(f"  suspend_s   {q([u['suspend_s'] for u in us])}  (turns with a suspend record: {sum(1 for u in us if u['suspend'])})\n")
        f.write(f"  rest_s      {q([u['rest'] for u in us])}\n")
        share = [u['model_s'] / u['wall'] for u in us if u['wall'] > 0]
        f.write(f"  model share of wall: {q(share)}\n")
    for t, d, c in aborted:
        f.write(f"model call not counted in any turn: http {c}, {d:.1f} s, ended {datetime.datetime.utcfromtimestamp(t).isoformat()}Z\n")
    f.write(f"model calls matched: {sum(len(u['model']) for u in turns)} of {len(calls)}; http codes {collections.Counter(c for _,_,c in calls)}\n")
print(open("summary.txt").read())
states = collections.Counter(re.findall(r"ACTOR_STATE_[A-Z]+", open("actor-trace.log").read()))
print(states)
