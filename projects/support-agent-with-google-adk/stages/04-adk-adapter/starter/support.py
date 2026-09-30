KNOWLEDGE = {
    "billing": (
        "billing-receipts",
        "Find the invoice reference on the receipt. Include that reference when asking the billing team to review a charge.",
    ),
    "access": (
        "access-recovery",
        "Use the account recovery page to request a reset link. Support never needs your password or API key.",
    ),
    "platform": (
        "platform-status",
        "Check the service status page and record the failing request time and error code before opening an incident.",
    ),
}


def prepare_support(raw, requested_tool=None):
    raise NotImplementedError("Compose intake, routing and capability checks")


def support_ticket(raw, requested_tool=None):
    raise NotImplementedError("Create a sourced reply or human escalation")


def export_support(result, out):
    raise NotImplementedError("Export review HTML and JSON")
