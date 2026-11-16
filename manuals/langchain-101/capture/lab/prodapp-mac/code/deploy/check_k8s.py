import sys

import yaml

REQUIRED = {
    ("v1", "Secret"): [],
    ("v1", "Service"): ["spec.ports"],
    ("apps/v1", "Deployment"): ["spec.selector.matchLabels", "spec.template.metadata.labels", "spec.template.spec.containers"],
    ("apps/v1", "StatefulSet"): ["spec.serviceName", "spec.selector.matchLabels", "spec.template.spec.containers"],
}


def get(doc, path):
    for key in path.split("."):
        doc = doc.get(key) if isinstance(doc, dict) else None
    return doc


def check(docs):
    problems = []
    names = {(d["kind"], d["metadata"]["name"]) for d in docs}
    pods = {d["metadata"]["name"]: get(d, "spec.template.metadata.labels") for d in docs if d["kind"] in ("Deployment", "StatefulSet")}
    for d in docs:
        key, name = (d.get("apiVersion"), d.get("kind")), get(d, "metadata.name")
        if key not in REQUIRED or not name:
            problems.append(f"unknown kind or missing name: {key} {name}")
            continue
        problems += [f"{name}: missing {p}" for p in REQUIRED[key] if get(d, p) is None]
        if d["kind"] in ("Deployment", "StatefulSet"):
            if get(d, "spec.selector.matchLabels") != get(d, "spec.template.metadata.labels"):
                problems.append(f"{name}: selector does not match pod labels")
            for c in get(d, "spec.template.spec.containers"):
                ports = {p["containerPort"] for p in c.get("ports", [])}
                for probe in ("readinessProbe", "livenessProbe"):
                    port = get(c, f"{probe}.httpGet.port")
                    if port is not None and port not in ports:
                        problems.append(f"{name}: {probe} port {port} not exposed")
                for ref in c.get("envFrom", []):
                    if ("Secret", ref["secretRef"]["name"]) not in names:
                        problems.append(f"{name}: missing secret {ref['secretRef']['name']}")
        if d["kind"] == "StatefulSet" and ("Service", get(d, "spec.serviceName")) not in names:
            problems.append(f"{name}: governing service missing")
        if d["kind"] == "Service" and get(d, "spec.selector") not in pods.values():
            problems.append(f"{name}: selector matches no pod template")
    return problems


if __name__ == "__main__":
    docs = [d for d in yaml.safe_load_all(open(sys.argv[1])) if d]
    problems = check(docs)
    print(f"{len(docs)} objects: {', '.join(d['kind'] + '/' + d['metadata']['name'] for d in docs)}")
    print("\n".join(problems) or "no problems")
    sys.exit(1 if problems else 0)
