import json
from main import *

jobs = [
    {"id": "search", "cost": 20, "duration_ms": 40},
    {"id": "write", "cost": 80, "duration_ms": 120},
    {"id": "retry", "cost": 30, "duration_ms": 20},
    {"id": "slow", "cost": 0, "duration_ms": 100},
]
print(json.dumps(schedule(jobs, 100, 180), indent=2))
