from pathlib import Path


def parse_message(raw: bytes) -> dict:
    raise NotImplementedError("Implement this contract in the matching stage")


def group_threads(messages: list[dict]) -> list[dict]:
    raise NotImplementedError("Implement this contract in the matching stage")


def triage(message: dict, rules: dict | None = None) -> dict:
    raise NotImplementedError("Implement this contract in the matching stage")


def build_draft(message: dict, decision: dict) -> dict:
    raise NotImplementedError("Implement this contract in the matching stage")


def provider_proposal(
    message: dict, endpoint: str, model: str, api_key: str = ""
) -> dict:
    raise NotImplementedError("Implement this contract in the matching stage")


def export_desk(messages: list[dict], out: Path, rules: dict | None = None) -> dict:
    raise NotImplementedError("Implement this contract in the matching stage")


if __name__ == "__main__":
    raise SystemExit("Implement the CLI using the stage 4 contract")
