title: A secrets proxy keeps credentials out of the agent
source_url: https://www.rfc-editor.org/rfc/rfc9700
published: 2026-09-28

An agent may need credentials to call an API or fetch a repository. Placing API keys inside the sandbox lets an injected instruction print, log or transmit them. Any secret the process can read is exposed to the process authority.

A secrets proxy keeps the credential outside the sandbox. The agent sends a request without a secret; the proxy validates the destination, adds the credential and forwards the request. The agent never sees the real key.

The proxy can restrict a token to named hosts, record every use and revoke access in one place. Combined with default-deny network egress, a secrets proxy reduces what the agent can reach and leak. The proxy must also reject redirects that would carry credentials to another host.
