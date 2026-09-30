from pathlib import Path


def validate_manifest(manifest: dict, root: Path) -> list[dict]:
    raise NotImplementedError("Implement this contract in the matching stage")


def terms(text: str) -> set[str]:
    raise NotImplementedError("Implement this contract in the matching stage")


def search(assets: list[dict], query: str, limit: int = 20) -> list[dict]:
    raise NotImplementedError("Implement this contract in the matching stage")


def validate_proposal(proposal: dict, width: int, height: int) -> dict:
    raise NotImplementedError("Implement this contract in the matching stage")


def request_vision(
    path: Path, endpoint: str, model: str, width: int, height: int, api_key: str = ""
) -> dict:
    raise NotImplementedError("Implement this contract in the matching stage")


def image_data(asset: dict) -> str:
    raise NotImplementedError("Implement this contract in the matching stage")


def export_library(assets: list[dict], query: str, out: Path) -> dict:
    raise NotImplementedError("Implement this contract in the matching stage")


if __name__ == "__main__":
    raise SystemExit("Implement the CLI using the stage 4 contract")
