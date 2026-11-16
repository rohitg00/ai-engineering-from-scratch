import json
import sys

f = sys.argv[1] if len(sys.argv) > 1 else "01-levels.jsonl"
print("config level rep wall_s runs_ok runs_correct errors model_calls_per_s out_tok_per_s model_overlap_max model_call_s_p50 run_ms_p50 put_ms_p50 put_ms_p99 put_writes_ms_p50 put_writes_ms_p99 get_tuple_ms_p50 get_tuple_ms_p99 ckpt_ms_total rows_ckpt rows_writes rows_blobs pg_conns_max pg_conns_max_active client_cpu_s")
for l in open(f):
    r = json.loads(l)
    if r.get("exp") != "T16r":
        continue
    print(r["config"], r["level"], r["rep"], r["wall_s"], r["runs_ok"], r["runs_correct"], r["errors"], r["model_calls_per_s"], r["out_tok_per_s"], r["model_client_overlap_max"],
          r["model_call_s"]["p50"], round(r["run_ms"]["p50"]), r["ckpt_put_ms"]["p50"], r["ckpt_put_ms"]["p99"], r["ckpt_put_writes_ms"]["p50"], r["ckpt_put_writes_ms"]["p99"],
          r["ckpt_get_tuple_ms"]["p50"], r["ckpt_get_tuple_ms"]["p99"], r["ckpt_ms_total"], r["rows"]["checkpoints"], r["rows"]["writes"], r["rows"]["blobs"],
          r["pg_conns"]["max"], r["pg_conns"]["max_active"], r["client_cpu_s"])
