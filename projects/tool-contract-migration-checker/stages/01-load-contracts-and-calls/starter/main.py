"""Fill in the stage interfaces in your own workspace."""

from typing import Any, Dict, List, Tuple


def load_contract(raw: Any) -> Dict[str, Any]:
    """Parse and validate a raw tool contract dictionary into a normalized schema representation."""
    raise NotImplementedError("load_contract")


def load_calls(raw: Any) -> List[Dict[str, Any]]:
    """Parse and validate recorded tool invocation calls into a standardized call list."""
    raise NotImplementedError("load_calls")


def validate_call(contract: Dict[str, Any], args: Any) -> Tuple[bool, List[str]]:
    """Validate a dictionary of tool arguments against a parsed contract schema."""
    raise NotImplementedError("validate_call")


def classify_changes(old_contract: Dict[str, Any], new_contract: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Compare two tool contracts and classify changes as breaking, compatible, or unresolved."""
    raise NotImplementedError("classify_changes")


def generate_counterexamples(old_contract: Dict[str, Any], new_contract: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Synthesize concrete failing call fixtures that pass the old contract but fail the new contract."""
    raise NotImplementedError("generate_counterexamples")


def replay_calls(old_contract: Dict[str, Any], new_contract: Dict[str, Any], calls: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Replay saved tool calls against both contracts and partition into preserved, broken, and invalid."""
    raise NotImplementedError("replay_calls")


def build_report(old_contract: Dict[str, Any], new_contract: Dict[str, Any], changes: List[Dict[str, Any]], counterexamples: List[Dict[str, Any]], replay_result: Dict[str, Any]) -> Dict[str, Any]:
    """Assemble a comprehensive migration report combining static analysis, counterexamples, and replay."""
    raise NotImplementedError("build_report")


def export_fixtures(output_path: str, counterexamples: List[Dict[str, Any]], broken_calls: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Export synthesized counterexamples and broken calls to a JSON test fixture file."""
    raise NotImplementedError("export_fixtures")
