title: Containers share the host kernel
source_url: https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html
published: 2026-09-28

A container is a normal process with a restricted view of the system. Namespaces separate process identifiers, mounts and network interfaces. Control groups limit how much CPU and memory the process can use. Capabilities and system call filters remove selected privileged operations.

All containers on a host share one kernel. Every system call a containerized process makes reaches the same kernel that runs the host. Sharing a kernel lets containers start quickly and use little memory, but creates a weakness when untrusted code can exploit a kernel bug.

A kernel exploit can let a container process escape to the host. Misconfiguration creates the same risk without a bug: privileged containers, broad capabilities and sensitive host mounts weaken the boundary. Containers provide packaging and resource limits; untrusted agent code may need a separate guest kernel.
