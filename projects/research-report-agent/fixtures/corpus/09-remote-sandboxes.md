title: Remote sandboxes move agent work off a laptop
source_url: https://www.rfc-editor.org/rfc/rfc3552
published: 2026-09-28

A remote sandbox runs an agent session on separate compute. Each microVM sandbox has its own kernel and its own container daemon. Long tasks can continue while the developer machine is disconnected.

Portable image templates package the files and tools required to start a session. A template should declare its entry point and runtime requirements, while secrets are injected through a proxy outside the sandbox.

Remote sandboxes combine a secrets proxy, a network egress policy and explicit resource budgets. Moving a workload does not remove its security requirements. A platform must preserve the isolation boundary and verify which files and capabilities cross between local and remote sessions.
