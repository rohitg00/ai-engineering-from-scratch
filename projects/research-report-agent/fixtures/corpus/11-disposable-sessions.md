title: Disposable sessions isolate generated code
source_url: https://www.kernel.org/doc/html/latest/virt/kvm/api.html
published: 2026-09-28

A disposable session provides a fresh environment for each task that runs generated code. The agent creates a session, runs commands, reads the output and closes the session.

A microVM session has its own guest kernel instead of sharing the host kernel with other users. Hardware virtualization separates guest memory and privileged operations from the host. The session still needs network and credential policies.

Common uses include code interpreters, data analysis agents and test runners. Session teardown must revoke credentials and delete temporary state. Explicit time limits and cleanup paths prevent abandoned tasks from consuming resources indefinitely.
