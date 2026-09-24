# Proving a Client's Identity to an Authorization Server

> An MCP client and the authorization server guarding a new server have usually never met, so before anything is authorized, the authorization server first has to decide whether it believes the client is who it claims to be.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 23
**Time:** ~45 minutes

## Learning Objectives

- Explain why MCP's interoperability promise means a client and an authorization server often have no pre-existing relationship, and how that shapes registration
- Apply the specification's four-path registration priority: pre-registered credentials, Client ID Metadata Documents, Dynamic Client Registration, and asking the user
- Validate a Client ID Metadata Document the way an authorization server must: an exact client_id match, an https URL with a path, and the required metadata fields
- Bind persisted client credentials to the authorization server that issued them, and explain why an authorization server change forces re-registration
- Recognize the confused deputy risk a static-client-id proxy creates, and choose between the OAuth Client Credentials and Enterprise-Managed Authorization extensions for unattended or enterprise access

## The Problem

The whole case for MCP rests on one idea: a client written today should be able to use a server it has never seen before, and a server written today should be usable by a client its author never heard of. That is exactly the scenario ordinary OAuth was not built for. OAuth 2.1 assumes a client registers with an authorization server ahead of time, gets back a client id, and reuses that id for every later request. Registering ahead of time is easy when one company writes the one mobile app that talks to its own authorization server. It is not easy when any MCP client someone builds might need to talk to any MCP server someone else runs, through whatever authorization server that server's operator happens to use.

The prior lesson covered the roles: the MCP server is an OAuth resource server, the MCP client is an OAuth client, and a separate authorization server issues tokens. This lesson covers the step that has to happen before any of that: how the client gets a client id the authorization server will accept in the first place, when the two sides may never have coordinated. Get this step wrong and the rest of the authorization flow never starts, an attacker who fakes a client identity gets a head start on impersonation, and a client that reuses the wrong credentials against the wrong authorization server hands out tokens that were never meant for it.

## The Concept

The specification gives a client exactly one priority order to follow, and the order matters because each option only makes sense once the one before it has failed: first, use pre-registered client information if the client already has it for this authorization server; second, use a Client ID Metadata Document if the authorization server advertises support for one; third, fall back to Dynamic Client Registration if the authorization server offers a registration endpoint; fourth, and only then, ask the person using the client to type in client information by hand.

**Pre-registration** is the simple case: a client developer hardcodes a client id for a specific, known authorization server, or a server operator hands a user a client id through a configuration screen after the user registers by hand. It works well when the two sides already know about each other, which is common for an enterprise's own internal servers but rare for the open ecosystem MCP was built for.

**Client ID Metadata Documents (CIMD)** are the answer for the common MCP case: no prior relationship at all. A CIMD client uses an HTTPS URL as its client id instead of an opaque string an authorization server issued. That URL, for example `https://app.example.com/oauth/client-metadata.json`, points at a JSON document the client hosts itself:

