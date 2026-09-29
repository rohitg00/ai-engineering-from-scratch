def nonnegative(value):
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise ValueError("nonnegative integer required")
    return value


def estimate(input_tokens, output_limit, input_rate, output_rate):
    return nonnegative(input_tokens) * nonnegative(input_rate) + nonnegative(
        output_limit
    ) * nonnegative(output_rate)


def ledger(limit):
    return {"limit": nonnegative(limit), "spent": 0, "holds": {}, "closed": []}


def reserve(state, request_id, amount):
    amount = nonnegative(amount)
    if (
        not isinstance(request_id, str)
        or not request_id
        or request_id in state["holds"]
        or (request_id in state["closed"])
    ):
        raise ValueError("new request id required")
    if state["spent"] + sum(state["holds"].values()) + amount > state["limit"]:
        raise ValueError("budget exceeded")
    return {
        **state,
        "holds": {**state["holds"], request_id: amount},
        "closed": list(state["closed"]),
    }


def settle(state, request_id, actual):
    actual = nonnegative(actual)
    if request_id not in state["holds"]:
        raise ValueError("unknown reservation")
    if actual > state["holds"][request_id]:
        raise ValueError("actual cost exceeds reservation")
    holds = dict(state["holds"])
    del holds[request_id]
    return {
        **state,
        "spent": state["spent"] + actual,
        "holds": holds,
        "closed": state["closed"] + [request_id],
    }


def schedule(jobs, limit, deadline_ms):
    state = ledger(limit)
    nonnegative(deadline_ms)
    elapsed = 0
    events = []
    seen = set()
    for job in jobs:
        if job["id"] in seen:
            raise ValueError("duplicate job id")
        seen.add(job["id"])
        duration = nonnegative(job["duration_ms"])
        cost = nonnegative(job["cost"])
        if elapsed + duration > deadline_ms:
            events.append({"id": job["id"], "status": "rejected", "reason": "deadline"})
            continue
        try:
            state = reserve(state, job["id"], cost)
        except ValueError as error:
            events.append({"id": job["id"], "status": "rejected", "reason": str(error)})
            continue
        state = settle(state, job["id"], cost)
        elapsed += duration
        events.append(
            {"id": job["id"], "status": "completed", "cost": cost, "elapsed_ms": elapsed}
        )
    return {"ledger": state, "events": events, "elapsed_ms": elapsed}
