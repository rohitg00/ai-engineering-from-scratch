title: A microVM monitor creates lightweight virtual machines
source_url: https://www.kernel.org/doc/html/latest/virt/kvm/api.html
published: 2026-09-28

A microVM monitor creates lightweight virtual machines using hardware virtualization. The monitor controls a deliberately small set of virtual devices and delegates guest execution to a kernel virtualization interface.

Each microVM runs its own guest kernel. A process inside the microVM talks to that guest kernel rather than the host kernel. A guest kernel exploit therefore does not directly grant host access, although the monitor and virtualization layer remain part of the attack surface.

The small device model exposes only a few emulated devices such as network and block devices. A platform can create one microVM per agent session and destroy the session after a task. This separate kernel boundary costs more memory than sharing the host kernel.
