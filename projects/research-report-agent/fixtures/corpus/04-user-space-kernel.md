title: A user-space kernel intercepts system calls
source_url: https://www.kernel.org/doc/html/latest/userspace-api/seccomp_filter.html
published: 2026-09-28

A user-space kernel implements an application kernel between a sandboxed process and the host. An interceptor handles the system calls that the application makes, so many application requests do not reach the host kernel directly.

The application kernel exposes a restricted runtime interface. The interceptor uses a limited set of host system calls and reduces the host attack surface. Reducing host calls changes which kernel operations an untrusted process can reach.

The cost is performance for some workloads. Applications that make many system calls or perform heavy file and network input and output pay for translation. Workloads that mostly compute are affected less. A user-space kernel is a middle point between a plain container and a full virtual machine.
