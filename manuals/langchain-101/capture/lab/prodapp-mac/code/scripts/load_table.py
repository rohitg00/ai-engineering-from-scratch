import json
import sys

data = json.load(open(sys.argv[1]))
for c in sorted(data["cells"], key=lambda c: (c["users"], c["workers"])):
    timeouts = sum(c["client_errors"].values())
    conflicts = c["codes"].get("409", 0)
    print(f"| {c['workers']} | {c['users']} | {c['runs']} | {timeouts} | {conflicts} | {c['runs_per_s_exact']:.3f} | {c['p50_s']:.1f} | {c['p95_s']:.1f} | {c['pg_conn_max']} |")
b = data["baseline"]
secs = sorted(s for cell in b for s in cell["run_seconds"])
print("baseline n", len(secs), "median", secs[len(secs) // 2], "rate", round(sum(x["ok"] / x["wall_s"] for x in b) / len(b), 3))
for c in data["cells"]:
    print(c["workers"], c["users"], "server", c["server_run_end"], "client errors", c["client_errors"], "ckpt rows/run",
          c["checkpoint_rows_per_run"], "bytes/run", c["checkpoint_data_bytes_per_run"], "refunds", c["refunds"], "pg mean", c["pg_conn_mean"])
