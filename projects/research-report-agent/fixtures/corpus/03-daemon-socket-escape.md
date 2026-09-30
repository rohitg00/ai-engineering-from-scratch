title: Why mounting the daemon socket gives away the host
source_url: https://www.rfc-editor.org/rfc/rfc3552
published: 2026-09-28

A privileged container daemon listens on a local socket, for example /var/run/container.sock. Any process that can write to this socket can ask the daemon to start new containers with host mounts. Control of a privileged daemon can grant root access on the host.

Agent setups sometimes mount the socket into a container to build images or test sibling containers. An agent that finds the socket can start a privileged container and read or change files on the host. The socket turns a narrow process boundary into access to the daemon authority.

The safe default is to avoid mounting the host daemon socket into an untrusted agent. A separate virtual machine can run its own daemon with a separate guest kernel. Isolation is only as strong as the most powerful interface exposed inside it.
