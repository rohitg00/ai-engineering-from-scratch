import argparse
import asyncio
import json
from pathlib import Path
from support import support_ticket, export_support


def main():
    p = argparse.ArgumentParser(
        description="Prepare a redacted support reply or a human escalation. Never sends messages."
    )
    p.add_argument(
        "--ticket", type=Path, default=Path(__file__).parent / "fixtures/ticket.json"
    )
    p.add_argument("--out", type=Path, default=Path("support-output"))
    p.add_argument("--adk", action="store_true")
    p.add_argument(
        "--model",
        help="Explicit live ADK model; requires provider credentials and --adk",
    )
    p.add_argument("--tool", help="Optional requested read capability to check")
    args = p.parse_args()
    raw = json.loads(args.ticket.read_text())
    if args.model and not args.adk:
        p.error("--model requires --adk")
    if args.adk:
        from adk_adapter import run_adk

        result = asyncio.run(
            run_adk(
                raw["text"],
                ticket_id=raw["id"],
                requested_tool=args.tool,
                model=args.model,
            )
        )
    else:
        result = support_ticket(raw, args.tool)
    export_support(result, args.out)
    print(
        json.dumps(
            {
                "state": result["session"]["state"],
                "route": result["session"]["route"],
                "response": result["session"].get("response"),
                "output": str(args.out / "index.html"),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
