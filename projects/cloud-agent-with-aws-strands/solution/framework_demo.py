import json
from strands_adapter import run_strands, parse_model_plan

print("Real Strands Agent with an injected offline streaming Model; no cloud call")
result = run_strands(
    "Inspect service-a", '[{"operation":"metrics.read","resource":"service-a"}]'
)
print(
    json.dumps(
        {**result, "validated_plan": parse_model_plan(result["text"], {"service-a"})},
        indent=2,
    )
)
