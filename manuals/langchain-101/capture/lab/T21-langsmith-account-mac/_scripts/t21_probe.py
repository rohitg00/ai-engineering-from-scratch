import json
import sys
from t21_common import T21, api, jdump, env_snapshot

PATHS = ["/info", "/api/v1/info", "/orgs/current", "/orgs/current/info", "/orgs/current/billing", "/workspaces", "/settings",
         "/tenants", "/api/v1/orgs/current/info", "/sessions?limit=3", "/datasets?limit=3", "/repos?limit=3", "/usage-limits",
         "/orgs/current/usage-limits", "/ttl-settings", "/orgs/ttl-settings", "/api/v1/ttl-settings", "/org-usage", "/orgs/current/tenant-stats"]


def main():
    out = T21 / sys.argv[1]
    rows = []
    for p in PATHS:
        path, _, q = p.partition("?")
        params = dict(kv.split("=") for kv in q.split("&")) if q else None
        try:
            st, data, hdrs, dt = api("GET", path, params=params)
            rows.append({"path": p, "status": st, "secs": round(dt, 3), "resp_headers": hdrs,
                         "body": data if len(json.dumps(data, default=str)) < 6000 else str(data)[:6000]})
        except Exception as e:
            rows.append({"path": p, "error": repr(e)[:300]})
        print(p, rows[-1].get("status"), rows[-1].get("error", ""), flush=True)
    jdump(out, {"env": env_snapshot(), "request_auth_header_names": ["x-api-key"], "rows": rows})


if __name__ == "__main__":
    main()
