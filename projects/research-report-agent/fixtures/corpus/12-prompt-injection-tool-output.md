title: Prompt injection through tool output
source_url: https://www.rfc-editor.org/rfc/rfc3552
published: 2026-09-28

Indirect prompt injection arrives inside content an agent reads rather than a direct user instruction. A web page, repository file or tool result can contain an instruction to reveal secrets or call another tool.

Tool output is data with a different trust level from user instructions. Treating retrieved text as authority allows an attacker to redirect the agent. A report pipeline must keep retrieved claims separate from tool permissions.

No prompt alone establishes an isolation boundary. Practical defenses combine least privilege, approval for sensitive actions, a secrets proxy so the agent holds no keys, default-deny network egress and a separate execution environment. Defense in depth limits the damage if an injected instruction is followed.