```json
{
  "client_id": "https://app.example.com/oauth/client-metadata.json",
  "client_name": "Example MCP Client",
  "client_uri": "https://app.example.com",
  "redirect_uris": ["http://127.0.0.1:3000/callback", "http://localhost:3000/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

When an authorization server sees a URL-shaped client id in an authorization request, it fetches that URL and treats the document as the client's registration. The document must contain at least `client_id`, `client_name`, and `redirect_uris`, and the authorization server must confirm the `client_id` field inside the document matches the URL it fetched, exactly. That equality check is what makes the URL a trustworthy identifier instead of a self-asserted claim: only whoever controls that HTTPS path can put a matching `client_id` at the end of it. The authorization server also validates every redirect URI in the authorization request against the ones listed in the document, and it should cache the fetched document respecting ordinary HTTP cache headers rather than fetching it on every login. A server that supports this path advertises it in its own metadata with `"client_id_metadata_document_supported": true`, which is exactly what a client checks before it tries a CIMD login.

Two risks come with fetching a client-supplied URL. The authorization server is making an outbound HTTP request based on attacker-reachable input, so it has to guard against server-side request forgery: validating the URL and the address it resolves to before fetching, limiting response size, and applying a timeout. And a CIMD client id cannot, by itself, stop someone from impersonating a legitimate client on `localhost`: an attacker can claim the real client's metadata URL and bind to the same loopback port, so the specification asks authorization servers to show extra warnings for localhost-only redirect URIs and to always display the redirect hostname during the consent screen. Despite those caveats, CIMD ids have a real advantage DCR ids never had: they are portable. Because the id is just a URL the authorization server resolves on demand, the same client id works unchanged across every authorization server the client ever talks to.

**Dynamic Client Registration (DCR)** is what MCP relied on before CIMD existed, and the specification now marks it deprecated, kept only so a client can still register with an authorization server that has not added CIMD support yet. A client that falls through to DCR sends its metadata to a `registration_endpoint` and gets back a freshly minted, authorization-server-specific client id. One detail still matters here for the exam: when an authorization server implements OpenID Connect on top of DCR, it can enforce different redirect URI rules depending on the `application_type` a client declares. A native application, meaning a desktop app, a mobile app, a CLI tool, or a locally hosted app reached through `localhost`, should declare `application_type: "native"`. A remote browser-based application should declare `"web"`. Leaving the field out defaults to `"web"` under OIDC, which is exactly wrong for a CLI tool redirecting to a loopback port, and the registration can be rejected as a result.

Whichever path produced them, persisted credentials belong to one authorization server, never to an MCP server or a deployment in the abstract. The specification requires a client to key stored credentials by the issuer that issued them, and it forbids reusing credentials from one authorization server against another. A client detects an authorization server change by watching the protected resource metadata for the MCP server it is calling: if that metadata now names a different authorization server, the old credentials are for the wrong issuer, and the client must re-register rather than silently trying them anyway. CIMD credentials mostly sidestep this problem, since the same URL-based id is valid everywhere; DCR credentials do not, since each authorization server minted its own id.

Registration identity also shapes a specific attack the specification calls out by name: the confused deputy problem. An MCP proxy that forwards many downstream, dynamically registered clients to a third-party authorization server using one shared, static client id can be tricked into forwarding an authorization code that belongs to a different downstream client than the one the user actually approved. The mitigation is procedural, not cryptographic: the proxy must obtain the user's consent for each dynamically registered downstream client individually before it forwards that client's request onward, rather than treating consent to the static client id as consent for every client hiding behind it.

Every path so far assumes a person is present to click approve. Two official authorization extensions cover the cases where that assumption breaks down, and both are negotiated exactly like any other MCP extension: a client declares support in `io.modelcontextprotocol/clientCapabilities.extensions` on each request, a server advertises its own support in the capabilities `server/discover` returns, and neither side is required to support them.

```json
{
  "io.modelcontextprotocol/clientCapabilities": {
    "extensions": {
      "io.modelcontextprotocol/oauth-client-credentials": {}
    }
  }
}
```

**OAuth Client Credentials** fits a background service, a CI pipeline, or a daemon that needs to call an MCP server on a schedule with nobody available to approve anything interactively. The client authenticates directly to the authorization server with its own credentials, either a JWT bearer assertion it signs itself, which the specification recommends because the signing key never has to leave the client, or a client secret sent to the token endpoint, which is simpler but is a long-lived credential that grants access to anyone who steals it. **Enterprise-Managed Authorization** fits the opposite shape of problem: an organization wants its own identity provider, not each individual MCP server's authorization server, to be the place that decides who can reach what. An employee signs into the MCP client with their normal corporate SSO session, the client exchanges that identity for a short-lived token called an ID-JAG from the enterprise identity provider, and it trades the ID-JAG for an MCP access token without ever redirecting the user to the MCP authorization server's own login page. Centralizing the decision there means an administrator revokes access once, at the identity provider, instead of hunting down every MCP client and server pairing an employee ever authorized individually.

```figure
mcpa-24-registration-paths
```

## Interactive Lab

The figure lays out the four-path priority order top to bottom, each box marked with the condition that has to hold before a client tries it, and an arrow labeled "if unavailable" showing where a client falls through to the next path. The third box, Dynamic Client Registration, is drawn with a dashed border to mark it deprecated, not removed: it still works, it is just no longer where a client should start. Beside the ladder, a small checklist repeats what an authorization server actually verifies about a Client ID Metadata Document and why credentials end up keyed by issuer rather than by server. Trace a client's decision through the boxes before you open the code: does it have something on file for this authorization server already, does the authorization server's own metadata mention CIMD support, does it expose a registration endpoint, or is asking a person the only option left.

## Practice Lab

Open `code/main.py`. It models three authorization servers with different capabilities: one advertises CIMD support, one only offers a DCR `registration_endpoint`, and one offers neither. `choose_registration_path` walks the same priority order as the concept section: run it against the first authorization server with an empty pre-registered store and it picks `cimd`; run it again with that authorization server's issuer already present in the pre-registered store and pre-registration wins instead, even though CIMD is available, exactly because pre-registration is checked first. The second authorization server has no CIMD support, so the planner falls back to `dcr` and marks the decision deprecated. The third has neither, so the planner reports `ask-user`.

```bash
python3 code/main.py
```

`validate_cimd` plays the authorization server's part when it receives a URL-shaped client id: it checks the URL uses https with a real path, checks the document contains `client_id`, `client_name`, and `redirect_uris`, checks the document's `client_id` matches the fetched URL exactly, and checks every redirect URI is https or a loopback address. Run the demo and compare four documents against it: one valid one passes with no problems, one has a `client_id` that does not match its own URL, one uses `http` instead of `https`, and one is missing `redirect_uris` entirely. `CredentialStore` then enforces authorization server binding: it registers credentials under the issuer that issued them, and calling `.use()` with a different issuer raises a `ValueError` naming exactly which issuer the credentials actually belong to. `ProxyConsentLedger` models the confused deputy mitigation as a small set of static-client-id and downstream-client-id pairs a proxy has explicit consent to forward; `may_forward` reports false until `record_consent` has been called for that exact pair. Finally, `recommend_auth_extension` picks between the two authorization extensions from a scenario description, and the demo's last exchange shows the registered `acme-ops-cli` client, already carrying a client-credentials token, sending a real `server/discover` and `tools/call` over the wire with the token noted in the request's HTTP headers, the same headers a Streamable HTTP request actually carries.

## Shipped Artifact

`outputs/client-registration-guide.md` is the one-page version: the priority order, the CIMD requirements an authorization server checks, the `application_type` rule, the authorization-server-binding rule, the confused deputy mitigation, and a table contrasting the two authorization extensions. Keep it next to you when you are deciding how a new MCP client should register itself.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: that pre-registered credentials win even when CIMD is advertised, that CIMD is chosen over a deprecated DCR fallback, that an authorization server with neither leaves the client asking the user, that a valid Client ID Metadata Document passes with no problems, that a client_id mismatch and an http-scheme client_id are each rejected with a specific reason, that a document missing a required field is rejected, that `application_type` comes out native for a loopback redirect and web for a remote one, that credentials registered for one issuer cannot be used against another, that a confused-deputy proxy cannot forward a downstream client until consent is recorded for that exact pair, that the two authorization extensions are recommended for the right scenario, and that the registered client's wire exchange carries its bearer token and the required HTTP headers. The repository's wire checker also validates the lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/24-client-registration-and-identity
```

