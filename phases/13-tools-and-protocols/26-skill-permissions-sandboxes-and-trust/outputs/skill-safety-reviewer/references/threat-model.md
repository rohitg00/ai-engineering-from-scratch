# Threat model

Review these boundaries independently:

- Authority: instructions cannot rewrite host permissions.
- Filesystem: resolve the target and keep it inside the workspace root; reject symlink escape.
- Commands: accept an argv array, deny shell metacharacters and destructive executables, and require an executable allowlist.
- Network: require HTTPS and an exact origin allowlist. Normalize the effective port, so `https://api.example.test` and `https://api.example.test:443` match while port `8443` needs its own entry. Do not accept credentials in URL userinfo.
- External content: treat retrieved text as data, never as policy or approval.
- Secrets: detect likely secret-bearing payloads without logging their values.
- Destructive actions: deny or require a recorded human approval according to host policy.

An `allow` verdict means only that the simulated request satisfies the supplied policy. This bundle does not execute any action.
