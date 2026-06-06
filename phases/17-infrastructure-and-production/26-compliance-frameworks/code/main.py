"""Cross-framework compliance mapping — stdlib Python.

Given a control, print the frameworks it satisfies. Given a customer profile
(geography + segment), print the required frameworks.
"""

from __future__ import annotations


CONTROL_MAP = {
    "access logging": ["ISO 27001 A.5.15-5.18", "GDPR Art. 32", "HIPAA §164.312(a)", "SOC 2 CC6"],
    "change management": ["ISO 27001 A.8.32", "PCI DSS Req. 6", "HIPAA breach-notification", "SOC 2 CC8"],
    "encryption in transit": ["ISO 27001 A.8.24", "GDPR Art. 32", "HIPAA §164.312(e)", "PCI DSS Req. 4"],
    "secrets management": ["ISO 27001 A.8.19", "PCI DSS Req. 8", "SOC 2 CC6.1"],
    "PII redaction (inference-time)": ["GDPR Art. 25", "EU AI Act Art. 10", "HIPAA §164.514"],
    "audit log retention": ["SOC 2 CC7", "HIPAA §164.312(b)", "ISO 27001 A.8.15"],
    "conformity assessment": ["EU AI Act Art. 43 (high-risk)"],
    "impact assessment": ["Colorado AI Act SB24-205", "EU AI Act Art. 27"],
    "data subject rights": ["GDPR Ch. III", "CCPA"],
    "BAA signed": ["HIPAA §164.504(e)"],
}


PROFILE_MAP = {
    ("US", "B2B SaaS"):             ["SOC 2 Type II", "ISO 27001", "ISO 42001"],
    ("US", "healthcare"):           ["SOC 2 Type II", "HIPAA", "ISO 27001"],
    ("US", "fintech"):              ["SOC 2 Type II", "PCI-DSS", "ISO 27001"],
    ("EU", "B2B SaaS"):             ["GDPR", "SOC 2 Type II", "ISO 27001", "EU AI Act"],
    ("EU", "healthcare"):           ["GDPR", "SOC 2 Type II", "HIPAA (global)", "EU AI Act"],
    ("Global", "enterprise"):       ["SOC 2 Type II", "ISO 27001", "ISO 42001", "GDPR", "HIPAA", "EU AI Act"],
    ("US-CO", "B2B SaaS"):          ["SOC 2 Type II", "Colorado AI Act", "ISO 27001"],
}


def main() -> None:
    print("=" * 80)
    print("COMPLIANCE CONTROL MAP — one control, many frameworks")
    print("=" * 80)
    for control, frameworks in CONTROL_MAP.items():
        print(f"\n{control}")
        for f in frameworks:
            print(f"  → {f}")

    print("\n" + "=" * 80)
    print("CUSTOMER PROFILE MAP — required frameworks per geography + segment")
    print("=" * 80)
    for (geo, segment), frameworks in PROFILE_MAP.items():
        print(f"\n{geo} · {segment}")
        for f in frameworks:
            print(f"  · {f}")

    print("\nNote: EU AI Act high-risk enforcement August 2, 2026.")
    print("Fines up to €35M or 7% global annual turnover.")


if __name__ == "__main__":
    main()
