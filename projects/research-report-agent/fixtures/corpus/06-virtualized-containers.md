title: Virtualized containers run workloads in separate guests
source_url: https://www.kernel.org/doc/html/latest/virt/kvm/api.html
published: 2026-09-28

Virtualized containers place a container workload inside a lightweight virtual machine. A runtime preserves the familiar container interface while adding a hardware virtualization boundary underneath it.

A scheduler selects the virtualized runtime for workloads that execute untrusted code. Each workload receives a separate guest kernel while trusted workloads can continue to use ordinary containers. The runtime can use several hypervisors underneath.

The tradeoff is overhead. A virtual machine per workload uses more memory and starts more slowly than a plain container. Teams reserve the stronger boundary for code that needs it and measure startup latency before choosing a runtime.
