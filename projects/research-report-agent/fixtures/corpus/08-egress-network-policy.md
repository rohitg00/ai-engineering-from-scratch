title: Default-deny egress for agent sandboxes
source_url: https://www.rfc-editor.org/rfc/rfc4949
published: 2026-09-28

Network egress is traffic a sandbox sends out. If an agent can reach any internet host, an injected instruction can upload files to an attacker. File system isolation does not stop data leaving through a permitted network connection.

Default-deny egress uses an allowlist of destinations such as a package registry and a model API. Every other destination is blocked and logged. A policy is effective only when the network layer actually enforces it.

Broad destinations such as a whole cloud provider can still allow exfiltration. Narrow allowlists reduce exfiltration opportunities. A complete policy also considers address changes, redirects and services that relay requests to other destinations.
