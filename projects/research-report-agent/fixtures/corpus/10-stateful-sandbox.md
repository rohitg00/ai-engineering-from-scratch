title: A stateful sandbox controller preserves session identity
source_url: https://www.rfc-editor.org/rfc/rfc9110
published: 2026-09-28

A stateful sandbox controller gives an agent session a stable identity and lifecycle. A sandbox resource declares its desired state, and the controller reconciles that state with the running environment.

Unlike interchangeable service replicas, a session owns working files, installed tools and a checked-out repository. A restart should reconnect the session to its own state rather than silently attach another user workspace.

The controller does not implement isolation itself. It depends on the runtime configured for the workload, which may use a user-space kernel or a virtual machine. Lifecycle management and runtime isolation are separate responsibilities that need separate tests.