## Capstone Connection

The capstone's end-to-end exchange includes an authorized call, and that call only has a token to present because some registration path from this lesson already ran: a pre-registered id, a fetched and validated CIMD, or, less often now, a DCR round trip. Whichever path the capstone's client took, its credentials should be sitting in a store keyed by issuer, the same shape `CredentialStore` builds here. The next lesson picks up right where this one stops: once a client has proven who it is, consent decides what it is actually allowed to do.

## Key Terms

| Term | Meaning |
|------|---------|
| Client registration | How an MCP client obtains a client id an authorization server will recognize before it requests a token |
| Client ID Metadata Document (CIMD) | An HTTPS document, self-hosted by the client at its client_id URL, that an authorization server fetches and validates on demand |
| Dynamic Client Registration (DCR) | The deprecated RFC 7591 registration-endpoint flow, kept for authorization servers that have not added CIMD support |
| Pre-registration | Client information established with an authorization server ahead of time, hardcoded or entered by a person |
| Authorization server binding | Persisted client credentials keyed by the issuer that issued them, never reused against a different authorization server |
| application_type | The DCR parameter, native or web, that tells an OIDC authorization server what redirect URI shape to expect |
| Confused deputy | A proxy using one static client id on behalf of many downstream clients without per-client consent |
| Authorization extension | An opt-in, negotiated mechanism that changes how a client obtains a token, such as OAuth Client Credentials or Enterprise-Managed Authorization |

## Further Reading

- [MCP specification 2026-07-28: Client Registration](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/client-registration)
- [MCP specification 2026-07-28: Authorization Security Considerations](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations)
- [MCP Authorization Extensions overview](https://modelcontextprotocol.io/extensions/auth/overview)
- [OAuth Client Credentials extension](https://modelcontextprotocol.io/extensions/auth/oauth-client-credentials)
- [Enterprise-Managed Authorization extension](https://modelcontextprotocol.io/extensions/auth/enterprise-managed-authorization)
- [SEP-991: Enable URL-based Client Registration using OAuth Client ID Metadata Documents](https://modelcontextprotocol.io/seps/991-enable-url-based-client-registration-using-oauth-c)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 12
