import copy, itertools, hashlib, json


def catalog(resources):
    """Validate and copy at most 18 resources {id,title,minutes,goals:[str],prerequisites:[id]}. IDs are unique; minutes positive integer. Known-resource cycles are rejected. Missing prerequisite IDs remain explicit for later feasibility checks."""
    if len(resources) > 18:
        raise ValueError("exact planner supports at most 18 resources")
    index = {}
    for r in resources:
        if (
            not all((isinstance(r.get(k), str) and r[k] for k in ("id", "title")))
            or r["id"] in index
            or type(r.get("minutes")) is not int
            or (r["minutes"] <= 0)
        ):
            raise ValueError("invalid resource identity or duration")
        for k in ("goals", "prerequisites"):
            if (
                not isinstance(r.get(k), list)
                or any((not isinstance(x, str) or not x for x in r[k]))
                or len(set(r[k])) != len(r[k])
            ):
                raise ValueError("invalid goals or prerequisites")
        index[r["id"]] = copy.deepcopy(r)
    done = set()
    visiting = set()

    def visit(id):
        if id in visiting:
            raise ValueError("prerequisite cycle")
        if id in done or id not in index:
            return
        visiting.add(id)
        for p in index[id]["prerequisites"]:
            visit(p)
        visiting.remove(id)
        done.add(id)

    for id in index:
        visit(id)
    return index


def path_for(index, target, completed=None):
    """Return {target,steps,missing,minutes,feasible}, with prerequisites before target and completed IDs excluded from steps. completed can satisfy a prerequisite outside the catalog. Unknown targets are missing rather than fabricated resources."""
    completed = set(completed or [])
    seen = set()
    missing = set()
    steps = []

    def visit(id):
        if id in completed or id in seen:
            return
        seen.add(id)
        if id not in index:
            missing.add(id)
            return
        for p in sorted(index[id]["prerequisites"]):
            visit(p)
        steps.append(id)

    visit(target)
    return {
        "target": target,
        "steps": steps,
        "missing": sorted(missing),
        "minutes": sum((index[id]["minutes"] for id in steps)),
        "feasible": not missing,
    }


def rank_paths(index, goals, budget, completed=None):
    """Return {best,alternatives,unmet_prerequisites}. Exact search combines prerequisite-closed routes for requested goals; rank by most distinct goals covered, then fewest minutes, then IDs. Budget is nonnegative integer. best includes steps,minutes,covered,uncovered; completed resources contribute goals without consuming budget. Keep top three distinct alternatives."""
    if (
        type(budget) is not int
        or budget < 0
        or (not isinstance(goals, list))
        or any((not isinstance(g, str) or not g for g in goals))
        or (len(set(goals)) != len(goals))
    ):
        raise ValueError("invalid goals or budget")
    completed = set(completed or [])
    wanted = set(goals)
    already = {
        g for id in completed if id in index for g in index[id]["goals"]
    } & wanted
    routes = []
    unmet = []
    for id in sorted(index):
        if wanted & set(index[id]["goals"]) and id not in completed:
            route = path_for(index, id, completed)
            if route["missing"]:
                unmet.append({"target": id, "missing": route["missing"]})
            else:
                routes.append(route)
    plans = {
        frozenset(): {
            "steps": [],
            "minutes": 0,
            "covered": sorted(already),
            "uncovered": sorted(wanted - already),
        }
    }
    for route in routes:
        for members, old in list(plans.items()):
            chosen = frozenset(set(members) | set(route["steps"]))
            minutes = sum((index[id]["minutes"] for id in chosen))
            if chosen in plans or minutes > budget:
                continue
            steps = []
            seen = set(completed)

            def visit(id):
                if id in seen:
                    return
                for p in sorted(index[id]["prerequisites"]):
                    visit(p)
                seen.add(id)
                steps.append(id)

            for id in sorted(chosen):
                visit(id)
            covered = (
                already | {g for id in chosen for g in index[id]["goals"]}
            ) & wanted
            plans[chosen] = {
                "steps": steps,
                "minutes": minutes,
                "covered": sorted(covered),
                "uncovered": sorted(wanted - covered),
            }
    ordered = sorted(
        plans.values(), key=lambda p: (-len(p["covered"]), p["minutes"], p["steps"])
    )
    return {
        "best": ordered[0],
        "alternatives": ordered[:3],
        "unmet_prerequisites": unmet,
    }


def export_path(index, goals, budget, completed=None, decisions=None):
    """Return schema_version=1 {fingerprint,path,alternatives,unmet_prerequisites,remaining_minutes}. path entries contain original resource fields, selected reasons and completed status. Review {fingerprint,completed:[selected IDs]} can mark progress only when all prerequisites are previously completed or included. Fingerprint binds catalog, goals, budget and previous completion."""
    completed = set(completed or [])
    ranked = rank_paths(index, goals, budget, completed)
    best = ranked["best"]
    fingerprint = hashlib.sha256(
        json.dumps(
            {
                "catalog": index,
                "goals": goals,
                "budget": budget,
                "completed": sorted(completed),
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()
    progress = (decisions or {}).get("completed", [])
    if decisions is not None and decisions.get("fingerprint") != fingerprint:
        raise ValueError("stale progress")
    if len(set(progress)) != len(progress) or not set(progress) <= set(best["steps"]):
        raise ValueError("unknown or duplicate progress ID")
    done = completed | set(progress)
    for id in progress:
        if not set(index[id]["prerequisites"]) <= done:
            raise ValueError("complete prerequisites first")
    path = [
        {
            **index[id],
            "completed": id in done,
            "reason": "goal: " + ", ".join(sorted(set(index[id]["goals"]) & set(goals)))
            if set(index[id]["goals"]) & set(goals)
            else "prerequisite for selected goal",
        }
        for id in best["steps"]
    ]
    return {
        "schema_version": 1,
        "fingerprint": fingerprint,
        "path": path,
        "covered": best["covered"],
        "uncovered": best["uncovered"],
        "planned_minutes": best["minutes"],
        "remaining_minutes": sum((r["minutes"] for r in path if not r["completed"])),
        "alternatives": ranked["alternatives"],
        "unmet_prerequisites": ranked["unmet_prerequisites"],
    }
