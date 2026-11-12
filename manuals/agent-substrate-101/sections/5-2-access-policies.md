# Access policies per atespace

> An access policy grants one of three roles on one atespace, and the atespace is the smallest unit that Substrate can protect.

Two teams share a cluster. Team A must not suspend, read, or copy the actors of team B. You look for a way to grant access to one actor or one template, and the API has none. The unit of access is the atespace, and that fact shapes how you divide your work.

When you finish this section, you can write an access policy, say what each role allows, and name the things that a policy cannot separate.

We ran no access policy commands in our test runs, because every run used the default owner. The rules below come from the code and the documentation at v1.0.0. Three observations from our runs are marked.

## How a call is checked

`ate-api-server` checks every call in two steps {{docs}}. Authentication turns the credential into a principal, as [client authentication](#s-client-authentication) describes. Authorization then allows the call in one of three cases:

- the principal is a bootstrap owner
- an access policy gives the principal a role that permits the call
- the caller is a Substrate component with the system role that the call needs

In every other case the call fails with `PermissionDenied`. Authorization cannot be turned off. The model runs inside `ate-api-server` on an embedded OpenFGA engine, and it stores its data in the same Postgres database as the actors.

**Access policy:** the list of role bindings for one scope. Each scope has exactly one policy, and its name is `default`.

```figure
id: fig-5-2
kind: tree
title: two scopes of access policy, and the roles of each
claim: A role on the global scope holds in every atespace, and a role on one atespace holds only there.
caption: Read from the top down. Blue boxes are the scopes that a policy can cover. The dashed box holds the system roles, which come from pod certificates. The atespace names are examples. From docs/guides/authorization.md and cmd/ateapi/internal/authz/model.fga at v1.0.0.
```

## Two scopes, five roles

A policy covers the global scope or one atespace. The global scope has two roles and an atespace has three. Roles inherit: an owner is also an editor, and an editor is also a viewer.

| Role | Can do | Cannot do |
|---|---|---|
| global owner | all of the rows below, create atespaces, manage workers | mint an actor JWT |
| global viewer | read every atespace, list workers | change anything |
| atespace owner | all that an editor can, write the policy of the atespace, delete the atespace | touch another atespace |
| atespace editor | create, resume, suspend, revert and delete actors, write templates, egress policies and tags | change the policy |
| atespace viewer | read actors, templates, tags, egress policies and the policy | change anything |

Workers have no atespace. Only a global role can list them, so a team with an atespace role cannot run `kubectl ate get workers`.

## Bootstrap owners

**Bootstrap owner:** a principal from the server flag `--authz-bootstrap-owners` that always holds the global owner role, whatever the policies say.

The server reads the list at startup and does not start with an empty list {{docs}}. With `ate-setup`, the default is the shared ServiceAccount `ate-client`, and the installer prints a warning about it. The kagent distribution of Substrate adds its own controller to the list. We read this argument from the `ate-api-server` Deployment of our kagent cluster {{run}}:

```listing
title: the bootstrap owners in a kagent install
source: capture/lab/K-kagent/inventory/deploy-ate-api-server.yaml
lang: yaml
note: One argument of the ate-api-server container.
---
        - --authz-bootstrap-owners=spiffe://cluster.local/ns/kagent/sa/kagent-controller,system:serviceaccount:ate-system:ate-client
```

Two principals own that install. The first is the pod certificate of the kagent controller. The second is still `ate-client`, so the warning from [client authentication](#s-client-authentication) applies to a kagent install as well.

For a shared cluster, set the list to the principals of your operators and keep it short. Grant daily administrators the global owner role in the global policy. You can remove a role in a policy through the API. You can remove a bootstrap owner only with a restart of the server.

## Write a policy

A policy is a short manifest. This one gives a ServiceAccount named `alice` the editor role and a second one the viewer role.

```yaml
metadata:
  name: default
bindings:
- role: editor
  members:
  - user:system:serviceaccount:ate-users:alice
- role: viewer
  members:
  - user:system:serviceaccount:ate-users:bob
```

A member is the principal with the prefix `user:`. The four commands follow the pattern of the other `kubectl ate` objects:

```bash
kubectl ate create access-policy -a team-a -f policy.yaml
kubectl ate get access-policy -a team-a -o yaml > current.yaml
kubectl ate update access-policy -a team-a -f current.yaml
kubectl ate delete access-policy -a team-a
```

Use `--global` in place of `-a` for the global policy. Four rules save you a failed command {{code}}:

- A global policy accepts `owner` and `viewer`. An atespace policy also accepts `editor`.
- `update` replaces the whole policy. It needs the `metadata.uid` and `metadata.version` that `get -o yaml` prints, and it fails if the policy changed after your `get`.
- You cannot delete the global policy. Update it with no bindings.
- A change applies to the next call.

Egress policies follow the same `update` rule. Our first `update egress-policy` failed until the manifest carried both fields {{run}}.

When a call is denied, the error names the principal with each colon written as `%3A` {{docs}}. Decode it before you paste it into a policy.

## What a policy cannot separate

The atespace is the only boundary. Five limits follow, and you must design around each of them {{docs}}.

- **No grant for one actor or one template.** An editor of an atespace can change every actor in it.
- **No groups.** A member is one principal. A team of ten needs ten members.
- **An editor can copy an actor.** A tag is a copy of the memory and the disk of an actor, with every secret in it. Any editor can create a tag and start a new actor from it.
- **Names carry the grants.** If you delete an atespace and create one with the same name, a late request for the old one can apply to the new one. Never use an atespace name two times. [Atespaces and names](#s-atespaces) explains the naming rules.
- **The router does not read policies.** A client on the list of the router reaches actors in every atespace.

Our kagent run adds a practical case {{run}}. kagent put every session of every agent into one atespace named `kagent`. In that install, Substrate policies cannot keep two kagent users apart. That job belongs to kagent.

## System roles

The components of Substrate hold roles that no policy can grant. Each role is bound to the pod certificate of one component by a flag of `ate-api-server` {{docs}}.

| Role | Held by | Allows |
|---|---|---|
| `ingress_router` | `atenet-router` | resume any actor, list actors in all atespaces |
| `egress_gateway` | `atenet-egress` | read actors and egress policies, mint actor JWTs |
| `atelet` | `atelet` on every node | read the egress policy of any actor |
| `controller` | `ate-controller` | create, update and drain workers |

Two rows deserve a second look. The router can resume every actor, which is why the list of the router in [client authentication](#s-client-authentication) matters so much. And only the egress gateway can mint an actor JWT. A global owner cannot, because the token lets its holder act as the actor. [Actor JWTs](#s-actor-jwts) follows that token.

## Our position

Use one atespace for each group of people that must not read the others' actors, and accept that this is the only line you get. Replace the default bootstrap owner before a second person uses the cluster. Do not count on Substrate to separate the end users of your product. Your own service has to do that, in front of both the API and the router.

```takeaways
- Divide teams by atespace, because no smaller grant exists.
- Replace ate-client as bootstrap owner before you share a cluster.
- Run get -o yaml before every update, and keep metadata.uid and metadata.version.
- Give the editor role only to people who are allowed to copy every actor in the atespace.
- Never create an atespace with a name that you used before.
```

Sources: capture/lab/K-kagent/inventory/deploy-ate-api-server.yaml, capture/lab/K-kagent/session1/actors-after-create.json, capture/lab/A-quickstart/22-deploy-ate-system-retry.log, capture/lab/F-egress/envoy/19-first-run-update-refused.txt; docs/guides/authorization.md, docs/guides/authentication.md at v1.0.0; cmd/kubectl-ate/internal/cmd/access_policy.go, cmd/ateapi/internal/authz/registry.go, cmd/ateapi/internal/authz/model.fga, api/ateapi/v1/ateapi.proto (AccessPolicy) at v1.0.0.
