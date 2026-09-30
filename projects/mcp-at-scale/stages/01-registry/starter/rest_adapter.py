"""Import a narrow OpenAPI GET surface; preserve schema provenance and explicit recordings."""

import hashlib
import json
import re
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("REST redirects are not permitted")


def import_openapi(spec):
    if not isinstance(spec, dict) or not str(spec.get("openapi", "")).startswith("3."):
        raise ValueError("OpenAPI3 object required")
    fingerprint = hashlib.sha256(
        json.dumps(spec, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    tools, names = [], set()
    for path, item in spec.get("paths", {}).items():
        if not path.startswith("/") or path.startswith("//") or ".." in path.split("/"):
            raise ValueError("unsafe API path")
        operation = item.get("get")
        if operation is None:
            continue
        name = operation.get("operationId")
        if (
            not isinstance(name, str)
            or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,63}", name)
            or name in names
        ):
            raise ValueError("unique safe operationId required")
        names.add(name)
        properties, required, parameters = {}, [], []
        for parameter in item.get("parameters", []) + operation.get("parameters", []):
            key = parameter.get("name")
            kind = parameter.get("schema", {}).get("type")
            if (
                parameter.get("in") not in ["path", "query"]
                or kind not in ["string", "integer", "boolean"]
                or not isinstance(key, str)
                or key in properties
            ):
                raise ValueError(
                    "only unique primitive path/query parameters supported"
                )
            properties[key] = {"type": kind}
            parameters.append({"name": key, "in": parameter["in"]})
            if parameter.get("required") or parameter["in"] == "path":
                required.append(key)
        if set(re.findall(r"{([^}]+)}", path)) != {
            p["name"] for p in parameters if p["in"] == "path"
        }:
            raise ValueError("path parameters must match placeholders")
        tools.append(
            {
                "name": name,
                "description": operation.get("summary", "Read " + path),
                "inputSchema": {
                    "type": "object",
                    "properties": properties,
                    "required": required,
                    "additionalProperties": False,
                },
                "rest": {
                    "path": path,
                    "parameters": parameters,
                    "source_sha256": fingerprint,
                },
            }
        )
    return tools


def execute_rest(tool, arguments, recordings=None, base_url=None):
    schema = tool["inputSchema"]
    if (
        not isinstance(arguments, dict)
        or set(arguments) - set(schema["properties"])
        or set(schema["required"]) - set(arguments)
    ):
        raise ValueError("arguments do not match imported schema")
    for key, value in arguments.items():
        kind = schema["properties"][key]["type"]
        if (
            (kind == "string" and not isinstance(value, str))
            or (kind == "integer" and type(value) is not int)
            or (kind == "boolean" and type(value) is not bool)
        ):
            raise ValueError("argument type mismatch")
    if base_url is None:
        if recordings is None or tool["name"] not in recordings:
            raise ValueError("recording missing for operation")
        recording = recordings[tool["name"]]
        if recording.get("arguments") != arguments:
            raise ValueError("no matching recording for arguments")
        return {
            "mode": "recording",
            "source_sha256": tool["rest"]["source_sha256"],
            "value": recording["value"],
        }
    base = urllib.parse.urlparse(base_url)
    if (
        base.scheme != "http"
        or base.hostname not in ["127.0.0.1", "localhost", "::1"]
        or base.username
        or base.password
        or base.query
        or base.fragment
    ):
        raise ValueError("live REST lab requires a loopback HTTP origin")
    path = tool["rest"]["path"]
    query = {}
    for parameter in tool["rest"]["parameters"]:
        key = parameter["name"]
        if key not in arguments:
            continue
        if parameter["in"] == "path":
            path = path.replace(
                "{" + key + "}", urllib.parse.quote(str(arguments[key]), safe="")
            )
        else:
            query[key] = (
                str(arguments[key]).lower()
                if type(arguments[key]) is bool
                else str(arguments[key])
            )
    url = (
        base_url.rstrip("/")
        + path
        + ("?" + urllib.parse.urlencode(query) if query else "")
    )
    with urllib.request.build_opener(NoRedirect).open(
        urllib.request.Request(
            url, method="GET", headers={"Accept": "application/json"}
        ),
        timeout=5,
    ) as response:
        content = response.read(1000001)
        if len(content) > 1000000:
            raise ValueError("REST response too large")
        value = json.loads(content)
    return {
        "mode": "live-loopback-get",
        "source_sha256": tool["rest"]["source_sha256"],
        "value": value,
    }
