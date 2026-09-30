"""Build a catalog of 250 read-only tools.

Lesson: projects/mcp-at-scale/stages/01-registry/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

RESOURCES = (
    "pods jobs nodes services routes volumes events queues topics messages buckets objects files directories users groups roles policies tokens sessions agents tasks runs spans traces metrics logs alerts dashboards reports notes documents chunks embeddings indexes models prompts skills hooks workflows schedules workers functions triggers deployments releases images artifacts registries clusters"
).split()
OPERATIONS = ("list", "get", "count", "search", "describe")


def catalog():
    rows = []
    for resource in RESOURCES:
        for operation in OPERATIONS:
            properties = (
                {"name": {"type": "string"}}
                if operation == "get"
                else {"query": {"type": "string"}}
                if operation == "search"
                else {}
            )
            rows.append(
                {
                    "name": resource + "_" + operation,
                    "description": f"{operation} {resource} in the local fixture inventory",
                    "inputSchema": {
                        "type": "object",
                        "properties": properties,
                        "required": list(properties),
                        "additionalProperties": False,
                    },
                    "resource": resource,
                    "operation": operation,
                }
            )
    return rows


def execute(tool, arguments, inventory):
    schema = tool["inputSchema"]
    required = schema["required"]
    if (
        not isinstance(arguments, dict)
        or set(arguments) != set(required)
        or any(not isinstance(v, str) for v in arguments.values())
    ):
        raise ValueError("arguments do not match schema")
    items = inventory.get(tool["resource"], [])
    op = tool["operation"]
    if op == "list":
        return items
    if op == "count":
        return len(items)
    if op == "describe":
        return {"resource": tool["resource"], "operations": list(OPERATIONS)}
    if op == "search":
        return [
            item
            for item in items
            if arguments["query"].casefold() in item["name"].casefold()
        ]
    if op == "get":
        return next((item for item in items if item["name"] == arguments["name"]), None)
    raise ValueError("unknown operation")
