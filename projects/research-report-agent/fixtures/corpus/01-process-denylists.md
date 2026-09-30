title: Command denylists for agent tools
source_url: https://www.rfc-editor.org/rfc/rfc3552
published: 2026-09-28

A command denylist inspects each shell command and refuses blocked patterns before execution. A path jail resolves file arguments and rejects paths outside an allowed root. Both checks catch accidental writes and deletes before they happen.

Denylists are not a security boundary. An agent that can run an interpreter can rebuild a blocked command inside a script. The process still runs as the same user on the same kernel, so the agent can reach everything that user can reach.

Least privilege and separate isolation limit the damage when a command check fails. A denylist describes what the agent should not try; isolation limits what an attempted operation can affect.
