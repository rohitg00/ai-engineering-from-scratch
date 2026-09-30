import asyncio
import json
from adk_adapter import run_adk

print("Real ADK Workflow, two LlmAgents, injected offline BaseLlm models")
print(json.dumps(asyncio.run(run_adk("Please review the invoice.")), indent=2))
