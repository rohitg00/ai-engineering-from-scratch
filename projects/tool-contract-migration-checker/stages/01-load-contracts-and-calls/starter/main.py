"""Fill in the stage interfaces in your own workspace."""

from typing import Any, Dict, List, Tuple


def load_contract(raw: Any) -> Dict[str, Any]:
    raise NotImplementedError("load_contract")


def load_calls(raw: Any) -> List[Dict[str, Any]]:
    raise NotImplementedError("load_calls")


def validate_call(contract: Dict[str, Any], args: Any) -> Tuple[bool, List[str]]:
    raise NotImplementedError("validate_call")


def classify_changes(old_contract: Dict[str, Any], new_contract: Dict[str, Any]) -> List[Dict[str, Any]]:
    raise NotImplementedError("classify_changes")


def generate_counterexamples(old_contract: Dict[str, Any], new_contract: Dict[str, Any]) -> List[Dict[str, Any]]:
    raise NotImplementedError("generate_counterexamples")


def replay_calls(old_contract: Dict[str, Any], new_contract: Dict[str, Any], calls: List[Dict[str, Any]]) -> Dict[str, Any]:
    raise NotImplementedError("replay_calls")


def build_report(old_contract: Dict[str, Any], new_contract: Dict[str, Any], changes: List[Dict[str, Any]], counterexamples: List[Dict[str, Any]], replay_result: Dict[str, Any]) -> Dict[str, Any]:
    raise NotImplementedError("build_report")


def export_fixtures(output_path: str, counterexamples: List[Dict[str, Any]], broken_calls: List[Dict[str, Any]]) -> Dict[str, Any]:
    raise NotImplementedError("export_fixtures")
