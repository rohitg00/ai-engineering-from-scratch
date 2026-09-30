import json
from plan import validate_plan
from executor import execute

plan = validate_plan(
    [{"operation": "metrics.read", "resource": "service-a"}], {"service-a"}
)
print(
    json.dumps(
        execute(
            plan,
            lambda op, resource: {
                "resource": resource,
                "requests": 120,
                "errors": 3,
                "source": "local fixture",
            },
        ),
        indent=2,
    )
)
