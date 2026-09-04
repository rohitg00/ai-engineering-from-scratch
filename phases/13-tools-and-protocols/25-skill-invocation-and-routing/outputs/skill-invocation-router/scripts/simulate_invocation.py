#!/usr/bin/env python3
"""Simulate one invocation decision and print JSON; no skill code is executed."""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path


def tokens(value: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", value.lower()))


def score(query: str, name: str, description: str) -> float:
    left, right = tokens(query), tokens(f"{name} {description}")
    return 0.0 if not left or not right else len(left & right) / len(left | right)


def policy_bool(policy: dict[str, object], key: str, default: bool = False) -> bool:
    value = policy.get(key, default)
    if type(value) is not bool:
        raise ValueError(f"{key} must be a JSON boolean")
    return value


def string_list(policy: dict[str, object], key: str) -> list[str]:
    value = policy.get(key, [])
    if not isinstance(value, list) or not all(
        isinstance(item, str) and item for item in value
    ):
        raise ValueError(f"{key} must be an array of non-empty names")
    return value


def validate_policy(
    policy: dict[str, object],
) -> tuple[float, list[str], list[str], list[str], list[str], int]:
    threshold = policy.get("modelThreshold", 1.0)
    if (
        isinstance(threshold, bool)
        or not isinstance(threshold, (int, float))
        or not math.isfinite(threshold)
        or not 0.0 <= threshold <= 1.0
    ):
        raise ValueError("modelThreshold must be a finite number from 0 to 1")
    harness_allowlist = string_list(policy, "harnessAllowlist")
    recognized = string_list(policy, "recognizedExtensions")
    application_allowlist = string_list(policy, "applicationAllowlist")
    skill_callers = string_list(policy, "skillCallerAllowlist")
    max_depth = policy.get("maxSkillDepth", 1)
    if type(max_depth) is not int or max_depth < 1:
        raise ValueError("maxSkillDepth must be a positive integer")
    return (
        float(threshold),
        harness_allowlist,
        recognized,
        application_allowlist,
        skill_callers,
        max_depth,
    )


def decide(args: argparse.Namespace, policy: dict[str, object]) -> dict[str, object]:
    actor = args.actor
    (
        threshold,
        harness_allowlist,
        recognized,
        application_allowlist,
        skill_callers,
        max_depth,
    ) = validate_policy(policy)
    channel = {
        "human": "explicit-human",
        "model": "implicit-model",
        "agent": "implicit-agent",
        "application": "programmatic-application",
        "skill": "composed-skill",
        "harness": "programmatic-harness",
    }[actor]
    adapter = "host-extension-policy" if recognized else "core-policy"
    if actor == "human":
        allowed = policy_bool(policy, "allowHuman") and args.explicit_name == args.name
        reason = "exact human selection" if allowed else "human policy or exact-name check blocked activation"
        match_score = 1.0 if args.explicit_name == args.name else 0.0
        if "user-invocable" in recognized and args.user_invocable == "false":
            allowed = False
            reason = "host extension user-invocable=false"
    elif actor == "harness":
        allowed = (
            policy_bool(policy, "allowProgrammatic")
            and args.explicit_name == args.name
            and args.name in harness_allowlist
        )
        reason = "programmatic allowlist" if allowed else "programmatic policy, exact name, or allowlist blocked activation"
        match_score = 1.0 if args.explicit_name == args.name else 0.0
    elif actor == "application":
        allowed = (
            policy_bool(policy, "allowApplication")
            and args.explicit_name == args.name
            and args.name in application_allowlist
        )
        reason = "application target allowlist" if allowed else "application policy, exact name, or target allowlist blocked activation"
        match_score = 1.0 if args.explicit_name == args.name else 0.0
    elif actor == "skill":
        caller_name = getattr(args, "caller_name", None)
        depth = getattr(args, "depth", 0)
        allowed = (
            policy_bool(policy, "allowSkill")
            and args.explicit_name == args.name
            and caller_name in skill_callers
            and caller_name != args.name
            and type(depth) is int
            and 1 <= depth <= max_depth
        )
        reason = "skill caller and depth policy" if allowed else "skill policy, exact target, caller allowlist, cycle, or depth blocked activation"
        match_score = 1.0 if args.explicit_name == args.name else 0.0
    else:
        policy_key = "allowAgent" if actor == "agent" else "allowModel"
        match_score = 0.0
        eligible = policy_bool(policy, policy_key)
        if not eligible:
            allowed = False
            reason = f"{actor} activation policy blocked eligibility"
        elif (
            "disable-model-invocation" in recognized
            and args.disable_model_invocation == "true"
        ):
            allowed = False
            reason = "host extension disable-model-invocation=true"
        else:
            match_score = score(args.query, args.name, args.description)
            allowed = match_score >= threshold
            reason = (
                "model relevance threshold"
                if allowed
                else "relevance threshold blocked activation"
            )
    return {
        "activated": allowed,
        "adapter": adapter,
        "actor": actor,
        "channel": channel,
        "skill": args.name,
        "score": round(match_score, 4),
        "reason": reason,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--policy", type=Path, required=True)
    parser.add_argument(
        "--actor",
        choices=("human", "model", "agent", "application", "skill", "harness"),
        required=True,
    )
    parser.add_argument("--name", required=True)
    parser.add_argument("--description", required=True)
    parser.add_argument("--query", default="")
    parser.add_argument("--explicit-name")
    parser.add_argument("--caller-name")
    parser.add_argument("--depth", type=int, default=0)
    parser.add_argument("--user-invocable", choices=("true", "false"))
    parser.add_argument("--disable-model-invocation", choices=("true", "false"))
    args = parser.parse_args()
    policy = json.loads(args.policy.read_text(encoding="utf-8"))
    try:
        result = decide(args, policy)
    except ValueError as error:
        result = {
            "activated": False,
            "actor": args.actor,
            "channel": "policy-validation",
            "adapter": "invalid-policy",
            "skill": args.name,
            "score": 0.0,
            "reason": str(error),
        }
        print(json.dumps(result, indent=2, sort_keys=True))
        raise SystemExit(2) from error
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
