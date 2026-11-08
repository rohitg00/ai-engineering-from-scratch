<!-- vendored source: Docker Sandboxes API and SDK docs (extra); origin https://docs.docker.com/ai/sandboxes-api/; fetched 2026-10-08; each page is the raw markdown served at the page URL with .md appended; page text is verbatim, only the page marker lines are added -->

<!-- page: https://docs.docker.com/ai/sandboxes-api/ fetched 2026-10-08 -->

# Docker Sandboxes API and SDK


> [!NOTE]
> The Docker Sandboxes API and SDK are experimental. Features, interfaces,
> and behavior may change.

Use the Docker Sandboxes API to create cloud sandboxes, run commands, and
transfer files from your applications and automated workflows. You can also
manage related resources, including images, snapshots, volumes, and secrets.

To try it, [run your first cloud sandbox](/ai/sandboxes-api/get-started/) with the TypeScript
SDK. The tutorial uses a bundled kit that supplies a shell environment for
running commands.

## Activate cloud access

To use the API or SDK, [activate a Docker Agentic Platform subscription](/agentic-platform/signup/#activate-cloud-access).
Use the same Docker account to [authenticate your application](/ai/sandboxes-api/authentication/).

Cloud compute is billed separately from your Docker subscription. See
[Billing](/agentic-platform/signup/#billing) for details.

## Choose an interface

Use the TypeScript SDK in your JavaScript or TypeScript application. The SDK
provides typed requests and responses, waits for sandboxes to start or stop,
and handles file transfers and interactive processes.
See [Install the SDK](/ai/sandboxes-api/install/) for installation instructions.

You can also call the REST API directly from any language or HTTP tool.
See the [API reference](/reference/api/sandboxes/latest/) for operations,
request fields, responses, and the downloadable OpenAPI specification.

To run agents from your terminal, see [Docker Sandboxes](/ai/sandboxes/).

## Develop your application

- [SDK cookbook](/ai/sandboxes-api/cookbook/): follow examples for processes, files,
  storage, networking, and other sandbox operations.
- [API concepts](/ai/sandboxes-api/concepts/): choose a kit or image, identify resources, and
  wait for actions to finish.
- [Authentication and authorization](/ai/sandboxes-api/authentication/): authenticate requests
  and understand which permissions your application needs.
- [Errors and retries](/ai/sandboxes-api/errors/): handle failures and retry requests without
  duplicating work.
- [Compute sizes and limits](/ai/sandboxes-api/limits/): choose resources and handle account
  quotas and request rate limits.

<!-- page: https://docs.docker.com/ai/sandboxes-api/authentication/ fetched 2026-10-08 -->

# Authentication and authorization


> [!NOTE]
> The Docker Sandboxes API and SDK are experimental. Features, interfaces,
> and behavior may change.

Use browser sign-in when running an application interactively, or a personal
access token (PAT) for automation. The SDK obtains short-lived access tokens
and renews them as needed.

You need an active [Docker Agentic Platform subscription](/agentic-platform/signup/#activate-cloud-access).
Authenticate with the Docker account you used to subscribe.

## Sign in through your browser

Use the OAuth helper to sign in with your Docker account:

```typescript
import { oauth, Sandboxes } from '@docker/sandboxes';

const auth = oauth({
  onVerification({ verificationUriComplete, verificationUri, userCode }) {
    console.log(`Open ${verificationUriComplete ?? verificationUri}`);
    console.log(`Verification code: ${userCode}`);
  },
});
await auth.getAccessToken();
const client = new Sandboxes({ auth });
```

Open the printed URL and complete sign-in. Browser sign-in supports single
sign-on and two-factor authentication. The `getAccessToken()` call waits for
you to finish before the program continues.

The SDK keeps credentials in memory and refreshes them while your application
runs. With the default configuration, you sign in again each time you start
the application. SDK sign-in is separate from `docker login` and `sbx login`.

## Authenticate automation with a PAT

Use a [personal access token](/security/access-tokens/personal-access-tokens/)
for CI jobs and unattended applications. When creating the token, select the
`sandbox:use` permission in your Docker account's personal access token
settings. Registry permissions alone don't grant Cloud Sandboxes access.

Provide your Docker ID and PAT to the SDK. For example, read them from your
application's environment:

```typescript
import { pat, Sandboxes } from '@docker/sandboxes';

const username = process.env.DOCKER_ID;
const personalAccessToken = process.env.DOCKER_PAT;
if (!username || !personalAccessToken) {
  throw new Error('Set DOCKER_ID and DOCKER_PAT');
}

const client = new Sandboxes({
  auth: pat({ username, personalAccessToken }),
});
```

The SDK exchanges the PAT for a short-lived access token and repeats the
exchange when needed. If the PAT is invalid or revoked, authentication fails.

Store the PAT in your CI or application's secret store and keep it out of
source control and logs.

## Authenticate agents

An AI agent needs credentials for its model provider in addition to your
Docker sign-in. For example, Claude Code can use an Anthropic API key, and
Codex can use an OpenAI API key.

Store the provider key as a secret and attach it when creating the sandbox.
For example, with an authenticated `client` and an Anthropic API key in
`providerKey`:

```typescript
const secret = await client.secrets.create({
  displayName: 'anthropic-key',
  serviceType: 'anthropic',
  token: { value: providerKey },
});

const sandbox = await client.kits.launchAndWait('claude', {
  storage: { secrets: [secret.name] },
});
```

The secret is attached before the agent runs. Keep the key out of command
arguments, source files, and plain environment variables inside the sandbox.

## Resource access and permissions

Your credentials determine which account's resources you can access. Cloud
uses them to identify the account, so leave the optional `parent` field empty
in requests.

Each request also checks whether you have permission for the action on the
target resource. For example, creating a sandbox requires `sandboxesCreate`,
reading it requires `sandboxesRead`, and deleting it requires
`sandboxesDelete`.

Account permissions also control access to optional features. See
[Supported Cloud options](/ai/sandboxes-api/authentication/concepts/#choose-supported-cloud-options).

## Authenticate direct API requests

If you call the REST API without the SDK, obtain and renew access tokens in
your application. Exchange your Docker ID and a PAT with `sandbox:use`
permission using the [Docker Hub authentication API](/reference/api/hub/latest/operations/AuthCreateAccessToken/):

```console
$ ACCESS_TOKEN=$(curl --silent --show-error --fail --request POST \
  --url https://hub.docker.com/v2/auth/token \
  --header "Content-Type: application/json" \
  --data '{"identifier":"<DOCKER_ID>","secret":"<PERSONAL_ACCESS_TOKEN>"}' \
  | jq -er '.access_token')
```

Send the returned access token in the `Authorization` header when calling
`https://connect.docker.com/sandboxes`:

```http
Authorization: Bearer <access_token>
```

The Sandboxes API accepts the access token returned by the exchange, not the
PAT itself.

If you manage access tokens but use the SDK for requests, import `bearer` from
`@docker/sandboxes` and configure the client with `auth: bearer(accessToken)`.
Create a client with a fresh token when the previous token expires.

## Authenticate sandbox requests

The SDK handles authentication when you run commands or transfer files using
a sandbox's methods. It obtains a token scoped to that sandbox and the
operation, then reuses or renews the token as needed.

For example, running a command requires `sandboxesExec` and obtaining its
token requires `sandboxesCredential`. Your account must have both permissions.

If you call a sandbox endpoint directly, use a token issued for that sandbox.
Don't send the Docker Hub token used for management requests to a sandbox
endpoint. See [Management and sandbox endpoints](/ai/sandboxes-api/authentication/concepts/#management-and-sandbox-endpoints).

<!-- page: https://docs.docker.com/ai/sandboxes-api/concepts/ fetched 2026-10-08 -->

# Docker Sandboxes API concepts


> [!NOTE]
> The Docker Sandboxes API and SDK are experimental. Features, interfaces,
> and behavior may change.

An application uses the Docker Sandboxes API to create sandboxes, connect to
them, and track their state. Choose the environment for your sandbox, then
learn how to work with its resources throughout their lifecycle.

## Kits and sandbox images

A sandbox kit defines an environment for an agent or tool, including its
image, setup, network rules, and credential requirements. The SDK bundles a
catalog of kits you can launch by name. Using kits from other sources
requires preparing their content for the API.

You can also create a sandbox from a container image. Choose the source based
on how much of the environment you want to configure yourself:

| Source | What it provides | How to create a sandbox |
| --- | --- | --- |
| [Bundled kit](#bundled-kits) | An image reference and configuration included in the SDK's catalog | `client.kits.launch('shell')` |
| Custom kit | An environment defined by a kit you obtain separately | `client.create()` with [prepared kit artifacts](#supply-kit-artifacts) |
| Registry image (`imageRef`) | A container image to use with your own sandbox settings | `client.create({ imageRef: 'ubuntu:24.04', resources: 'small' })` |
| Image resource (`image`) | An image already prepared for Cloud Sandboxes, including its compute settings | `client.create({ image: 'images/<uid>' })` |

The `imageRef` value is an image name in a registry. The `image` value is a
resource name returned by the Sandboxes API. When you use `image`, omit
`resources` because the image resource supplies its compute settings.

These creation methods don't wait for the sandbox to be running. See
[Wait for an action to finish](#wait-for-an-action-to-finish) before running
commands.

### Bundled kits

The npm package includes the following kit definitions and supporting files.
Launch a bundled kit by its short name, such as `shell`:

| Kit name | Environment |
| --- | --- |
| `shell` | A shell environment for running your own commands |
| `claude` | Claude Code |
| `codex` | Codex |
| `cursor` | Cursor |
| `devin` | Devin |
| `docker-agent` | Docker Agent |
| `gemini` | Gemini CLI |
| `opencode` | OpenCode |

For example, `client.kits.launchAndWait('shell')` creates a shell sandbox and
waits until it's running. The kit launch helpers default to `small` compute,
with two CPUs and 4 GiB of memory. See [Compute sizes](/ai/sandboxes-api/concepts/limits/#compute-sizes)
to choose a different size.

Bundled kits are tied to the SDK release. Call `client.kits.list()` to see
the catalog in your installed version. The kit definitions are included in
the npm package, so the SDK doesn't download them from a registry. Cloud
Sandboxes pulls their referenced container images as needed.

To run an AI agent, provide credentials for its model provider, such as an
Anthropic API key for Claude Code. See
[Authenticate agents](/ai/sandboxes-api/concepts/authentication/#authenticate-agents). The `shell` kit
needs no provider key to run commands.

## Resource names

Use a resource's returned `name` to refer to it in later requests. A sandbox
name has the form `sandboxes/<uid>`. Pass the complete name, including the
`sandboxes/` prefix, when reading or deleting it.

The server assigns the name, which stays the same throughout the resource's
lifetime. The optional `displayName` is a label you can change without
changing the resource's identity.

## Wait for an action to finish

Wait until a sandbox is running before sending commands to it. In the SDK,
`client.kits.launchAndWait()` creates a bundled kit's sandbox and waits for it
to run. If you use `client.create()` or `client.kits.launch()`, call
`waitUntilRunning()` on the returned sandbox and use the result to run commands.

For direct API requests, HTTP 202 means the action was accepted and is still
in progress. Read the resource repeatedly until it reaches the state you need.

Sandbox creation can continue after your client stops waiting. Read the
sandbox again to check its state, and inspect its `failure` field if it has
failed. See [Errors and retries](/ai/sandboxes-api/concepts/errors/) for how to recover.

Deletion can also take time. The API returns HTTP 202 while the sandbox is
being deleted and HTTP 204 when deletion is complete. After deletion,
authorized reads return `notFound`.

### Wait for kit setup

`waitUntilRunning()` and `kits.launchAndWait()` wait for the sandbox to reach
the `running` state. Kit setup commands, such as installing tools or cloning
a repository, can still be running at that point.

The SDK doesn't provide a helper that waits for all kit setup to finish. If
your application depends on that setup, add a readiness check before starting
its work. What you check depends on the kit and the task—for example, a
completion marker written after a repository clone finishes, or a successful
health check from a service.

Poll with a delay between checks and a timeout so your application stops
waiting if setup fails.

## Management and sandbox endpoints

Creating a sandbox and running a command inside it use different endpoints:

| Endpoint | Use it to |
| --- | --- |
| Management API at `https://connect.docker.com/sandboxes` | Create, inspect, and delete sandboxes and manage related resources. |
| Sandbox API at the returned `core.endpoint.uri` | Run processes and read or write files inside that sandbox. |

The SDK builds request URLs from these base URLs. If you make HTTP requests
directly, append the `/v1` route to the base URL, preserving any existing path.
For example, the management route `/v1/sandboxes` becomes
`https://connect.docker.com/sandboxes/v1/sandboxes`.

Each sandbox endpoint requires a token that grants access to that sandbox.
The SDK obtains this token when you use a sandbox's process or file methods. See
[Authentication and authorization](/ai/sandboxes-api/concepts/authentication/) for details.

A sandbox's endpoint can change when its runtime changes. Read the sandbox
resource again before reconnecting to get its endpoint.

## Read all results from a list

List requests return one page of results at a time. To retrieve the next page,
pass the response's `nextPageToken` as the next request's `pageToken`. Keep the
same page size, filter, and ordering. Continue until `nextPageToken` is empty,
even if a page contains fewer items than you requested.

The default page size is 25 for Cloud sandbox, image, snapshot, volume, and
secret lists. You can request up to 100 items per page.

## Choose supported Cloud options

Cloud supports kits, sandbox timeouts, stored secrets, and volume attachments,
subject to account permissions and feature availability. For example, volume
access must be enabled for your account. An SDK method's presence doesn't
guarantee that your account can use it.

## Supply kit artifacts

To use a kit outside the bundled catalog, your application must load and
prepare its content before calling `client.create()`. The npm SDK doesn't
fetch kits from a registry. Its `kits.launch()` and `kits.launchAndWait()`
helpers accept only bundled kit names.

For example, the [Hermes agent kit](https://hub.docker.com/r/sbx/hermes-agent-kit)
is published as `docker.io/sbx/hermes-agent-kit:latest`. To use it through the
SDK, you need code outside the SDK that loads the kit definition and its
supporting files into the serialized
[v2 artifact format](https://github.com/docker/sbx-kits-contrib/blob/v0.17.0/spec/types.go)
accepted by the API.

The kit artifacts described here use the v2 format. The `kits` array contains
a sandbox kit and any mixins that add configuration to it. See the
[v2 kit reference](/ai/sandboxes-api/sandboxes/customize/kits-v2/) for details. The bundled
launch helpers prepare this same input for the kits in their catalog.

Pass the kit's source reference and prepared artifact bytes to
`client.create()`:

```typescript
function createFromKit(reference: string, artifactBytes: Uint8Array) {
  return client.create({
    resources: 'small',
    kits: [
      {
        artifact: {
          ref: { ref: reference, kind: 'sandbox' },
          inline: artifactBytes,
        },
      },
    ],
  });
}
```

The `ref` identifies the kit's source. It doesn't trigger a registry pull.
The `inline` value contains the serialized artifact as a `Uint8Array`,
including the kit's file content. Raw `spec.yaml`, ZIP files, and OCI manifests
aren't valid inputs for this field.

To launch a public kit by registry reference without writing loading code,
use the [Docker Agentic Platform Console](/agentic-platform/kits/#run-a-kit-by-reference).

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/ fetched 2026-10-08 -->

# Docker Sandboxes SDK cookbook


Use these recipes to add file transfers, processes, storage, and other sandbox
operations to your application. Each recipe shows the relevant SDK calls and
an expandable complete TypeScript example.

Start with [Get started](/ai/sandboxes-api/get-started/) to run your first sandbox, or
[install the SDK](/ai/sandboxes-api/install/) to use these examples in an existing project.
For HTTP operations and request fields, see the
[API reference](/reference/api/sandboxes/latest/).

## Get started

Authenticate and launch a kit before exploring individual SDK operations.


- [Authenticate to Docker](https://docs.docker.com/ai/sandboxes-api/cookbook/connect-to-cloud-with-a-bearer-token/): Sign in interactively, use a Docker personal access token, or supply an access token from your application.

- [Run a complete example](https://docs.docker.com/ai/sandboxes-api/cookbook/run-a-complete-example/): Sign in, launch the shell kit, print a greeting, and clean up with one runnable program.

- [Create your first sandbox](https://docs.docker.com/ai/sandboxes-api/cookbook/create-your-first-sandbox/): Launch a kit, run a command in its sandbox, and inspect the result.

- [Run agents with kits](https://docs.docker.com/ai/sandboxes-api/cookbook/add-tools-with-kits/): Discover the available kits, launch an agent sandbox, and run work inside it.

- [Run your first command](https://docs.docker.com/ai/sandboxes-api/cookbook/run-your-first-command/): Connect to a running sandbox, run a command in it, and tell a command that exited unsuccessfully apart from a call that failed.

- [Delete a cloud sandbox](https://docs.docker.com/ai/sandboxes-api/cookbook/delete-a-cloud-sandbox/): Delete a sandbox you have read back and wait until it is gone, with the option to override a refusal based on its current state.



## Working in a sandbox

Use a running sandbox for commands, project files, and web applications.


- [Run an interactive shell in a cloud sandbox](https://docs.docker.com/ai/sandboxes-api/cookbook/run-an-interactive-shell-in-a-cloud-sandbox/): Start a shell on a pseudo-terminal, send it input and read its output over one connection, connect again and pick up the output the service kept, and stop it.

- [Copy a file into a cloud sandbox](https://docs.docker.com/ai/sandboxes-api/cookbook/copy-a-file-into-a-cloud-sandbox/): Create a directory inside a running cloud sandbox, write one file into it from memory, and read the size the write reports back.

- [Read files out of a sandbox](https://docs.docker.com/ai/sandboxes-api/cookbook/read-files-out-of-a-sandbox/): List a directory in a running cloud sandbox, download files from it into memory, then move or remove paths inside it.

- [Expose a port from a cloud sandbox](https://docs.docker.com/ai/sandboxes-api/cookbook/expose-a-port-from-a-cloud-sandbox/): Publish a TCP port that a program inside a cloud sandbox listens on, read back the URL that reaches it, list the sandbox's published ports, and withdraw the publication.

- [Stop and restart a sandbox](https://docs.docker.com/ai/sandboxes-api/cookbook/stop-and-restart-a-sandbox/): Stop a running sandbox without deleting it, wait for the stop to settle, and start the same sandbox again when you need it.

- [What your workload starts with](https://docs.docker.com/ai/sandboxes-api/cookbook/what-your-workload-starts-with/): Read the environment variables every command in a sandbox starts with, and see which source wins when two of them set the same name.

- [Run something that produces real output](https://docs.docker.com/ai/sandboxes-api/cookbook/run-something-that-produces-real-output/): Choose between a call that returns a command's captured output when it finishes and a process whose output you read while it runs.



## Packaging and state

Keep an environment or its state for later work.


- [Register and manage an image](https://docs.docker.com/ai/sandboxes-api/cookbook/register-and-manage-an-image/): Register an image with Cloud Sandboxes, get the target to push its content to, check when it is ready, list your images, and delete one you no longer need.

- [Snapshot and fork a sandbox](https://docs.docker.com/ai/sandboxes-api/cookbook/snapshot-and-fork-a-sandbox/): Capture the state of a running sandbox as a snapshot, then start a new sandbox from that snapshot.



## Security and policy

Give agents the access they need without embedding credentials in application code.


- [Control what a sandbox can reach](https://docs.docker.com/ai/sandboxes-api/cookbook/control-what-a-sandbox-can-reach/): Attach your account's network policies to a new sandbox, read the policy the service enforces, and review which destinations it allowed or blocked.

- [Manage cloud secrets](https://docs.docker.com/ai/sandboxes-api/cookbook/manage-cloud-secrets/): Store a token as a stored secret, list your secrets' metadata, replace the token, and delete the secret.

- [Give a sandbox an MCP gateway](https://docs.docker.com/ai/sandboxes-api/cookbook/give-a-sandbox-an-mcp-gateway/): Configure MCP tools when launching a kit, then inspect, authorize, and manage the gateway.

- [Add a Docker credential for cloud sandboxes](https://docs.docker.com/ai/sandboxes-api/cookbook/add-a-docker-credential-for-cloud-sandboxes/): Exchange a Docker OIDC identity token for a credential that the service stores for your sandboxes to use.

- [Get a stored secret into a sandbox](https://docs.docker.com/ai/sandboxes-api/cookbook/get-a-stored-secret-into-a-sandbox/): Store a credential once, then pass its resource name when creating a sandbox so the sandbox starts with that secret attached.

- [Manage network policies](https://docs.docker.com/ai/sandboxes-api/cookbook/manage-network-policies/): Create, read, update, and delete personal network policies through the SDK.



## Connect and configure

Choose a different image, control lifetime, or connect additional storage and clients.


- [Run your own container image](https://docs.docker.com/ai/sandboxes-api/cookbook/run-your-own-container-image/): Start a sandbox from a container image in a registry you name, instead of from a managed image.

- [Keep a cloud sandbox running](https://docs.docker.com/ai/sandboxes-api/cookbook/keep-a-cloud-sandbox-running/): Choose a sandbox's lifetime and what happens when it ends, then renew the lifetime before the deadline passes.

- [Attach persistent storage](https://docs.docker.com/ai/sandboxes-api/cookbook/attach-persistent-storage/): Create a volume, mount it into a new sandbox so its data outlives the sandbox, and delete the volume when you no longer need it.

- [Get an SSH certificate](https://docs.docker.com/ai/sandboxes-api/cookbook/get-an-ssh-certificate/): Have the service sign your SSH public key for one sandbox and return the host, port, username, and host keys your SSH client needs.

- [Get image pull URLs](https://docs.docker.com/ai/sandboxes-api/cookbook/get-image-pull-urls/): Get the manifest details and short-lived download URLs for a managed image so a registry tool can pull its contents.

- [Let a stopped sandbox resume on demand](https://docs.docker.com/ai/sandboxes-api/cookbook/let-a-stopped-sandbox-resume-on-demand/): Choose at creation whether a stopped cloud sandbox starts itself when a request arrives at one of its published ports, then read back the setting in force.



## Requests and responses

Handle request options and failures deliberately.


- [Handle errors and degradation](https://docs.docker.com/ai/sandboxes-api/cookbook/handle-errors-and-degradation/): Tell an API refusal, a failed sandbox transition, and a nonzero command exit apart, and read the code and details each one carries.

- [Retry without creating duplicates](https://docs.docker.com/ai/sandboxes-api/cookbook/retry-without-creating-duplicates/): Retry a sandbox or process create under one request ID so a failure you can't interpret never leaves two copies behind.

- [Page through and filter lists](https://docs.docker.com/ai/sandboxes-api/cookbook/page-through-and-filter-lists/): Walk every page of a list with the SDK's iterators, and narrow a list on the server with a filter and an ordering.

- [Send values the API accepts](https://docs.docker.com/ai/sandboxes-api/cookbook/send-values-the-api-accepts/): Build a create request whose durations, counts, and flags mean what you intend, then read back the values the service settled on.

- [Work within the limits](https://docs.docker.com/ai/sandboxes-api/cookbook/work-within-the-limits/): Choose a supported compute size, understand account quotas, and handle refusals without endless retries.



## Long-running work

Continue work across lost connections or coordinate several sandboxes.


- [Find a process you lost track of](https://docs.docker.com/ai/sandboxes-api/cookbook/find-a-process-you-lost-track-of/): Look up a running process by the session tag you gave it when you created it, then pick up its output from the resume point its own report publishes.

- [Clone a cloud sandbox](https://docs.docker.com/ai/sandboxes-api/cookbook/clone-a-cloud-sandbox/): Read how a running sandbox was configured, then create a second sandbox with the same image and environment.

- [Run work across many sandboxes](https://docs.docker.com/ai/sandboxes-api/cookbook/run-work-across-many-sandboxes/): Run one command on every running sandbox you hold, a bounded number at a time, and read one answer per sandbox even when some of them fail.

- [Recover when the endpoint moves](https://docs.docker.com/ai/sandboxes-api/cookbook/recover-when-the-endpoint-moves/): Read a sandbox again to learn its current endpoint, then run one command through a connection built for that endpoint.

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/add-a-docker-credential-for-cloud-sandboxes/ fetched 2026-10-08 -->

# Add a Docker credential for cloud sandboxes


Store a Docker credential for workloads that need Docker access. This is separate from [signing your application in](/ai/sandboxes-api/cookbook/add-a-docker-credential-for-cloud-sandboxes/connect-to-cloud-with-a-bearer-token/): the application's access token authenticates SDK calls, while this exchange stores a credential for sandboxes.

You need an authenticated client and a fresh Docker OpenID Connect identity token for the same identity. The example accepts that identity token; it does not perform the sign-in that issues it.

## Exchange the token {#1-exchange-the-token}

Pass the identity token to the identity collection. The service stores the resulting credential as `secrets/docker`, replacing its previous value. It returns no credential material.

Treat the identity token as single-use. If you lose the response, obtain a new identity token before trying again. Never log either token.

Use [stored secrets](/ai/sandboxes-api/cookbook/add-a-docker-credential-for-cloud-sandboxes/get-a-stored-secret-into-a-sandbox/) for other workload credentials. For an automation client that needs to call the SDK, use [PAT authentication](/ai/sandboxes-api/cookbook/add-a-docker-credential-for-cloud-sandboxes/connect-to-cloud-with-a-bearer-token/) instead of this exchange.

**TypeScript**



```typescript
return client.identity.exchangeDockerCredential({ idToken });
```

<details>
<summary>Complete TypeScript example: credentials/exchange.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function exchangeDockerCredential(
  client: Sandboxes,
  idToken: string,
) {
  return client.identity.exchangeDockerCredential({ idToken });
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/add-tools-with-kits/ fetched 2026-10-08 -->

# Run agents with kits


A kit supplies an agent's image and configuration, including tools and the settings they need. Launching a kit gives you a repeatable starting point without assembling those settings in every application.

Start with an [authenticated client](/ai/sandboxes-api/cookbook/add-tools-with-kits/connect-to-cloud-with-a-bearer-token/). Agent workloads also need credentials for their model provider. Docker authentication gives access to sandboxes; it does not sign you in to Anthropic, OpenAI, or another agent provider.

## Discover available kits {#1-discover-available-kits}

List the kits bundled with your installed SDK. Use an entry's name when launching it. Listing the catalog does not create a sandbox.

The SDK's launch-by-name helper includes these starting points:

| Kit name | Environment |
| --- | --- |
| `claude` | Claude Code |
| `codex` | Codex |
| `cursor` | Cursor |
| `devin` | Devin |
| `docker-agent` | Docker Agent |
| `gemini` | Gemini CLI |
| `opencode` | OpenCode |
| `shell` | A shell environment for your own commands |

Use the catalog result as the list for your installed version. Upgrading the SDK can update the bundled kits.

**TypeScript**



```typescript
return client.kits.list();
```

<details>
<summary>Complete TypeScript example: kits/catalog.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export function listKits(client: Sandboxes) {
  return client.kits.list();
}
```

</details>



## Launch a kit {#2-launch-a-kit}

To run Claude Code, choose `claude` and attach a stored `anthropic` secret containing your Anthropic API key. [Store the provider credential](/ai/sandboxes-api/cookbook/add-tools-with-kits/get-a-stored-secret-into-a-sandbox/) first, then pass the stored secret's resource name to the launch example. Keep credentials out of command arguments and plain environment values.

Pass a catalog name, a display name, and any stored secret names the agent needs. The example selects Small (2 vCPUs, 4 GiB) and uses the launch-and-wait helper to return a running sandbox under one deadline. Small is also the default when you omit kit resources. See [compute sizes](/ai/sandboxes-api/cookbook/add-tools-with-kits/work-within-the-limits/) for the other choices.

Use `launch` when you want the accepted handle immediately and will wait separately. If the wait fails, inspect the accepted sandbox retained by the error before launching another one.

`launchAndWait()` waits for the sandbox to reach the running state. A kit can still be installing tools or cloning a repository at that point. The SDK has no helper that waits for all kit setup to finish.

If your work depends on that setup, check the result it needs before starting. For example, a kit can write a completion marker after cloning a repository, or a service can expose a health check. Poll with a delay between checks and a timeout so failed setup does not leave your application waiting indefinitely.

The launch helper accepts only names returned by the bundled catalog, not community repository URLs or registry references. Account network policies still apply to kit sandboxes.

Use `shell` when you need an environment for scripts, builds, or your own executable. To use a container image directly, see [Run your own container image](/ai/sandboxes-api/cookbook/add-tools-with-kits/run-your-own-container-image/).

**TypeScript**



```typescript
return client.kits.launchAndWait(kitName, {
  displayName,
  resources: 'small',
  storage: { secrets },
});
```

<details>
<summary>Complete TypeScript example: kits/launch.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function launchKit(
  client: Sandboxes,
  kitName: string,
  displayName: string,
  secrets: string[] = [],
) {
  return client.kits.launchAndWait(kitName, {
    displayName,
    resources: 'small',
    storage: { secrets },
  });
}
```

</details>



## Run the agent {#3-run-the-agent}

Pass the sandbox handle returned by the launch example and your prompt to the run helper. It runs `claude -p` and waits for the response. Launching a kit alone does not submit an agent task.

The example returns captured output and an exit code. Check both when diagnosing an agent failure. For a long task, [stream output](/ai/sandboxes-api/cookbook/add-tools-with-kits/run-something-that-produces-real-output/); for a conversation in a terminal, [open an interactive session](/ai/sandboxes-api/cookbook/add-tools-with-kits/run-an-interactive-shell-in-a-cloud-sandbox/).

Save the sandbox name if you will resume the work later. [Delete the sandbox](/ai/sandboxes-api/cookbook/add-tools-with-kits/delete-a-cloud-sandbox/) when you no longer need its files or running processes.

**TypeScript**



```typescript
return sandbox.processes.run(
  { args: ['claude', '-p', prompt] },
  { timeoutMs: 300_000 },
);
```

<details>
<summary>Complete TypeScript example: kits/run.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function runKitAgent(sandbox: Sandbox, prompt: string) {
  return sandbox.processes.run(
    { args: ['claude', '-p', prompt] },
    { timeoutMs: 300_000 },
  );
}
```

</details>



## Explore the wider kit catalog {#4-explore-the-wider-kit-catalog}

The [community kit catalog](https://github.com/docker/sbx-kits-contrib) includes agents such as Aider, Amp, Copilot, Kiro, and OpenHands, plus development tools, browser automation, source control, and security scanning. For example, Code Server adds a browser-based editor and Playwright adds browser automation.

Some kits define a complete sandbox environment; others add tools or configuration to an existing agent environment. These are not all bundled SDK launch targets. See the [Docker kits guide](https://docs.docker.com/ai/sandboxes/customize/kits/) for the catalog's usage instructions.

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/attach-persistent-storage/ fetched 2026-10-08 -->

# Attach persistent storage


Keep project data after a sandbox is deleted by mounting a persistent volume. A volume is an independent resource: deleting a sandbox does not delete the volume.

Start with an [authenticated client](/ai/sandboxes-api/cookbook/attach-persistent-storage/connect-to-cloud-with-a-bearer-token/), a managed image from [Register and manage an image](/ai/sandboxes-api/cookbook/attach-persistent-storage/register-and-manage-an-image/), and an absolute mount path such as `/workspace/data`.

## Create a volume {#1-create-a-volume}

Choose a display name and an idempotency key for the create request. Save the returned volume name, such as `volumes/…`. That name identifies the volume in later requests; its display name is only a label.

**TypeScript**



```typescript
return client.volumes.create(
  { displayName: name },
  { idempotencyKey: requestId },
);
```

<details>
<summary>Complete TypeScript example: volumes/create.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function createVolume(
  client: Sandboxes,
  name: string,
  requestId: string,
) {
  return client.volumes.create(
    { displayName: name },
    { idempotencyKey: requestId },
  );
}
```

</details>



## Mount it in a new sandbox {#2-mount-it-in-a-new-sandbox}

Supply the volume name and destination path when creating the sandbox. The example accepts a map of volume names to mount paths and waits for the sandbox to run. For Cloud Sandboxes, supply one entry and use exclusive attachment. Volume access must be enabled for your account; memory-snapshot images do not support volume attachment.

Attachments belong to the sandbox's creation settings. To mount the volume elsewhere, create another sandbox with the attachment. With exclusive attachment, release the first sandbox before attaching the volume to another one. Avoid overlapping mount paths.

Write a file under the mount path, delete the sandbox, then attach the volume to a new sandbox to read it again. Files outside the mount remain on the sandbox's own disk.

**TypeScript**



```typescript
const sandbox = await client.create(
  {
    displayName: name,
    image,
    storage: {
      volumes: [...mountPaths].map(([volume, target]) => ({
        volume,
        target,
      })),
    },
  },
  { timeoutMs: 300_000, idempotencyKey: requestId },
);
return sandbox.waitUntilRunning();
```

<details>
<summary>Complete TypeScript example: volumes/attach.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function createWithVolumes(
  client: Sandboxes,
  name: string,
  image: string,
  mountPaths: Map<string, string>,
  requestId: string,
) {
  const sandbox = await client.create(
    {
      displayName: name,
      image,
      storage: {
        volumes: [...mountPaths].map(([volume, target]) => ({
          volume,
          target,
        })),
      },
    },
    { timeoutMs: 300_000, idempotencyKey: requestId },
  );
  return sandbox.waitUntilRunning();
}
```

</details>



## Delete the volume {#3-delete-the-volume}

Delete the sandbox using the volume first, then delete the volume through its handle. If the service reports that it is still in use, wait for sandbox deletion to finish before retrying.

Deleting the volume permanently removes its contents. Copy out anything you need to keep.

**TypeScript**



```typescript
await volume.delete();
```

<details>
<summary>Complete TypeScript example: volumes/delete.ts</summary>

```typescript
import type { Volume } from '@docker/sandboxes';

export async function deleteVolume(volume: Volume) {
  await volume.delete();
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/clone-a-cloud-sandbox/ fetched 2026-10-08 -->

# Clone a cloud sandbox


Create another sandbox using selected settings from an existing one. This example copies the image source and environment, not the sandbox's files or running processes. For a saved filesystem or memory state, use a [snapshot](/ai/sandboxes-api/cookbook/clone-a-cloud-sandbox/snapshot-and-fork-a-sandbox/).

You need an [authenticated client](/ai/sandboxes-api/cookbook/clone-a-cloud-sandbox/connect-to-cloud-with-a-bearer-token/), the source sandbox's resource name, and a display name for the new sandbox.

## Read the source configuration {#1-read-the-source-configuration}

Get the source sandbox and inspect its image and environment. Review environment values before copying them; they may contain credentials or settings specific to the original job.

Do not treat the complete response as a create request. It includes read-only state and connection details.

**TypeScript**



```typescript
const sandbox = await client.get(name);
return sandbox.core;
```

<details>
<summary>Complete TypeScript example: clone/inspect.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function inspectSandbox(client: Sandboxes, name: string) {
  const sandbox = await client.get(name);
  return sandbox.core;
}
```

</details>



## Create a fresh sandbox {#2-create-a-fresh-sandbox}

The example copies the image source and environment. For a registry image it also copies resource settings. It waits for the new sandbox to run.

The call returns the new sandbox's handle, ready for running commands or transferring files.

This is a limited configuration copy, not a complete clone. It does not copy kits, attached policies, secrets, volumes, files, or process state. A copied image alone may not reproduce a kit's setup. For repeated agent environments, launch the same [named kit](/ai/sandboxes-api/cookbook/clone-a-cloud-sandbox/add-tools-with-kits/) with the options your application saved.

Attach required network policies and credentials before running work in the new sandbox. The source is unchanged, and both sandboxes need their own cleanup.

**TypeScript**



```typescript
const copy = await client.create(
  {
    displayName: name,
    ...(core.image
      ? { image: core.image, agent: core.agent }
      : {
          imageRef: core.imageRef!,
          resources: core.resources,
        }),
    environment: core.environment,
  },
  { timeoutMs: 300_000, idempotencyKey: requestId },
);
return copy.waitUntilRunning();
```

<details>
<summary>Complete TypeScript example: clone/rebuild.ts</summary>

```typescript
import type { Sandbox, Sandboxes } from '@docker/sandboxes';

export async function rebuildSandbox(
  client: Sandboxes,
  core: Sandbox['core'],
  name: string,
  requestId: string,
) {
  if (!core.image && !core.imageRef)
    throw new TypeError('Source has no image');
  const copy = await client.create(
    {
      displayName: name,
      ...(core.image
        ? { image: core.image, agent: core.agent }
        : {
            imageRef: core.imageRef!,
            resources: core.resources,
          }),
      environment: core.environment,
    },
    { timeoutMs: 300_000, idempotencyKey: requestId },
  );
  return copy.waitUntilRunning();
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/connect-to-cloud-with-a-bearer-token/ fetched 2026-10-08 -->

# Authenticate to Docker


Sign in to Docker so your application can create and use Cloud Sandboxes. Before you begin, [install the SDK](https://docs.docker.com/ai/sandboxes-api/install/) and make sure your Docker account has Cloud Sandboxes access.

Choose interactive sign-in when running an example yourself. Use a personal access token (PAT) for a service or CI job. If your application already manages Docker access tokens, pass a token or a token provider.

## Sign in interactively {#1-sign-in-interactively}

Call `const client = await login()` using the function below. It prints a link and a code in your terminal. Open the link in your browser, enter the code, and approve sign-in with your Docker account.

The function waits for sign-in to finish before returning a client you can use to call the API. If you deny sign-in or the verification code expires, it reports an error. Run the program again to get a new code. The [complete program](/ai/sandboxes-api/cookbook/connect-to-cloud-with-a-bearer-token/run-a-complete-example/) shows how to sign in and create a sandbox.

The SDK keeps your sign-in details in memory and renews access automatically while your sign-in remains valid. You need to sign in again when you restart the program unless you save these details as described below. Call `await client.close()` when finished. Closing the client does not delete your sandboxes or sign you out of Docker.

You can pass the same authenticator to several clients to reuse their sign-in. Closing one client leaves the authenticator usable by the others.

**TypeScript**



```typescript
export const login = async () => {
  const auth = oauth({
    onVerification: ({ verificationUri, userCode }) => {
      console.log(`Open ${verificationUri} and enter ${userCode}`);
    },
  });
  await auth.getAccessToken();
  return new Sandboxes({ auth });
};
```

<details>
<summary>Complete TypeScript example: cloudauth/login.ts</summary>

```typescript
import {
  fileOAuthCredentialStore,
  oauth,
  Sandboxes,
} from '@docker/sandboxes';

export const login = async () => {
  const auth = oauth({
    onVerification: ({ verificationUri, userCode }) => {
      console.log(`Open ${verificationUri} and enter ${userCode}`);
    },
  });
  await auth.getAccessToken();
  return new Sandboxes({ auth });
};

export async function loginWithSavedCredentials(path: string) {
  const storedAuth = oauth({
    store: fileOAuthCredentialStore({ path }),
    onVerification: ({ verificationUri, userCode }) => {
      console.log(`Open ${verificationUri} and enter ${userCode}`);
    },
  });
  await storedAuth.getAccessToken();
  return new Sandboxes({ auth: storedAuth });
}
```

</details>



## Optional: save credentials between runs {#2-optional-save-credentials-between-runs}

To reuse your sign-in when a Node.js program restarts, expand the complete example above and use `await loginWithSavedCredentials(path)`. Set `path` to the file where you want to save your sign-in details. The function uses saved details when they are still valid, or asks you to sign in again, before returning a client.

The file store works in Node.js on systems such as macOS and Linux, but not in browsers or on Windows. The file is not encrypted. Keep it in a private directory, exclude it from source control, and do not share it between running programs. To save sign-in details in a keychain or secret manager instead, implement `OAuthCredentialStore` with `load` and `save`.

Remove the stored credentials when your application no longer needs them. Your application owns that removal; closing a client does not remove the file or revoke the credentials.

## Use a personal access token {#3-use-a-personal-access-token}

Create a [Docker personal access token](https://docs.docker.com/security/access-tokens/) for the Docker account your application will use. Provide your Docker username and PAT through your application's secret manager or environment, then pass them to the SDK's PAT authentication option.

The SDK exchanges the PAT for a short-lived access token and repeats the exchange when needed. Supply the PAT as a PAT credential, not as an access token or an Authorization header. A revoked or expired PAT requires a replacement credential.

Managed OAuth and PAT authentication use the default Docker service address. Use a caller-supplied access token or provider when you need to override that address.

Your PAT needs the `sandbox:use` permission. Select it when you create the token, at `https://app.docker.com/accounts/[username]/settings/personal-access-tokens`.

Keep the PAT on the machine running your application. Do not put it in a sandbox's environment, source code, or logs.

**TypeScript**



```typescript
return new Sandboxes({
  auth: pat({ username, personalAccessToken }),
});
```

<details>
<summary>Complete TypeScript example: cloudauth/pat.ts</summary>

```typescript
import { pat, Sandboxes } from '@docker/sandboxes';

export function connectWithPAT(
  username: string,
  personalAccessToken: string,
) {
  return new Sandboxes({
    auth: pat({ username, personalAccessToken }),
  });
}
```

</details>



## Supply an access token {#4-supply-an-access-token}

If you already hold a Docker access-token JWT, pass it as the client's access token. The SDK sends it as a bearer credential. A raw PAT is not an access-token JWT.

A fixed token has no refresh credential. Once it expires, create a client with a fresh token, or use the provider option below. The example accepts a service URL for applications that need an override; the default is `https://connect.docker.com/sandboxes`.

**TypeScript**



```typescript
return new Sandboxes({
  baseUrl: endpoint,
  auth: bearer(accessToken),
});
```

<details>
<summary>Complete TypeScript example: cloudauth/connect.ts</summary>

```typescript
import { bearer, Sandboxes } from '@docker/sandboxes';

export function connectToCloud(endpoint: string, accessToken: string) {
  return new Sandboxes({
    baseUrl: endpoint,
    auth: bearer(accessToken),
  });
}
```

</details>



## Supply a token provider {#5-supply-a-token-provider}

Pass a callback that obtains a current Docker access token from your credential system. The callback returns the token string; your application owns its acquisition, storage, and renewal. Do not return an expired token.

Use one credential source per client. The SDK does not read environment variables or credentials saved by Docker command-line tools automatically.

Authentication errors mean the credential is missing, rejected, or expired. Sign in again or replace the credential. A permission error means the account cannot perform the requested action; check its Cloud Sandboxes access and resource permissions before retrying.

When you run commands or transfer files through a sandbox handle, the SDK obtains a credential scoped to that sandbox. You do not need to copy your account token into a second client.

Docker sign-in is separate from an agent's provider credential. To let an agent call its model provider, follow [Use secrets in a sandbox](/ai/sandboxes-api/cookbook/connect-to-cloud-with-a-bearer-token/get-a-stored-secret-into-a-sandbox/).

Next, [run a complete program](/ai/sandboxes-api/cookbook/connect-to-cloud-with-a-bearer-token/run-a-complete-example/) that signs in and launches a kit.

**TypeScript**



```typescript
return new Sandboxes({
  auth: { getAccessToken: tokenProvider },
});
```

<details>
<summary>Complete TypeScript example: cloudauth/provider.ts</summary>

```typescript
import { Sandboxes, type Authenticator } from '@docker/sandboxes';

export function connectWithTokenProvider(
  tokenProvider: Authenticator['getAccessToken'],
) {
  return new Sandboxes({
    auth: { getAccessToken: tokenProvider },
  });
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/control-what-a-sandbox-can-reach/ fetched 2026-10-08 -->

# Control what a sandbox can reach


Control which destinations an agent or command can reach. A sandbox's effective policy combines account rules with the policies attached to it.

You need an [authenticated client](/ai/sandboxes-api/cookbook/control-what-a-sandbox-can-reach/connect-to-cloud-with-a-bearer-token/), a managed image, and policy IDs from your account. Create policies in the Console or with [Manage network policies](/ai/sandboxes-api/cookbook/control-what-a-sandbox-can-reach/manage-network-policies/).

## Attach policies at creation {#1-attach-policies-at-creation}

Pass the policy IDs when creating the sandbox. The example waits until the sandbox is running and returns its handle.

Attachments refer to existing policies; they do not contain policy definitions. Keep the IDs distinct from display names. Attached policies restrict access alongside account policy, so they cannot grant access that your account denies.

Include every destination the workload needs, including its model provider and package registries. A kit's network requirements do not override account restrictions.

**TypeScript**



```typescript
const sandbox = await client.create(
  { displayName: name, image, network: { policyIds } },
  { timeoutMs: 300_000, idempotencyKey: requestId },
);
return sandbox.waitUntilRunning();
```

<details>
<summary>Complete TypeScript example: netpolicy/reference.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function createWithPolicyIds(
  client: Sandboxes,
  name: string,
  image: string,
  policyIds: string[],
  requestId: string,
) {
  const sandbox = await client.create(
    { displayName: name, image, network: { policyIds } },
    { timeoutMs: 300_000, idempotencyKey: requestId },
  );
  return sandbox.waitUntilRunning();
}
```

</details>



## Inspect the rules in force {#2-inspect-the-rules-in-force}

Read the sandbox's effective policy before troubleshooting an application timeout. The result includes combined allow and deny rules, their origins, and an exact policy representation.

The effective view is the useful starting point for questions such as “can this sandbox reach api.anthropic.com?” Check the default mode as well as matching rules. A deny-by-default policy needs an explicit allowance for the destination.

**TypeScript**



```typescript
return sandbox.networkPolicies.get();
```

<details>
<summary>Complete TypeScript example: netpolicy/effective.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function getNetworkPolicies(sandbox: Sandbox) {
  return sandbox.networkPolicies.get();
}
```

</details>



## Check allowed and blocked traffic {#3-check-allowed-and-blocked-traffic}

List policy log entries for the sandbox, using `domain=network` to select network decisions. The example follows pagination and returns all matching entries.

Use each entry's destination, decision, reason, and count to identify blocked dependencies. An empty result means no matching entries were returned; it does not prove that a destination is reachable. The log records recent activity, not a permanent audit history.

**TypeScript**



```typescript
return sandbox.networkPolicies.logs.all({ filter }).collect();
```

<details>
<summary>Complete TypeScript example: netpolicy/logs.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function listPolicyLogEntries(
  client: Sandboxes,
  sandboxName: string,
  filter: string,
) {
  const sandbox = await client.get(sandboxName);
  return sandbox.networkPolicies.logs.all({ filter }).collect();
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/copy-a-file-into-a-cloud-sandbox/ fetched 2026-10-08 -->

# Copy a file into a cloud sandbox


Send project files, scripts, or input data to a running sandbox. Use its file collection instead of putting large file contents into command arguments.

You need a sandbox handle from [your first sandbox](/ai/sandboxes-api/cookbook/copy-a-file-into-a-cloud-sandbox/create-your-first-sandbox/) and an absolute destination path. The paths in these examples are inside the sandbox, not on your computer.

## Create the destination directory {#1-create-the-destination-directory}

Create the destination directory with the desired permission mode. The example also creates missing parent directories.

Choose the narrowest permissions the workload needs. Remember that a file's contents and its executable permission are separate settings.

**TypeScript**



```typescript
await sandbox.files.mkdir(path, { mode, parents: true });
```

<details>
<summary>Complete TypeScript example: upload/mkdir.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function makeDirectory(
  sandbox: Sandbox,
  path: string,
  mode: number,
) {
  await sandbox.files.mkdir(path, { mode, parents: true });
}
```

</details>



## Write a small text file {#2-write-a-small-text-file}

Use the write helper for a configuration file or short script already held as a string. Pass its destination path and content. For binary data or streamed transfers, use upload instead.

**TypeScript**



```typescript
return sandbox.files.write(path, content);
```

<details>
<summary>Complete TypeScript example: upload/write.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function writeFile(
  sandbox: Sandbox,
  path: string,
  content: string,
) {
  return sandbox.files.write(path, content);
}
```

</details>



## Upload file content {#3-upload-file-content}

Upload bytes to the destination and read its metadata afterward. The example accepts content from your application; read a local file first if that is your source.

Choose a file mode explicitly when executable or restricted permissions matter. A failed upload may have written some data. Inspect the destination before retrying if replacing its contents would be unsafe.

Next, [run a command](/ai/sandboxes-api/cookbook/copy-a-file-into-a-cloud-sandbox/run-your-first-command/) that reads the file, or [read it back](/ai/sandboxes-api/cookbook/copy-a-file-into-a-cloud-sandbox/read-files-out-of-a-sandbox/) to verify the content.

**TypeScript**



```typescript
await sandbox.files.upload(path, content, { mode });
return (await sandbox.files.stat(path)).info;
```

<details>
<summary>Complete TypeScript example: upload/upload.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function uploadFile(
  sandbox: Sandbox,
  path: string,
  content: Uint8Array,
  mode: number,
) {
  await sandbox.files.upload(path, content, { mode });
  return (await sandbox.files.stat(path)).info;
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/create-your-first-sandbox/ fetched 2026-10-08 -->

# Create your first sandbox


Create a sandbox from a kit and run a command inside it. A kit bundles an image and configuration for a tool or agent. The `shell` kit is a useful first choice because a greeting command needs no model-provider credential.

[Install an SDK](https://docs.docker.com/ai/sandboxes-api/install/) and [authenticate to Docker](/ai/sandboxes-api/cookbook/create-your-first-sandbox/connect-to-cloud-with-a-bearer-token/) first. Pass the authenticated client to this example along with a kit name and command.

## Launch a kit and run a command {#1-launch-a-kit-and-run-a-command}

Choose `shell` as the kit name and pass `['echo', 'Hello from Docker Sandboxes']` as the command. The example requests 2 CPUs and 4096 MiB of memory. See [compute sizes and account limits](/ai/sandboxes-api/cookbook/create-your-first-sandbox/work-within-the-limits/) when sizing other workloads.

The example launches the kit, waits until the sandbox is running, and runs the command through the sandbox's process collection. The SDK handles the connection and its sandbox-scoped credential.

A successful greeting returns `Hello from Docker Sandboxes` in `stdout` and exit code zero. See [Run your first command](/ai/sandboxes-api/cookbook/create-your-first-sandbox/run-your-first-command/) for argument arrays, shell syntax, and interpreting command results.

Keep the returned sandbox name. This example leaves the sandbox available for the next guides. [Delete it](/ai/sandboxes-api/cookbook/create-your-first-sandbox/delete-a-cloud-sandbox/) when you finish; closing the SDK client does not delete it. If a wait times out after creation was accepted, the sandbox can still exist.

**TypeScript**



```typescript
const created = await client.kits.launch(
  kitName,
  { resources: { cpus: 2, memoryMib: 4096 } },
  { timeoutMs, signal },
);
const sandbox = await created.waitUntilRunning({ timeoutMs, signal });
const result = await sandbox.processes.run(
  { args },
  { timeoutMs, signal },
);
return { sandbox, result };
```

<details>
<summary>Complete TypeScript example: quickstart/run.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function createAndRun(
  client: Sandboxes,
  kitName: string,
  args: string[],
  timeoutMs = 300_000,
) {
  const signal = AbortSignal.timeout(timeoutMs);
  const created = await client.kits.launch(
    kitName,
    { resources: { cpus: 2, memoryMib: 4096 } },
    { timeoutMs, signal },
  );
  const sandbox = await created.waitUntilRunning({ timeoutMs, signal });
  const result = await sandbox.processes.run(
    { args },
    { timeoutMs, signal },
  );
  return { sandbox, result };
}
```

</details>



## Clean up a temporary sandbox automatically {#2-clean-up-a-temporary-sandbox-automatically}

For a single task, the scoped sandbox helper creates a sandbox, runs your callback, and attempts deletion afterward, including when the callback fails. This example explicitly stops the sandbox and waits for that transition before the helper attempts deletion. Supply the command arguments and creation options appropriate for the task; for a published image, set its reference and resources.

Cleanup has its own deadline. If it fails, inspect the workflow error and the retained sandbox identity so you can finish cleanup. Do not treat a client timeout as confirmation that the sandbox was deleted.

Next, [choose an agent kit](/ai/sandboxes-api/cookbook/create-your-first-sandbox/add-tools-with-kits/) or [work with processes](/ai/sandboxes-api/cookbook/create-your-first-sandbox/run-your-first-command/).

**TypeScript**



```typescript
return client.withSandbox(options, async (sandbox) => {
  const outcome = await sandbox.processes
    .run({ args }, { timeoutMs: 300_000 })
    .then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
  try {
    const cleanup = { signal: AbortSignal.timeout(30_000) };
    const current = await client.get(sandbox.name, cleanup);
    if (current.uid !== sandbox.uid)
      throw new Error(
        'Sandbox identity changed; refusing to stop a replacement',
      );
    const stopped = await current.stop(cleanup);
    await stopped.waitUntilStopped(cleanup);
  } catch (error) {
    if ('error' in outcome)
      throw new AggregateError(
        [outcome.error, error],
        'Command and stop both failed',
      );
    throw error;
  }
  if ('error' in outcome) throw outcome.error;
  return outcome.value;
});
```

<details>
<summary>Complete TypeScript example: quickstart/scoped.ts</summary>

```typescript
import type { ClientCreateOptions, Sandboxes } from '@docker/sandboxes';

export async function runTemporary(
  client: Sandboxes,
  options: ClientCreateOptions,
  args: string[],
) {
  return client.withSandbox(options, async (sandbox) => {
    const outcome = await sandbox.processes
      .run({ args }, { timeoutMs: 300_000 })
      .then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
    try {
      const cleanup = { signal: AbortSignal.timeout(30_000) };
      const current = await client.get(sandbox.name, cleanup);
      if (current.uid !== sandbox.uid)
        throw new Error(
          'Sandbox identity changed; refusing to stop a replacement',
        );
      const stopped = await current.stop(cleanup);
      await stopped.waitUntilStopped(cleanup);
    } catch (error) {
      if ('error' in outcome)
        throw new AggregateError(
          [outcome.error, error],
          'Command and stop both failed',
        );
      throw error;
    }
    if ('error' in outcome) throw outcome.error;
    return outcome.value;
  });
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/delete-a-cloud-sandbox/ fetched 2026-10-08 -->

# Delete a cloud sandbox


Delete a sandbox when its work is finished. Deletion removes its processes and sandbox-local files, so download results or save a snapshot first.

Use a current sandbox handle from creation or from reading its resource name. Closing the SDK client does not delete the sandbox.

## Delete and wait {#1-delete-and-wait}

Delete through the sandbox handle, then wait until the sandbox is absent. Deletion can terminate running work. If you choose to [stop the sandbox](/ai/sandboxes-api/cookbook/delete-a-cloud-sandbox/stop-and-restart-a-sandbox/) first, wait for that transition to finish before deleting it: deletion during a stop or resume can be refused.

The example takes an idempotency key and a wait deadline. Its optional force setting requests deletion when the service would otherwise refuse the sandbox's state. It does not guarantee that every state can be deleted immediately; handle a refusal rather than assuming cleanup succeeded.

The handle supplies the resource version it read. When an operation returns an updated handle, keep that handle for your next operation; older handles do not update themselves.

If deletion fails because the resource version changed, call `refresh()`. Inspect the returned handle and decide whether deletion is still appropriate. Refreshing does not change the original handle, so call delete on the returned one. If you supply idempotency keys, use a new key: deleting the refreshed version is a new logical operation, not a retry of the refused request.

If the wait times out, read the sandbox again to check its state. Keep its name so you can retry cleanup if needed. Repeating a completed deletion is safe.

Separate resources such as volumes, snapshots, and stored secrets have their own lifetimes. Delete those only when nothing still needs them.

**TypeScript**



```typescript
const deleting = await sandbox.delete(
  { force },
  { idempotencyKey: requestId },
);
if (deleting) await deleting.waitUntilDeleted({ timeoutMs });
```

<details>
<summary>Complete TypeScript example: removal/delete.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function deleteSandbox(
  sandbox: Sandbox,
  requestId: string,
  force = false,
  timeoutMs = 300_000,
) {
  const deleting = await sandbox.delete(
    { force },
    { idempotencyKey: requestId },
  );
  if (deleting) await deleting.waitUntilDeleted({ timeoutMs });
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/expose-a-port-from-a-cloud-sandbox/ fetched 2026-10-08 -->

# Expose a port from a cloud sandbox


Reach a web application running inside a sandbox through an HTTPS URL. Publishing creates a route to the application; it does not start the application.

You need an [authenticated client](/ai/sandboxes-api/cookbook/expose-a-port-from-a-cloud-sandbox/connect-to-cloud-with-a-bearer-token/), the sandbox name, and an HTTP application listening on the port you will publish. Bind the application to an address reachable inside the sandbox, such as `0.0.0.0`.

## Publish the application's port {#1-publish-the-application-s-port}

Supply the sandbox name and the application's port number. The example uses TCP. Use the URL returned by the service rather than constructing a hostname.

This is HTTP application access, not a general-purpose TCP tunnel. Docker account authentication does not protect the application URL. Configure authentication in your application before exposing sensitive data, and never send your Docker account token to that URL.

**TypeScript**



```typescript
return sandbox.ports.create(
  { number, protocol: 'tcp' },
  { idempotencyKey: requestId },
);
```

<details>
<summary>Complete TypeScript example: ports/publish.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function createPort(
  client: Sandboxes,
  sandboxName: string,
  number: number,
  requestId: string,
) {
  const sandbox = await client.get(sandboxName);
  return sandbox.ports.create(
    { number, protocol: 'tcp' },
    { idempotencyKey: requestId },
  );
}
```

</details>



## List published ports {#2-list-published-ports}

Read the sandbox's port collection to find existing publications and their URLs. Check the application's readiness separately: a published route does not prove the application has started.

**TypeScript**



```typescript
return (await sandbox.ports.list()).published ?? [];
```

<details>
<summary>Complete TypeScript example: ports/list.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function listPorts(sandbox: Sandbox) {
  return (await sandbox.ports.list()).published ?? [];
}
```

</details>



## Withdraw a publication {#3-withdraw-a-publication}

Delete the published port when access is no longer needed. This removes the route but leaves the application process running.

Stopping the sandbox does not remove its port publications. Deleting the sandbox does.

**TypeScript**



```typescript
await port.delete();
```

<details>
<summary>Complete TypeScript example: ports/unpublish.ts</summary>

```typescript
import type { Port } from '@docker/sandboxes';

export async function deletePort(port: Port) {
  await port.delete();
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/find-a-process-you-lost-track-of/ fetched 2026-10-08 -->

# Find a process you lost track of


Reconnect to work after losing a process connection. Starting a new command can duplicate effects, so first look for the process you already started.

Connections opened through TypeScript process handles recover from temporary disconnects while you consume output. They reconnect to the same process and resume after the last delivered chunk, with a 30-second budget per recovery episode. They never restart the command or replay terminal input. Raw streams require explicit reconnection. Use this guide when automatic recovery stops, you close a connection, or your application restarts.

You need a current sandbox handle and a session tag that your application assigned when it started the process. A session tag is searchable metadata, not the process's resource name.

## Find the running session {#1-find-the-running-session}

List processes filtered by session and running state. The example follows pagination. If multiple processes match, choose the intended resource by its saved name or metadata rather than attaching to an arbitrary result.

An empty list means no running process matched. It does not prove that the original command never started: it may have exited.

**TypeScript**



```typescript
return sandbox.processes
  .all({ filter: `session=${session},state=running` })
  .collect();
```

<details>
<summary>Complete TypeScript example: reconnect/list.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function findSession(sandbox: Sandbox, session: string) {
  return sandbox.processes
    .all({ filter: `session=${session},state=running` })
    .collect();
}
```

</details>



## Reconnect to its output {#2-reconnect-to-its-output}

Connect to the selected process handle and consume output events. The example resumes from the last sequence reported by that handle.

For delivery to another system, keep your own cursor for the last chunk that system actually handled. The latest sequence reported by the process may be ahead of that cursor. Use [explicit output resumption](/ai/sandboxes-api/cookbook/find-a-process-you-lost-track-of/run-an-interactive-shell-in-a-cloud-sandbox/) when you need to replay from your saved position.

Close the connection when finished. Keep the process name if the connection drops again; do not replace reconnection with a second process start.

**TypeScript**



```typescript
const connection = await process.connect({
  resumeFrom: process.lastStreamSequence,
});
let lastSequence = BigInt(process.lastStreamSequence ?? '0');
try {
  for await (const event of connection) {
    if (event.type === 'chunk')
      write(
        event.data ?? new Uint8Array(),
        (lastSequence = BigInt(event.streamSequence ?? '0')),
      );
  }
  return lastSequence;
} finally {
  await connection.close();
}
```

<details>
<summary>Complete TypeScript example: reconnect/attach.ts</summary>

```typescript
import type { Process } from '@docker/sandboxes';

export async function rejoinProcess(
  process: Process,
  write: (bytes: Uint8Array, sequence: bigint) => void,
) {
  const connection = await process.connect({
    resumeFrom: process.lastStreamSequence,
  });
  let lastSequence = BigInt(process.lastStreamSequence ?? '0');
  try {
    for await (const event of connection) {
      if (event.type === 'chunk')
        write(
          event.data ?? new Uint8Array(),
          (lastSequence = BigInt(event.streamSequence ?? '0')),
        );
    }
    return lastSequence;
  } finally {
    await connection.close();
  }
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/get-a-stored-secret-into-a-sandbox/ fetched 2026-10-08 -->

# Get a stored secret into a sandbox


Give an agent access to its provider without placing the real credential in its command arguments or source files. Store the credential once, then attach its secret name when creating each sandbox.

Start with an [authenticated client](/ai/sandboxes-api/cookbook/get-a-stored-secret-into-a-sandbox/connect-to-cloud-with-a-bearer-token/). Obtain the provider credential from that provider and read it from your application's secret manager. For Claude Code, use an Anthropic API key and service type `anthropic`; the Docker login token is not an Anthropic key.

## Store the provider credential {#1-store-the-provider-credential}

Supply a display name, service type, token value, and an idempotency key. Save the returned secret name. The response contains metadata, never the stored token.

Choose the service type that matches the workload's provider. A token for one provider does not authenticate another agent.

**TypeScript**



```typescript
return client.secrets.create(
  { displayName: name, serviceType, token: { value: token } },
  { idempotencyKey: requestId },
);
```

<details>
<summary>Complete TypeScript example: credinject/store.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function storeSecret(
  client: Sandboxes,
  name: string,
  serviceType: string,
  token: string,
  requestId: string,
) {
  return client.secrets.create(
    { displayName: name, serviceType, token: { value: token } },
    { idempotencyKey: requestId },
  );
}
```

</details>



## Attach the secret at creation {#2-attach-the-secret-at-creation}

Put the secret name in the sandbox's storage options. This example uses a managed image; the same storage options can be passed when [launching a named kit](/ai/sandboxes-api/cookbook/get-a-stored-secret-into-a-sandbox/add-tools-with-kits/).

Attach the secret when creating the sandbox, before starting the agent. Passing a secret's display name instead of its resource name will not select it. Keep the real token on the client side of the storage step rather than duplicating it in environment variables.

The SDK returns a handle after the example waits for the sandbox to run. Use that handle to run the agent. To replace or delete the credential later, follow [Manage cloud secrets](/ai/sandboxes-api/cookbook/get-a-stored-secret-into-a-sandbox/manage-cloud-secrets/).

**TypeScript**



```typescript
const sandbox = await client.create(
  { displayName: name, image, storage: { secrets: secretNames } },
  { timeoutMs: 300_000, idempotencyKey: requestId },
);
return sandbox.waitUntilRunning();
```

<details>
<summary>Complete TypeScript example: credinject/attach.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function createWithSecrets(
  client: Sandboxes,
  name: string,
  image: string,
  secretNames: string[],
  requestId: string,
) {
  const sandbox = await client.create(
    { displayName: name, image, storage: { secrets: secretNames } },
    { timeoutMs: 300_000, idempotencyKey: requestId },
  );
  return sandbox.waitUntilRunning();
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/get-an-ssh-certificate/ fetched 2026-10-08 -->

# Get an SSH certificate


Request a short-lived SSH certificate for access to a sandbox. Keep the private key on your machine; send only the public key to Docker.

You need an [authenticated client](/ai/sandboxes-api/cookbook/get-an-ssh-certificate/connect-to-cloud-with-a-bearer-token/), a sandbox name, and an SSH public key. Generate a key pair with your SSH tooling if you do not have one.

## Request the certificate {#1-request-the-certificate}

Pass the sandbox name and public key. Save the returned certificate using your SSH client's expected certificate-file format, alongside the matching private key.

The response supplies the connection details for the sandbox. Use them rather than guessing a hostname or port. The example returns those details; it does not start an SSH process.

A certificate expires. Request a new one when needed, and keep the private key and certificate out of your repository. For programmatic command execution without an SSH client, use [processes](/ai/sandboxes-api/cookbook/get-an-ssh-certificate/run-your-first-command/).

**TypeScript**



```typescript
return sandbox.ssh.issueCertificate({
  publicKey,
  ttlMs: lifeSeconds * 1_000,
});
```

<details>
<summary>Complete TypeScript example: ssh/certificate.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function issueSSHCert(
  client: Sandboxes,
  sandboxName: string,
  publicKey: string,
  lifeSeconds: number,
) {
  const sandbox = await client.get(sandboxName);
  return sandbox.ssh.issueCertificate({
    publicKey,
    ttlMs: lifeSeconds * 1_000,
  });
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/get-image-pull-urls/ fetched 2026-10-08 -->

# Get image pull URLs


Obtain the registry references needed to pull a managed image with an OCI-compatible tool. This is useful when another part of your workflow needs the image content outside a sandbox.

You need an [authenticated client](/ai/sandboxes-api/cookbook/get-image-pull-urls/connect-to-cloud-with-a-bearer-token/) and the image name returned by [image registration](/ai/sandboxes-api/cookbook/get-image-pull-urls/register-and-manage-an-image/).

## Get the pull information {#1-get-the-pull-information}

Read the image's pull specification. The result identifies its manifest digest and image references.

Pass those references to your OCI client. This example only retrieves the pull information; it does not download layers or authenticate a separate registry client. Treat any returned access information as sensitive, and do not publish it in logs.

**TypeScript**



```typescript
const image = await client.images.get(name);
return image.getPullSpec();
```

<details>
<summary>Complete TypeScript example: pullspec/spec.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function getImagePullSpec(client: Sandboxes, name: string) {
  const image = await client.images.get(name);
  return image.getPullSpec();
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/give-a-sandbox-an-mcp-gateway/ fetched 2026-10-08 -->

# Give a sandbox an MCP gateway


Give an agent access to external tools through MCP, the Model Context Protocol. A gateway presents several tool servers through one endpoint.

Use an [authenticated client](/ai/sandboxes-api/cookbook/give-a-sandbox-an-mcp-gateway/connect-to-cloud-with-a-bearer-token/) and server IDs available to your account. Choose servers from the [Docker MCP Catalog](https://docs.docker.com/ai/mcp-catalog-and-toolkit/catalog/) and use their catalog IDs, not display names invented by your application. Provider sign-in and permission to use each tool may be required.

## Configure MCP when launching a kit {#1-configure-mcp-when-launching-a-kit}

Supply the server IDs in the kit's MCP options when creating the sandbox. This makes gateway configuration available when the agent starts. Attach any model-provider secrets the agent needs separately.

To add a gateway to an existing sandbox, recreate the sandbox with MCP configured. There is no separate gateway start or stop operation.

**TypeScript**



```typescript
const sandbox = await client.kits.launch(
  kitName,
  {
    resources: { cpus: 2, memoryMib: 4096 },
    mcp: { servers, static: true },
    storage: { secrets },
  },
  { timeoutMs: 300_000 },
);
return sandbox.waitUntilRunning();
```

<details>
<summary>Complete TypeScript example: mcp/create.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function launchMcpKit(
  client: Sandboxes,
  kitName: string,
  servers: string[],
  secrets: string[] = [],
) {
  const sandbox = await client.kits.launch(
    kitName,
    {
      resources: { cpus: 2, memoryMib: 4096 },
      mcp: { servers, static: true },
      storage: { secrets },
    },
    { timeoutMs: 300_000 },
  );
  return sandbox.waitUntilRunning();
}
```

</details>



## Read the gateway address {#2-read-the-gateway-address}

Read the gateway by its `sandboxes/{sandbox}/mcp-gateway` name. The example waits through provisioning with the SDK's bounded waiter and returns the URL only when ready. A failed gateway or an expired wait returns an error. Supply a timeout appropriate for your application.

Keep gateway credentials private. The gateway's address and the published URL of an application inside the sandbox are different endpoints.

**TypeScript**



```typescript
const deadline = AbortSignal.timeout(options.timeoutMs);
const signal = options.signal
  ? AbortSignal.any([options.signal, deadline])
  : deadline;
options = { ...options, signal };
const observed = await client.getMcpGateway({ name }, options);
const gateway = await client
  .mcpGateway(observed)
  .waitFor(['ready', 'failed'], options);
if (gateway.state !== 'ready')
  throw new Error('MCP gateway is not ready');
if (!gateway.url) throw new Error('The ready MCP gateway has no URL');
return gateway.url;
```

<details>
<summary>Complete TypeScript example: mcp/read.ts</summary>

```typescript
import type { Sandboxes, WaitOptions } from '@docker/sandboxes';

export async function readGatewayUrl(
  client: Sandboxes,
  name: string,
  options: WaitOptions = { timeoutMs: 120_000 },
) {
  const deadline = AbortSignal.timeout(options.timeoutMs);
  const signal = options.signal
    ? AbortSignal.any([options.signal, deadline])
    : deadline;
  options = { ...options, signal };
  const observed = await client.getMcpGateway({ name }, options);
  const gateway = await client
    .mcpGateway(observed)
    .waitFor(['ready', 'failed'], options);
  if (gateway.state !== 'ready')
    throw new Error('MCP gateway is not ready');
  if (!gateway.url) throw new Error('The ready MCP gateway has no URL');
  return gateway.url;
}
```

</details>



## Add a catalog server {#3-add-a-catalog-server}

Add a server to a ready, writable gateway. Adding a server already present does not add a second copy. A shared gateway attached by URL cannot be modified through this sandbox.

**TypeScript**



```typescript
await sandbox.mcp.servers.add({ server });
```

<details>
<summary>Complete TypeScript example: mcp/add.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function addMcpGatewayServer(
  client: Sandboxes,
  name: string,
  server: string,
) {
  const sandbox = await client.get(name.replace(/\/mcp-gateway$/, ''));
  await sandbox.mcp.servers.add({ server });
}
```

</details>



## Complete a server's sign-in {#4-complete-a-server-s-sign-in}

Start authorization for a server that requires user sign-in. Present its authorization URL to the user, then read the authorization resource to check progress. The example performs the start and read calls; your application decides how to display and poll the flow.

Only an authorized result means the credential is ready. Keep the authorization identity so a later attempt is not mistaken for completion of an earlier one. Request reauthorization only when you intend a new sign-in.

Delete the sandbox when it is no longer needed. Its managed gateway is cleaned up with it; a shared gateway attached by URL remains available to its other users.

**TypeScript**



```typescript
return client.mcp.authorizations.authorize({
  server: name,
  forceReauth,
});
```

<details>
<summary>Complete TypeScript example: mcp/authorize.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function authorizeMcpServer(
  client: Sandboxes,
  name: string,
  forceReauth: boolean,
) {
  return client.mcp.authorizations.authorize({
    server: name,
    forceReauth,
  });
}

export async function getMcpAuthorization(
  client: Sandboxes,
  name: string,
) {
  return client.mcp.authorizations.get(name);
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/handle-errors-and-degradation/ fetched 2026-10-08 -->

# Handle errors and degradation


Distinguish a rejected request from an accepted operation that later fails. This keeps retries from hiding invalid input or duplicating work.

The SDK exposes typed request and wait errors. A command's nonzero exit code is a third outcome: the SDK can successfully observe a command that failed.

## Classify the failure {#1-classify-the-failure}

Use the error type and structured code, not the text of its message. The example groups common request failures and retains their details for the caller.

- Invalid arguments need a corrected request.
- Authentication failures need a valid credential; permission failures need appropriate account access.
- A wrong-state error needs a state check before another attempt.
- A capacity or quota refusal may require waiting or reducing usage.
- A transient availability failure may be retryable if the operation can be repeated safely.

Wait errors retain the state or resource observed before the wait stopped. Inspect that information and read the resource again when necessary. A failed create, an interrupted wait, and an expired client deadline do not have the same cleanup outcome.

A process helper can fail while obtaining a sandbox credential or reading output after the process has started. The error retains the accepted process and its cause. That process may still be running: inspect it before deciding whether to retry the command. Inspect the cause chain for a typed credential-service rate-limit error, including any request identifier and retry delay supplied by the service.

Unknown errors remain unknown in the example. They may be connection failures before any response arrived. Do not assume that a write was never accepted.

Keep credentials and secret-bearing request bodies out of diagnostics. Record resource names, error codes, and request identifiers instead. See [safe retries](/ai/sandboxes-api/cookbook/handle-errors-and-degradation/retry-without-creating-duplicates/) before repeating a mutation.

**TypeScript**



```typescript
if (!(error instanceof RequestError)) {
  return { kind: 'other', code: undefined, details: [] };
}
const { code, details } = error.raw;
const known = KINDS.get(code);
return { kind: known ?? 'other', code, details: details ?? [] };
```

<details>
<summary>Complete TypeScript example: failures/classify.ts</summary>

```typescript
import { RequestError, ResourceWaitError } from '@docker/sandboxes';

type Status = RequestError['raw'];
type Detail = NonNullable<Status['details']>[number];

export type FailureKind =
  | 'invalid-request'
  | 'not-served'
  | 'wrong-state'
  | 'exhausted'
  | 'access-or-missing'
  | 'unavailable'
  | 'other';

export interface Failure {
  kind: FailureKind;
  code: string | undefined;
  details: Detail[];
}

const KINDS = new Map<string, FailureKind>([
  ['invalidArgument', 'invalid-request'],
  ['unimplemented', 'not-served'],
  ['failedPrecondition', 'wrong-state'],
  ['resourceExhausted', 'exhausted'],
  ['unauthenticated', 'access-or-missing'],
  ['permissionDenied', 'access-or-missing'],
  ['notFound', 'access-or-missing'],
  ['unavailable', 'unavailable'],
]);

export function readFailure(error: unknown): Failure {
  if (!(error instanceof RequestError)) {
    return { kind: 'other', code: undefined, details: [] };
  }
  const { code, details } = error.raw;
  const known = KINDS.get(code);
  return { kind: known ?? 'other', code, details: details ?? [] };
}

export function readSandboxWait(
  error: unknown,
): 'degraded' | 'failed' | 'other' {
  if (error instanceof ResourceWaitError) {
    if (error.kind === 'interrupted' && error.state === 'degraded')
      return 'degraded';
    if (error.kind === 'failure' && error.state === 'failed')
      return 'failed';
  }
  return 'other';
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/keep-a-cloud-sandbox-running/ fetched 2026-10-08 -->

# Keep a cloud sandbox running


Set a sandbox lifetime to prevent abandoned work from running indefinitely, and choose what happens when it expires.

You need an [authenticated client](/ai/sandboxes-api/cookbook/keep-a-cloud-sandbox-running/connect-to-cloud-with-a-bearer-token/) and a managed image. The same lifecycle options can be supplied when launching a kit.

## Set the lifetime at creation {#1-set-the-lifetime-at-creation}

Pass the lifetime in the units shown by your SDK and choose the expiry action. The example accepts seconds and converts to the SDK's duration representation.

Stopping preserves the sandbox for later use; deletion removes it. Check that your choice matches whether the application needs the sandbox's files after expiry. Account limits may restrict permitted durations and actions.

Accounts with always-on access can instead select the restart action. This preserves memory through automatic stop-and-resume cycles. It retains a concurrency reservation while stopped and is different from restarting in response to an incoming request.

The example waits for startup. Its wait deadline is separate from the sandbox lifetime: ending a client wait does not delete the sandbox.

**TypeScript**



```typescript
const sandbox = await client.create(
  {
    displayName: name,
    image,
    lifecycle: {
      timeoutMs: lifeSeconds * 1_000,
      onTimeout: stopOnTimeout ? 'stop' : 'delete',
    },
  },
  { timeoutMs: 300_000, idempotencyKey: requestId },
);
return sandbox.waitUntilRunning();
```

<details>
<summary>Complete TypeScript example: timeout/deadline.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function createWithDeadline(
  client: Sandboxes,
  name: string,
  image: string,
  lifeSeconds: number,
  stopOnTimeout: boolean,
  requestId: string,
) {
  const sandbox = await client.create(
    {
      displayName: name,
      image,
      lifecycle: {
        timeoutMs: lifeSeconds * 1_000,
        onTimeout: stopOnTimeout ? 'stop' : 'delete',
      },
    },
    { timeoutMs: 300_000, idempotencyKey: requestId },
  );
  return sandbox.waitUntilRunning();
}
```

</details>



## Extend the remaining lifetime {#2-extend-the-remaining-lifetime}

Use `renewTimeout()` to extend the sandbox's remaining lifetime. Pass the desired duration from the time the service accepts the renewal, not an increment to add to the existing deadline. Renewal can only extend the lifetime; it cannot shorten it.

Renew a configured timeout before it expires. If the call fails, inspect the sandbox's current state instead of assuming that renewal took effect.

The service manages timeouts for automatically restarting sandboxes; do not renew those yourself.

For request-triggered restart after a stop, see [Resume on demand](/ai/sandboxes-api/cookbook/keep-a-cloud-sandbox-running/let-a-stopped-sandbox-resume-on-demand/).

**TypeScript**



```typescript
return sandbox.renewTimeout({ timeoutMs: remainingSeconds * 1_000 });
```

<details>
<summary>Complete TypeScript example: timeout/renew.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function renewSandboxTimeout(
  client: Sandboxes,
  name: string,
  remainingSeconds: number,
) {
  const sandbox = await client.get(name);
  return sandbox.renewTimeout({ timeoutMs: remainingSeconds * 1_000 });
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/let-a-stopped-sandbox-resume-on-demand/ fetched 2026-10-08 -->

# Let a stopped sandbox resume on demand


Let a request to a published application start a stopped sandbox. This can suit an application that should be available on demand without remaining active between uses.

Use an [authenticated client](/ai/sandboxes-api/cookbook/let-a-stopped-sandbox-resume-on-demand/connect-to-cloud-with-a-bearer-token/) and a managed image that starts the application. [Publish its port](/ai/sandboxes-api/cookbook/let-a-stopped-sandbox-resume-on-demand/expose-a-port-from-a-cloud-sandbox/) before relying on requests to reach it.

## Configure resume on creation {#1-configure-resume-on-creation}

Set automatic resume in the sandbox's lifecycle options. Omit the value when you want the service default; explicitly set false to disable it.

The example waits for the initial startup. Automatic resume does not recover a deleted sandbox, and it does not replace application startup configuration.

**TypeScript**



```typescript
const sandbox = await client.create(
  { displayName: name, image, lifecycle: { autoResume } },
  { timeoutMs: 300_000, idempotencyKey: requestId },
);
return sandbox.waitUntilRunning();
```

<details>
<summary>Complete TypeScript example: wake/configure.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function createWithAutoResume(
  client: Sandboxes,
  name: string,
  image: string,
  autoResume: boolean | undefined,
  requestId: string,
) {
  const sandbox = await client.create(
    { displayName: name, image, lifecycle: { autoResume } },
    { timeoutMs: 300_000, idempotencyKey: requestId },
  );
  return sandbox.waitUntilRunning();
}
```

</details>



## Read the effective setting {#2-read-the-effective-setting}

Get the sandbox and inspect the effective lifecycle automatic-resume value together with its state. The example falls back to the timeout value for older responses and reports an error if neither value is present. An absent value is unknown, not disabled.

This checks what the service recorded; it does not send a request to the application or prove that the application can start. Authentication is still required.

To verify the whole flow, stop the sandbox, request its published application URL, and confirm that the application becomes ready. Allow for startup time and keep the application's own authentication enabled.

**TypeScript**



```typescript
const sandbox = await client.get(name);
const active =
  sandbox.effectiveFeatures?.lifecycle?.autoResume ??
  sandbox.effectiveFeatures?.timeouts?.autoResume;
if (active == null) {
  throw new Error(`sandbox ${name}: auto-resume setting is unknown`);
}
return {
  autoResume: active,
  status: sandbox.status,
};
```

<details>
<summary>Complete TypeScript example: wake/verify.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function autoResumeInForce(client: Sandboxes, name: string) {
  const sandbox = await client.get(name);
  const active =
    sandbox.effectiveFeatures?.lifecycle?.autoResume ??
    sandbox.effectiveFeatures?.timeouts?.autoResume;
  if (active == null) {
    throw new Error(`sandbox ${name}: auto-resume setting is unknown`);
  }
  return {
    autoResume: active,
    status: sandbox.status,
  };
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/manage-cloud-secrets/ fetched 2026-10-08 -->

# Manage cloud secrets


Store workload credentials separately from application code. Secret reads return metadata only, so keep the original credential in your secret manager if you need it elsewhere.

Use an [authenticated client](/ai/sandboxes-api/cookbook/manage-cloud-secrets/connect-to-cloud-with-a-bearer-token/). These examples store a token for a named service. For instructions on giving a kit access to that token, see [Get a stored secret into a sandbox](/ai/sandboxes-api/cookbook/manage-cloud-secrets/get-a-stored-secret-into-a-sandbox/).

## Create a secret {#1-create-a-secret}

Pass a display name, service type, token value, and idempotency key. Save the returned resource name for attachments and future updates. Do not log the request or token.

**TypeScript**



```typescript
return client.secrets.create(
  { displayName: name, serviceType, token: { value: token } },
  { idempotencyKey: requestId },
);
```

<details>
<summary>Complete TypeScript example: secrets/create.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function createSecret(
  client: Sandboxes,
  name: string,
  serviceType: string,
  token: string,
  requestId: string,
) {
  return client.secrets.create(
    { displayName: name, serviceType, token: { value: token } },
    { idempotencyKey: requestId },
  );
}
```

</details>



## List stored credentials {#2-list-stored-credentials}

List secret metadata to find a credential by name or label. The example follows each page. Listing does not reveal secret values.

Use the resource name, not the display name, when attaching a secret to a sandbox.

**TypeScript**



```typescript
return client.secrets.all().collect();
```

<details>
<summary>Complete TypeScript example: secrets/list.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function listSecrets(client: Sandboxes) {
  return client.secrets.all().collect();
}
```

</details>



## Rotate the credential {#3-rotate-the-credential}

Read the existing secret, then update it through a handle with the replacement value and service type. The handle carries the version it read so an intervening change is detected.

The update replaces the record's writable content. Send the service type again instead of assuming omitted values are preserved. Keep the returned metadata for subsequent operations.

If another writer changed the secret, read it again and decide whether to apply your replacement. Do not silently overwrite another rotation.

**TypeScript**



```typescript
return secret.update(
  { serviceType, token: { value: token } },
  { idempotencyKey: requestId },
);
```

<details>
<summary>Complete TypeScript example: secrets/update.ts</summary>

```typescript
import type { Secret } from '@docker/sandboxes';

export async function updateSecret(
  secret: Secret,
  serviceType: string,
  token: string,
  requestId: string,
) {
  return secret.update(
    { serviceType, token: { value: token } },
    { idempotencyKey: requestId },
  );
}
```

</details>



## Delete a secret {#4-delete-a-secret}

Delete through the secret handle when no workload needs the credential. Deleting an already absent secret is safe for repeated cleanup.

Removing a stored secret is not a substitute for revoking a leaked credential with its provider. Revoke compromised credentials and replace them before starting new workloads.

**TypeScript**



```typescript
await secret.delete();
```

<details>
<summary>Complete TypeScript example: secrets/delete.ts</summary>

```typescript
import type { Secret } from '@docker/sandboxes';

export async function deleteSecret(secret: Secret) {
  await secret.delete();
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/manage-network-policies/ fetched 2026-10-08 -->

# Manage network policies


Create reusable network policies in your Docker account, then attach their IDs when creating sandboxes. The SDK's governance collection uses the same Docker authentication as the sandbox client.

Start with an [authenticated client](/ai/sandboxes-api/cookbook/manage-network-policies/connect-to-cloud-with-a-bearer-token/). These methods manage your personal policies, not organization-wide administration.

## Manage a policy's lifetime {#1-manage-a-policy-s-lifetime}

The example creates a policy, lists the available policies, reads the new one, and replaces its definition. It attempts to delete the temporary policy in cleanup, including when a later step fails. Check cleanup errors; a cancelled request can leave the policy behind.

Supply a policy definition and a replacement using your SDK's policy input type. Include the destinations your workload needs. For a deny-by-default policy, allow the agent's model provider and any required package registries explicitly.

Set `status: 'POLICY_STATUS_ACTIVE'` on both the policy and its replacement. Although the SDK type makes this field optional, the service rejects omitted or other values with `unimplemented`.

An update replaces the definition rather than appending rules. Read the existing policy before deciding what to retain. Personal-policy mutations are not automatically replayed, so inspect the current state after an uncertain result before trying again.

This is a disposable policy-management example: the returned policy ID has been deleted by the time the function finishes. To keep a policy for real workloads, remove that demonstration cleanup and store its ID with your application configuration. Follow [Control what a sandbox can reach](/ai/sandboxes-api/cookbook/manage-network-policies/control-what-a-sandbox-can-reach/) to attach it and inspect enforced rules.

**TypeScript**



```typescript
const created = await client.governance.policies.create(policy);
try {
  const listed = await client.governance.policies.list();
  const current = await client.governance.policies.get(created.id);
  const updated = await client.governance.policies.update(
    created.id,
    replacement,
  );
  return { listed, current, updated };
} finally {
  await client.governance.policies.delete(created.id);
}
```

<details>
<summary>Complete TypeScript example: policies/manage.ts</summary>

```typescript
import type { GovernancePolicyInput, Sandboxes } from '@docker/sandboxes';

export async function managePolicy(
  client: Sandboxes,
  policy: GovernancePolicyInput,
  replacement: GovernancePolicyInput,
) {
  const created = await client.governance.policies.create(policy);
  try {
    const listed = await client.governance.policies.list();
    const current = await client.governance.policies.get(created.id);
    const updated = await client.governance.policies.update(
      created.id,
      replacement,
    );
    return { listed, current, updated };
  } finally {
    await client.governance.policies.delete(created.id);
  }
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/page-through-and-filter-lists/ fetched 2026-10-08 -->

# Page through and filter lists


List resources without losing results at page boundaries. SDK collection iterators request each page for you; collecting materializes the complete result in memory.

Use an [authenticated client](/ai/sandboxes-api/cookbook/page-through-and-filter-lists/connect-to-cloud-with-a-bearer-token/). For a large account, process iterator items as they arrive instead of collecting them all.

## Walk every sandbox {#1-walk-every-sandbox}

Set a page size and iterate the sandbox collection. The example collects the results for convenience. A page size controls each request, not the total number of returned resources.

When using one-page methods directly, pass the returned next-page token unchanged and keep the filter, order, and page size stable. Stop when no next token is returned, not when a page contains fewer items than requested.

**TypeScript**



```typescript
return client.all({ pageSize }).collect();
```

<details>
<summary>Complete TypeScript example: pagination/walk.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function walkSandboxes(client: Sandboxes, pageSize: number) {
  return client.all({ pageSize }).collect();
}
```

</details>



## Filter and order the result {#2-filter-and-order-the-result}

Pass a filter and ordering supported by the collection. The example uses images; choose a filter such as `status=completed` to select ready images.

Filters are strings interpreted by the service. Use the field names and operators documented for that list method rather than a language object's property names. An invalid filter should be fixed, not silently removed and retried as an unfiltered list.

**TypeScript**



```typescript
return client.images.all({ filter, orderBy }).collect();
```

<details>
<summary>Complete TypeScript example: pagination/filter.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function filterImages(
  client: Sandboxes,
  filter: string,
  orderBy: string,
) {
  return client.images.all({ filter, orderBy }).collect();
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/read-files-out-of-a-sandbox/ fetched 2026-10-08 -->

# Read files out of a sandbox


Read build results, inspect project files, or copy data out before deleting a sandbox. Start with a running sandbox handle and an absolute path inside it.

The examples return content to your application. To keep it on your machine, write the received bytes to a local file.

## List a directory {#1-list-a-directory}

Walk the directory through the file collection's iterator. It follows pagination and returns the entries. Listing gives metadata, not file content.

**TypeScript**



```typescript
return sandbox.files.all(path).collect();
```

<details>
<summary>Complete TypeScript example: download/list.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function listDirectory(sandbox: Sandbox, path: string) {
  return sandbox.files.all(path).collect();
}
```

</details>



## Read a small text file {#2-read-a-small-text-file}

Use the bounded read helper for text you want in memory. The example limits the read to one MiB. Choose a bound that fits your application's memory budget, or download a larger file as a stream.

**TypeScript**



```typescript
return sandbox.files.read(path, {
  encoding: 'utf8',
  maxBytes: 1024 * 1024,
});
```

<details>
<summary>Complete TypeScript example: download/read.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function readFile(sandbox: Sandbox, path: string) {
  return sandbox.files.read(path, {
    encoding: 'utf8',
    maxBytes: 1024 * 1024,
  });
}
```

</details>



## Inspect a path {#3-inspect-a-path}

Read metadata before deciding whether to download, move, or remove a path. A successful metadata read does not reserve the file: another process may change it afterward.

**TypeScript**



```typescript
return sandbox.files.stat(path);
```

<details>
<summary>Complete TypeScript example: download/stat.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function statFile(sandbox: Sandbox, path: string) {
  return sandbox.files.stat(path);
}
```

</details>



## Download a file as a stream {#4-download-a-file-as-a-stream}

Pass the sandbox path and a callback or writer that consumes bytes. The example closes the transfer when it finishes or fails.

Treat the download as complete only when it ends successfully. If it fails halfway through, discard or separately identify the partial local file before retrying.

**TypeScript**



```typescript
const download = await sandbox.files.download(path);
try {
  for await (const chunk of download) write(chunk);
} finally {
  await download.close();
}
```

<details>
<summary>Complete TypeScript example: download/download.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function downloadFiles(
  sandbox: Sandbox,
  path: string,
  write: (bytes: Uint8Array) => void,
) {
  const download = await sandbox.files.download(path);
  try {
    for await (const chunk of download) write(chunk);
  } finally {
    await download.close();
  }
}
```

</details>



## Move a path {#5-move-a-path}

Pass the current path and destination. This moves data inside the sandbox; it does not download anything to your computer.

**TypeScript**



```typescript
await sandbox.files.move(from, to);
```

<details>
<summary>Complete TypeScript example: download/move.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function movePath(
  sandbox: Sandbox,
  from: string,
  to: string,
) {
  await sandbox.files.move(from, to);
}
```

</details>



## Remove a path {#6-remove-a-path}

Remove a file, or enable recursive removal for a directory tree. Check the result for a failed path rather than assuming that every requested removal succeeded.

Recursive removal is destructive. Keep user-supplied paths constrained to the directory your application owns.

**TypeScript**



```typescript
const result = await sandbox.files.remove(path, { recursive });
if (result.failedPath)
  throw new Error(`Remove ${path} stopped at ${result.failedPath}`);
```

<details>
<summary>Complete TypeScript example: download/remove.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function removePath(
  sandbox: Sandbox,
  path: string,
  recursive: boolean,
) {
  const result = await sandbox.files.remove(path, { recursive });
  if (result.failedPath)
    throw new Error(`Remove ${path} stopped at ${result.failedPath}`);
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/recover-when-the-endpoint-moves/ fetched 2026-10-08 -->

# Recover when the endpoint moves


Refresh a sandbox handle after a restart or connection change. A saved address can become stale even though the sandbox still has the same resource name.

Start with the handle your application already holds. Keep its name and UID; do not replace them with another sandbox's identity.

## Compare the current endpoint {#1-compare-the-current-endpoint}

Refresh the handle, then compare the old and new connection information. The SDK checks the resource identity while constructing the refreshed handle.

The example reports whether the endpoint changed and returns a refreshed handle. Use that handle for later process and file calls.

**TypeScript**



```typescript
const current = await held.refresh();
const before = held.core.endpoint;
const after = current.core.endpoint;
return {
  moved:
    before?.uri !== after?.uri || before?.protocol !== after?.protocol,
  current,
};
```

<details>
<summary>Complete TypeScript example: rebind/detect.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function endpointMoved(held: Sandbox) {
  const current = await held.refresh();
  const before = held.core.endpoint;
  const after = current.core.endpoint;
  return {
    moved:
      before?.uri !== after?.uri || before?.protocol !== after?.protocol,
    current,
  };
}
```

</details>



## Run through the refreshed handle {#2-run-through-the-refreshed-handle}

Refresh before opening a new process connection. The SDK obtains the appropriate sandbox credential for the current endpoint; your application does not need to pass its Docker account token there.

This example starts new work after refresh. It does not replay a command whose completion is unknown. If an earlier command may still be running, [find and reconnect to it](/ai/sandboxes-api/cookbook/recover-when-the-endpoint-moves/find-a-process-you-lost-track-of/) first.

**TypeScript**



```typescript
const current = await held.refresh();
return current.processes.run({ args }, { timeoutMs: 300_000 });
```

<details>
<summary>Complete TypeScript example: rebind/rebuild.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function runAndRebind(held: Sandbox, args: string[]) {
  const current = await held.refresh();
  return current.processes.run({ args }, { timeoutMs: 300_000 });
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/register-and-manage-an-image/ fetched 2026-10-08 -->

# Register and manage an image


Reuse an image across sandboxes by registering it with Docker Cloud Sandboxes. Registration creates an image record and a temporary upload destination. You must push the image content separately with an OCI-compatible registry client.

Start with an [authenticated client](/ai/sandboxes-api/cookbook/register-and-manage-an-image/connect-to-cloud-with-a-bearer-token/) and a built image. If you already have an image in a registry, [run it directly](/ai/sandboxes-api/cookbook/register-and-manage-an-image/run-your-own-container-image/) instead.

## Register an upload destination {#1-register-an-upload-destination}

Choose a display name, startup command, CPU and memory preferences, and an idempotency key. The returned image includes its resource name and a push target.

Use the target's registry reference and temporary credential to push your image. Keep that credential private and finish before it expires. Save the target from the initial response: later image reads do not issue a replacement upload credential.

This example registers the destination. It does not build or push image content.

**TypeScript**



```typescript
return client.images.create(
  { displayName: name, fromImage: { resources }, startCmd },
  { idempotencyKey: requestId },
);
```

<details>
<summary>Complete TypeScript example: images/create.ts</summary>

```typescript
import type {
  ClientImagesCreateOptions,
  Sandboxes,
} from '@docker/sandboxes';

export async function createImage(
  client: Sandboxes,
  name: string,
  startCmd: string[],
  resources: Extract<
    ClientImagesCreateOptions,
    { fromImage: unknown }
  >['fromImage']['resources'],
  requestId: string,
) {
  return client.images.create(
    { displayName: name, fromImage: { resources }, startCmd },
    { idempotencyKey: requestId },
  );
}
```

</details>



## Check preparation status {#2-check-preparation-status}

After the push finishes, read the image by its resource name. A `COMPLETED` status means it is ready to use. `WAITING_FOR_PUSH` means content has not arrived, `PREPARING` means preparation is in progress, and `FAILED` includes failure details.

The example performs one read. If preparation is still in progress, repeat the read with a delay and deadline. Repeating creation would register another image rather than advance this one.

**TypeScript**



```typescript
return client.images.get(name);
```

<details>
<summary>Complete TypeScript example: images/ready.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function getImage(client: Sandboxes, name: string) {
  return client.images.get(name);
}
```

</details>



## Find registered images {#3-find-registered-images}

List images with an optional filter, such as `status=completed`. The example follows all pages. List entries are summaries; get the image by name when you need its complete record.

**TypeScript**



```typescript
return client.images.all({ filter }).collect();
```

<details>
<summary>Complete TypeScript example: images/list.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function listImages(client: Sandboxes, filter: string) {
  return client.images.all({ filter }).collect();
}
```

</details>



## Remove an image {#4-remove-an-image}

Read the image and delete through its handle. The SDK supplies its name and version to protect against deleting a newer record you have not read.

Keep images that future sandbox creations still depend on. Deleting an already absent image is safe for cleanup.

**TypeScript**



```typescript
await image.delete();
```

<details>
<summary>Complete TypeScript example: images/delete.ts</summary>

```typescript
import type { Image } from '@docker/sandboxes';

export async function deleteImage(image: Image) {
  await image.delete();
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/retry-without-creating-duplicates/ fetched 2026-10-08 -->

# Retry without creating duplicates


Retry a request without creating duplicate work. An idempotency key identifies one logical operation, such as creating the sandbox for a particular job.

Use an [authenticated client](/ai/sandboxes-api/cookbook/retry-without-creating-duplicates/connect-to-cloud-with-a-bearer-token/). Generate the key once, then persist it with the job if retries can happen in another program run.

## Retry the same create request {#1-retry-the-same-create-request}

Reuse the same key and payload on every attempt. The example retries a transient availability refusal and disables automatic SDK retries. Do not run your own retry loop and the SDK's together without accounting for their total attempts.

Use a deadline and a bounded attempt count. For production retry scheduling, add delay and jitter or use the SDK's configured retry behavior. Changing the payload while keeping the key is not an update; it conflicts with the original request.

An accepted creation returns the sandbox's resource data. Save its name and use the client's get method to obtain a handle. Read or wait on that resource to follow progress instead of repeating creation to make it advance.

**TypeScript**



```typescript
for (let attempt = 0; attempt < attempts; attempt++) {
  try {
    return await client.kits.launch(
      'shell',
      { displayName, resources: { cpus: 2, memoryMib: 4096 } },
      {
        idempotencyKey: requestId,
        timeoutMs: 300_000,
        signal,
        maxRetries: 0,
      },
    );
  } catch (error) {
    if (
      !(error instanceof RequestError) ||
      error.raw.code !== 'unavailable' ||
      attempt + 1 === attempts
    )
      throw error;
  }
}
```

<details>
<summary>Complete TypeScript example: idempotency/retry.ts</summary>

```typescript
import { RequestError, type Sandboxes } from '@docker/sandboxes';

export async function createWithRetry(
  client: Sandboxes,
  displayName: string,
  requestId: string,
  attempts: number,
) {
  if (!Number.isInteger(attempts) || attempts < 1)
    throw new RangeError('attempts must be at least 1');
  const signal = AbortSignal.timeout(300_000);
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await client.kits.launch(
        'shell',
        { displayName, resources: { cpus: 2, memoryMib: 4096 } },
        {
          idempotencyKey: requestId,
          timeoutMs: 300_000,
          signal,
          maxRetries: 0,
        },
      );
    } catch (error) {
      if (
        !(error instanceof RequestError) ||
        error.raw.code !== 'unavailable' ||
        attempt + 1 === attempts
      )
        throw error;
    }
  }
  throw new Error('attempt count was validated');
}
```

</details>



## Start a process once {#2-start-a-process-once}

Start the process with its own idempotency key and keep the returned process name. After losing a response or connection, find that process before starting another one.

Keys do not make every operation safe to replay. Repeating process input, a signal, or a file write can have a second effect. Use [process reconnection](/ai/sandboxes-api/cookbook/retry-without-creating-duplicates/find-a-process-you-lost-track-of/) for a lost stream and inspect files before repeating an uncertain write.

**TypeScript**



```typescript
return sandbox.processes.start({ args }, { idempotencyKey: requestId });
```

<details>
<summary>Complete TypeScript example: idempotency/unsafe.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function createProcessOnce(
  sandbox: Sandbox,
  args: string[],
  requestId: string,
) {
  return sandbox.processes.start({ args }, { idempotencyKey: requestId });
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/run-a-complete-example/ fetched 2026-10-08 -->

# Run a complete example


Run a small program that signs in to Docker, creates a sandbox from the `shell` kit, prints a greeting, and deletes the sandbox. You do not need a model-provider key for this example.

[Install your SDK](https://docs.docker.com/ai/sandboxes-api/install/) first. Your Docker account must have Cloud Sandboxes access and billing set up. This program creates a real sandbox with 2 CPUs and 4096 MiB of memory; compute usage is subject to your Docker billing terms.

## Run the program {#1-run-the-program}

Expand the complete example and copy the whole program into a file. Save it as `example.mts`, then run `npx tsx example.mts`.

The program prints a verification URL and code. Open the URL, enter the code, and approve sign-in. Your terminal then shows the sandbox's name and `Hello from Docker Sandboxes`. The program checks the command's exit status and attempts to delete its sandbox before closing the client.

The program waits for sign-in to finish or the verification code to expire. After sign-in, creating the sandbox and running the command share a five-minute time limit. Once the program receives the new sandbox's details, it allows another 30 seconds to delete that sandbox, even if a later step fails.

If sign-in fails, follow the steps in [Authenticate to Docker](/ai/sandboxes-api/cookbook/run-a-complete-example/connect-to-cloud-with-a-bearer-token/). If sandbox creation fails, check account access and [resource limits](/ai/sandboxes-api/cookbook/run-a-complete-example/work-within-the-limits/).

A creation timeout can occur after Docker creates the sandbox but before the program receives its details. In that case, the program cannot delete it. [List your sandboxes](/ai/sandboxes-api/cookbook/run-a-complete-example/page-through-and-filter-lists/) to check for a sandbox created by this run and [delete it](/ai/sandboxes-api/cookbook/run-a-complete-example/delete-a-cloud-sandbox/) if needed. If deletion fails or times out, use the sandbox name printed in your terminal to check whether it still exists.

This example deletes its sandbox because it is a one-off demonstration. Next, [keep a sandbox for later work](/ai/sandboxes-api/cookbook/run-a-complete-example/create-your-first-sandbox/) or [run an agent kit](/ai/sandboxes-api/cookbook/run-a-complete-example/add-tools-with-kits/).

**TypeScript**



```typescript
const result = await sandbox.processes.run(
  {
    args: ['echo', 'Hello from Docker Sandboxes'],
  },
  operation,
);
console.log(result.stdout);
```

<details>
<summary>Complete TypeScript example: hello/main.ts</summary>

```typescript
import { pathToFileURL } from 'node:url';
import { oauth, Sandboxes, type Sandbox } from '@docker/sandboxes';

export async function main() {
  const auth = oauth({
    onVerification: ({ verificationUri, userCode }) => {
      console.log(`Open ${verificationUri} and enter ${userCode}`);
    },
  });
  const client = new Sandboxes({ auth });
  let sandbox: Sandbox | undefined;
  try {
    await auth.getAccessToken();
    const operation = {
      signal: AbortSignal.timeout(300_000),
      timeoutMs: 300_000,
    };
    sandbox = await client.kits.launch(
      'shell',
      {
        resources: { cpus: 2, memoryMib: 4096 },
      },
      operation,
    );
    console.log(`Sandbox: ${sandbox.name}`);
    sandbox = await sandbox.waitUntilRunning(operation);
    const result = await sandbox.processes.run(
      {
        args: ['echo', 'Hello from Docker Sandboxes'],
      },
      operation,
    );
    console.log(result.stdout);
    if (result.exitCode !== 0)
      throw new Error(`Command exited with status ${result.exitCode}`);
  } finally {
    try {
      if (sandbox) {
        const cleanup = { signal: AbortSignal.timeout(30_000) };
        const deleting = await sandbox.delete({ force: true }, cleanup);
        await deleting?.waitUntilDeleted(cleanup);
      }
    } finally {
      await client.close();
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/run-an-interactive-shell-in-a-cloud-sandbox/ fetched 2026-10-08 -->

# Run an interactive shell in a cloud sandbox


Run a process with a terminal when it expects interactive input. A terminal session differs from a captured command: you manage input, output, and connection lifetime.

Use a running sandbox handle from [your first sandbox](/ai/sandboxes-api/cookbook/run-an-interactive-shell-in-a-cloud-sandbox/create-your-first-sandbox/). Pass the command as an argument array, such as `['sh']`.

## Start a terminal process {#1-start-a-terminal-process}

Start the process with a pseudo-terminal and an initial terminal size. The returned process handle identifies this session. Save its resource name if you want to reconnect later.

Use one idempotency key for this start request. Reconnecting does not require starting another process.

**TypeScript**



```typescript
return sandbox.processes.start(
  { args, pty: { initialSize: { rows: 40, cols: 120 } } },
  { idempotencyKey: requestId },
);
```

<details>
<summary>Complete TypeScript example: shell/create.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function createProcess(
  sandbox: Sandbox,
  args: string[],
  requestId: string,
) {
  return sandbox.processes.start(
    { args, pty: { initialSize: { rows: 40, cols: 120 } } },
    { idempotencyKey: requestId },
  );
}
```

</details>



## Send input and read output {#2-send-input-and-read-output}

Connect to the process, write input, and consume output events. This example sends a finite input buffer and closes standard input; a terminal application should keep input open until the user finishes.

Forward output chunks to your terminal or callback. An exit event reports the process exit code. A connection ending without that event does not establish that the command finished.

Close the connection when you stop consuming it. Closing a connection and terminating the process are separate actions.

**TypeScript**



```typescript
const connection = await process.connect();
try {
  await connection.write(stdin);
  await connection.closeStdin();
  for await (const event of connection) {
    if (event.type === 'chunk')
      write(
        event.data ?? new Uint8Array(),
        BigInt(event.streamSequence ?? '0'),
      );
    if (event.type === 'exited') return event.exitCode ?? 0;
  }
  throw new Error(
    `Stream for ${process.name} ended before the process exited`,
  );
} finally {
  await connection.close();
}
```

<details>
<summary>Complete TypeScript example: shell/attach.ts</summary>

```typescript
import type { Process } from '@docker/sandboxes';

export async function attachToProcess(
  process: Process,
  stdin: Uint8Array,
  write: (bytes: Uint8Array, sequence: bigint) => void,
) {
  const connection = await process.connect();
  try {
    await connection.write(stdin);
    await connection.closeStdin();
    for await (const event of connection) {
      if (event.type === 'chunk')
        write(
          event.data ?? new Uint8Array(),
          BigInt(event.streamSequence ?? '0'),
        );
      if (event.type === 'exited') return event.exitCode ?? 0;
    }
    throw new Error(
      `Stream for ${process.name} ended before the process exited`,
    );
  } finally {
    await connection.close();
  }
}
```

</details>



## Resume output after a disconnect {#3-resume-output-after-a-disconnect}

Record the sequence number after handling each output chunk. On reconnect, pass the last handled sequence number to resume after that point.

Connections opened through TypeScript process handles resume automatically after temporary disconnects while you consume output. They use the last chunk delivered to your application, not the last chunk your application saved elsewhere. Raw streams require explicit reconnection. Keep your own cursor if you need to resume after an application restart. Input is never replayed; if a write fails, check the process before sending that input again.

Retain the process name with the cursor. A cursor from one process cannot identify output from another. Persist the cursor only after your application has handled the corresponding output.

**TypeScript**



```typescript
const connection = await process.connect({ resumeFrom });
let lastSequence = BigInt(resumeFrom);
try {
  for await (const event of connection) {
    if (event.type === 'chunk') {
      write(
        event.data ?? new Uint8Array(),
        (lastSequence = BigInt(event.streamSequence ?? '0')),
      );
    }
  }
  return lastSequence;
} finally {
  await connection.close();
}
```

<details>
<summary>Complete TypeScript example: shell/resume.ts</summary>

```typescript
import type { Process } from '@docker/sandboxes';

export async function resumeProcessOutput(
  process: Process,
  resumeFrom: bigint,
  write: (bytes: Uint8Array, sequence: bigint) => void,
) {
  const connection = await process.connect({ resumeFrom });
  let lastSequence = BigInt(resumeFrom);
  try {
    for await (const event of connection) {
      if (event.type === 'chunk') {
        write(
          event.data ?? new Uint8Array(),
          (lastSequence = BigInt(event.streamSequence ?? '0')),
        );
      }
    }
    return lastSequence;
  } finally {
    await connection.close();
  }
}
```

</details>



## Send a signal {#4-send-a-signal}

Get the process by name and send the signal your application intends. Use a graceful termination signal when the process should clean up its own files.

Signals operate on the process; they do not delete the sandbox. [Delete the sandbox](/ai/sandboxes-api/cookbook/run-an-interactive-shell-in-a-cloud-sandbox/delete-a-cloud-sandbox/) separately when all work is finished.

**TypeScript**



```typescript
const process = await sandbox.processes.get(name);
await process.signal(signal);
```

<details>
<summary>Complete TypeScript example: shell/signal.ts</summary>

```typescript
import type { Sandbox, Process } from '@docker/sandboxes';

export async function signalProcess(
  sandbox: Sandbox,
  name: string,
  signal: Parameters<Process['signal']>[0],
) {
  const process = await sandbox.processes.get(name);
  await process.signal(signal);
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/run-something-that-produces-real-output/ fetched 2026-10-08 -->

# Run something that produces real output


Choose how your application receives command output. Captured output is convenient for a short command; streaming lets you display progress or process output without waiting for completion.

Start with a running sandbox handle from [your first sandbox](/ai/sandboxes-api/cookbook/run-something-that-produces-real-output/create-your-first-sandbox/). Supply the command as an argument array.

## Collect the result {#1-collect-the-result}

Run the process and wait for its result. Inspect standard output, standard error, and the exit code. Use an application deadline so a command cannot hold your request open indefinitely.

This form accumulates output for you. Prefer streaming when output could be large or your user needs progress updates.

**TypeScript**



```typescript
return sandbox.processes.run({ args }, { timeoutMs: 300_000 });
```

<details>
<summary>Complete TypeScript example: longrun/choose.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function collectOutput(sandbox: Sandbox, args: string[]) {
  return sandbox.processes.run({ args }, { timeoutMs: 300_000 });
}
```

</details>



## Stream output as it arrives {#2-stream-output-as-it-arrives}

Start the process, connect to it, and consume output events. The example forwards each output chunk to a callback and returns the exit code from the exit event.

The callback owns what happens to each chunk: display it, append it to a file, or send it to a client. Do not log sensitive output indiscriminately.

Always close the connection. A stream that ends before an exit event is an incomplete observation, not proof of success. Keep the process name to [reconnect](/ai/sandboxes-api/cookbook/run-something-that-produces-real-output/find-a-process-you-lost-track-of/) rather than immediately starting a duplicate command.

Connections opened through TypeScript process handles reconnect after temporary disconnects while you consume output. They resume after the last delivered chunk and stop if recovery exceeds 30 seconds, without replaying process input. These connections have no default lifetime limit once connected, but a timeout you supply still limits the whole session. Raw streams require explicit reconnection.

**TypeScript**



```typescript
const process = await sandbox.processes.start(
  { args },
  { idempotencyKey: requestId },
);
const connection = await process.connect();
try {
  for await (const event of connection) {
    if (event.type === 'chunk') write(event.data ?? new Uint8Array());
    if (event.type === 'exited') return event.exitCode ?? 0;
  }
  throw new Error(
    `Output of ${process.name} ended before the command exited`,
  );
} finally {
  await connection.close();
}
```

<details>
<summary>Complete TypeScript example: longrun/stream.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function streamOutput(
  sandbox: Sandbox,
  args: string[],
  requestId: string,
  write: (bytes: Uint8Array) => void,
) {
  const process = await sandbox.processes.start(
    { args },
    { idempotencyKey: requestId },
  );
  const connection = await process.connect();
  try {
    for await (const event of connection) {
      if (event.type === 'chunk') write(event.data ?? new Uint8Array());
      if (event.type === 'exited') return event.exitCode ?? 0;
    }
    throw new Error(
      `Output of ${process.name} ended before the command exited`,
    );
  } finally {
    await connection.close();
  }
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/run-work-across-many-sandboxes/ fetched 2026-10-08 -->

# Run work across many sandboxes


Run a command across several existing sandboxes while keeping concurrency bounded. This can collect diagnostics or apply the same task to a group of independent workspaces.

Use an [authenticated client](/ai/sandboxes-api/cookbook/run-work-across-many-sandboxes/connect-to-cloud-with-a-bearer-token/) and an argument array. Only run the command in sandboxes your application owns for this task.

## Select running sandboxes {#1-select-running-sandboxes}

Walk the sandbox collection and retain running handles. The example selects all running sandboxes visible to the client; narrow that selection to your application's jobs before executing a command with side effects.

Listing and execution are separate requests. A sandbox can change state between them, so the execution step still needs to handle failures.

**TypeScript**



```typescript
const running: Sandbox[] = [];
for await (const sandbox of client.all()) {
  if (sandbox.status === 'running') running.push(sandbox);
}
return running;
```

<details>
<summary>Complete TypeScript example: fanout/spread.ts</summary>

```typescript
import type { Sandbox, Sandboxes } from '@docker/sandboxes';

export async function runningSandboxes(client: Sandboxes) {
  const running: Sandbox[] = [];
  for await (const sandbox of client.all()) {
    if (sandbox.status === 'running') running.push(sandbox);
  }
  return running;
}
```

</details>



## Collect individual results {#2-collect-individual-results}

Choose a concurrency bound and run the command on each selected sandbox. The example keeps each result or failure alongside the sandbox name, so one failed request does not discard every other result.

Inspect both request failures and process exit codes. A returned process result can contain a nonzero exit code.

Keep concurrency below your account's limits and your application's memory budget. For large output, stream results instead of collecting them all. The example does not delete the existing sandboxes.

**TypeScript**



```typescript
const outcomes: Outcome[] = [];
const size = Number.isFinite(bound) ? Math.max(1, Math.trunc(bound)) : 1;
for (let start = 0; start < sandboxes.length; start += size) {
  const group = sandboxes.slice(start, start + size);
  const settled = await Promise.allSettled(
    group.map((sandbox) =>
      sandbox.processes.run({ args }, { timeoutMs: 300_000 }),
    ),
  );
  settled.forEach((result, index) => {
    outcomes.push(
      result.status === 'fulfilled'
        ? { sandboxName: group[index].name, response: result.value }
        : { sandboxName: group[index].name, failure: result.reason },
    );
  });
}
return outcomes;
```

<details>
<summary>Complete TypeScript example: fanout/gather.ts</summary>

```typescript
import type { RunResult, Sandbox } from '@docker/sandboxes';

export type Outcome = {
  sandboxName: string;
  response?: RunResult;
  failure?: unknown;
};

export async function runOnEach(
  sandboxes: Sandbox[],
  args: string[],
  bound: number,
) {
  const outcomes: Outcome[] = [];
  const size = Number.isFinite(bound) ? Math.max(1, Math.trunc(bound)) : 1;
  for (let start = 0; start < sandboxes.length; start += size) {
    const group = sandboxes.slice(start, start + size);
    const settled = await Promise.allSettled(
      group.map((sandbox) =>
        sandbox.processes.run({ args }, { timeoutMs: 300_000 }),
      ),
    );
    settled.forEach((result, index) => {
      outcomes.push(
        result.status === 'fulfilled'
          ? { sandboxName: group[index].name, response: result.value }
          : { sandboxName: group[index].name, failure: result.reason },
      );
    });
  }
  return outcomes;
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/run-your-first-command/ fetched 2026-10-08 -->

# Run your first command


Run a command in an existing sandbox and collect its output. Start with an [authenticated client](/ai/sandboxes-api/cookbook/run-your-first-command/connect-to-cloud-with-a-bearer-token/) and the sandbox name returned by [your first launch](/ai/sandboxes-api/cookbook/run-your-first-command/create-your-first-sandbox/).

For most commands, use the process collection's run helper. It starts the process and waits for its result.

## Open the sandbox {#1-open-the-sandbox}

Get the sandbox by its resource name. The returned handle exposes processes and files and manages their authenticated connections. You do not need to copy the sandbox address or Docker token into a second client.

**TypeScript**



```typescript
return client.get(name);
```

<details>
<summary>Complete TypeScript example: exec/endpoint.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function processesAt(client: Sandboxes, name: string) {
  return client.get(name);
}
```

</details>



## Use the process run helper {#2-use-the-process-run-helper}

Pass an argument array: the program followed by its arguments, such as `['echo', 'Hello from Docker Sandboxes']`. Arguments are not shell syntax. For pipes, redirection, or variable expansion, run `sh -c` with your script as the next argument.

The run helper returns the process result after collecting output. A successful SDK call does not mean the command succeeded: inspect its exit code. Standard error is diagnostic output and can be nonempty even when the exit code is zero.

An SDK error means the request, wait, or connection failed. Keep the process handle carried by an error when available so you can inspect it instead of starting duplicate work. [Error handling](/ai/sandboxes-api/cookbook/run-your-first-command/handle-errors-and-degradation/) explains the distinction.

**TypeScript**



```typescript
return sandbox.processes.run({ args }, { timeoutMs: 300_000 });
```

<details>
<summary>Complete TypeScript example: exec/outcome.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function classifyOutcome(sandbox: Sandbox, args: string[]) {
  return sandbox.processes.run({ args }, { timeoutMs: 300_000 });
}
```

</details>



## Optional: execute a command directly {#3-optional-execute-a-command-directly}

For a short command whose output you only need after it exits, direct execution is simpler: one request waits for the command and returns its captured output and exit code, without a separate process-creation and output-reading sequence.

Check the incomplete flag before treating captured output as complete. Choose [streaming output](/ai/sandboxes-api/cookbook/run-your-first-command/run-something-that-produces-real-output/) when you need output while the command runs.

**TypeScript**



```typescript
const result = await endpoint.api.exec({ body: { cmd: args } });
```

<details>
<summary>Complete TypeScript example: exec/exec.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function runCommand(sandbox: Sandbox, args: string[]) {
  const endpoint = await sandbox.endpointClient(['sandboxesExec'], 'exec');
  try {
    const result = await endpoint.api.exec({ body: { cmd: args } });
    return {
      exitCode: result.exitCode ?? 0,
      stdout: new TextDecoder().decode(result.stdout),
      stderr: new TextDecoder().decode(result.stderr),
      incomplete: result.incomplete ?? false,
    };
  } finally {
    await endpoint.close();
  }
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/run-your-own-container-image/ fetched 2026-10-08 -->

# Run your own container image


Run your own tools from a container image when a [bundled kit](/ai/sandboxes-api/cookbook/run-your-own-container-image/add-tools-with-kits/) does not fit the task. You supply the image reference and machine size; the SDK creates an isolated sandbox around it.

You need an [authenticated client](/ai/sandboxes-api/cookbook/run-your-own-container-image/connect-to-cloud-with-a-bearer-token/) and an OCI image the service can pull. Use a versioned reference or digest when repeatability matters. The image must include `/bin/sh`.

## Create from a registry image {#1-create-from-a-registry-image}

Pass the image reference, CPU count, memory size, display name, and idempotency key. The SDK's image-reference option avoids assembling nested request fields. Do not also supply a managed image or named agent.

The example waits for the sandbox to run. A wait timeout stops your wait; it does not delete a sandbox that was already accepted. Save any sandbox handle retained by the error so you can inspect or clean it up.

The image's startup command runs inside the sandbox. Read `WORKSPACE_DIR` to find the workspace rather than assuming a path.

Next, [run a command](/ai/sandboxes-api/cookbook/run-your-own-container-image/run-your-first-command/) or [copy in your project files](/ai/sandboxes-api/cookbook/run-your-own-container-image/copy-a-file-into-a-cloud-sandbox/). [Delete the sandbox](/ai/sandboxes-api/cookbook/run-your-own-container-image/delete-a-cloud-sandbox/) when the work is complete.

**TypeScript**



```typescript
const sandbox = await client.create(
  { displayName: name, imageRef, resources },
  { timeoutMs: 300_000, idempotencyKey: requestId },
);
return sandbox.waitUntilRunning();
```

<details>
<summary>Complete TypeScript example: rawimage/create.ts</summary>

```typescript
import type { ClientCreateOptions, Sandboxes } from '@docker/sandboxes';

export async function createFromImageRef(
  client: Sandboxes,
  name: string,
  imageRef: string,
  resources: ClientCreateOptions['resources'],
  requestId: string,
) {
  const sandbox = await client.create(
    { displayName: name, imageRef, resources },
    { timeoutMs: 300_000, idempotencyKey: requestId },
  );
  return sandbox.waitUntilRunning();
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/send-values-the-api-accepts/ fetched 2026-10-08 -->

# Send values the API accepts


Build SDK options without confusing an omitted value with an explicit false or zero. This matters for settings whose default is chosen by the service.

Start with an [authenticated client](/ai/sandboxes-api/cookbook/send-values-the-api-accepts/connect-to-cloud-with-a-bearer-token/). Use the option types exported by your SDK so your editor can show the supported inputs.

## Construct creation options {#1-construct-creation-options}

Supply the image source and lifecycle settings, using the duration units required by your SDK. The example accepts seconds and converts them at the boundary.

This example uses a managed image, which supplies its resource defaults. For a registry image instead, use the image-reference option and provide a supported CPU and memory pair.

Preserve absence for an optional boolean when you want the service default. Explicit false is a choice, not a missing value. Validate user-supplied values before building the request.

**TypeScript**



```typescript
return {
  displayName: name,
  image,
  platform,
  lifecycle: { timeoutMs: lifeSeconds * 1_000, autoResume },
};
```

<details>
<summary>Complete TypeScript example: values/build.ts</summary>

```typescript
import type { ClientCreateOptions, Sandboxes } from '@docker/sandboxes';

export function createRequest(
  name: string,
  image: string,
  lifeSeconds: number,
  platform: ClientCreateOptions['platform'],
  autoResume: boolean | undefined,
): ClientCreateOptions {
  return {
    displayName: name,
    image,
    platform,
    lifecycle: { timeoutMs: lifeSeconds * 1_000, autoResume },
  };
}

export async function sendCreate(
  client: Sandboxes,
  request: ClientCreateOptions,
) {
  const sandbox = await client.create(request, { timeoutMs: 300_000 });
  return sandbox.waitUntilRunning();
}
```

</details>



## Read the effective values {#2-read-the-effective-values}

Get the sandbox and inspect the reported platform, resources, and expiration. These describe what the service recorded, which can differ from omitted or defaulted input values.

Keep the language's native numeric and duration representations. Avoid converting large integers through a floating-point type merely to display or serialize them.

**TypeScript**



```typescript
return {
  expiresAt: sandbox.effectiveFeatures?.timeouts?.expiresAt,
  platform: sandbox.core.platform,
  cpus: sandbox.core.resources?.cpus ?? undefined,
};
```

<details>
<summary>Complete TypeScript example: values/read.ts</summary>

```typescript
import type { Sandbox, Sandboxes } from '@docker/sandboxes';

export function reportedValues(sandbox: Sandbox) {
  return {
    expiresAt: sandbox.effectiveFeatures?.timeouts?.expiresAt,
    platform: sandbox.core.platform,
    cpus: sandbox.core.resources?.cpus ?? undefined,
  };
}

export async function readSandbox(client: Sandboxes, name: string) {
  return reportedValues(await client.get(name));
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/snapshot-and-fork-a-sandbox/ fetched 2026-10-08 -->

# Snapshot and fork a sandbox


Save a sandbox's state so you can start another sandbox from the same point later. A snapshot is separate from its source sandbox; restoring it creates a new sandbox with its own identity.

Use an [authenticated client](/ai/sandboxes-api/cookbook/snapshot-and-fork-a-sandbox/connect-to-cloud-with-a-bearer-token/) and the resource name of a running sandbox.

## Capture a snapshot {#1-capture-a-snapshot}

Choose a display name, capture mode, and idempotency key. Use disk-only capture when you need the filesystem. Request memory only when your environment supports it and you need the running state.

The example waits until capture finishes and returns a snapshot handle. Keep the returned name for restoration.

A failed capture carries failure details; a timed-out wait does not prove the capture was cancelled.

Snapshots can contain credentials and private project data. Restrict access to them, especially when capturing memory.

**TypeScript**



```typescript
const snapshot = await sandbox.snapshot(
  {
    displayName: snapshotName,
    captureMode: withMemory ? 'all' : 'disk',
  },
  { idempotencyKey: requestId },
);
return snapshot.waitUntilReady();
```

<details>
<summary>Complete TypeScript example: snapshots/create.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function createSnapshot(
  client: Sandboxes,
  sandboxName: string,
  snapshotName: string,
  withMemory: boolean,
  requestId: string,
) {
  const sandbox = await client.get(sandboxName);
  const snapshot = await sandbox.snapshot(
    {
      displayName: snapshotName,
      captureMode: withMemory ? 'all' : 'disk',
    },
    { idempotencyKey: requestId },
  );
  return snapshot.waitUntilReady();
}
```

</details>



## Restore into another sandbox {#2-restore-into-another-sandbox}

Use a ready snapshot's name and a display name for the new sandbox. The example waits for the restored sandbox to run.

The call returns a sandbox handle, ready for running commands or transferring files.

The source sandbox does not need to remain running. Restoration does not replace it. Save the new sandbox's name and delete it separately when you finish.

**TypeScript**



```typescript
const sandbox = await snapshot.restore(
  { displayName: newSandboxName },
  { timeoutMs: 300_000, idempotencyKey: requestId },
);
return sandbox.waitUntilRunning();
```

<details>
<summary>Complete TypeScript example: snapshots/restore.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function restoreSnapshot(
  client: Sandboxes,
  snapshotName: string,
  newSandboxName: string,
  requestId: string,
) {
  const snapshot = await client.snapshots.get(snapshotName);
  const sandbox = await snapshot.restore(
    { displayName: newSandboxName },
    { timeoutMs: 300_000, idempotencyKey: requestId },
  );
  return sandbox.waitUntilRunning();
}
```

</details>



## Find saved snapshots {#3-find-saved-snapshots}

List snapshots for the source sandbox. The example follows all pages and returns summaries. Read a selected snapshot before restoring it if you need its current status or complete metadata.

**TypeScript**



```typescript
return client.snapshots.all({ sandbox: sandboxName }).collect();
```

<details>
<summary>Complete TypeScript example: snapshots/list.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function listSnapshots(
  client: Sandboxes,
  sandboxName: string,
) {
  return client.snapshots.all({ sandbox: sandboxName }).collect();
}
```

</details>



## Delete a snapshot {#4-delete-a-snapshot}

Delete through a handle when you no longer need that restore point. Deletion removes the snapshot, not sandboxes that have already been restored from it. Snapshot deletion is refused while a sandbox restored from it is still running.

Deleting the source sandbox and deleting its snapshots are separate cleanup steps.

**TypeScript**



```typescript
await snapshot.delete();
```

<details>
<summary>Complete TypeScript example: snapshots/delete.ts</summary>

```typescript
import type { Snapshot } from '@docker/sandboxes';

export async function deleteSnapshot(snapshot: Snapshot) {
  await snapshot.delete();
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/stop-and-restart-a-sandbox/ fetched 2026-10-08 -->

# Stop and restart a sandbox


Stop a sandbox when you want to keep its disk but pause its execution. Start the same sandbox later to continue working with those files.

Use a sandbox handle obtained by creation or by reading its resource name. Stopping is different from [deleting](/ai/sandboxes-api/cookbook/stop-and-restart-a-sandbox/delete-a-cloud-sandbox/), which removes the sandbox.

## Stop the sandbox {#1-stop-the-sandbox}

Call stop and wait for the stopped state. The example returns a handle with the updated resource version.

Wait completion confirms the state change. A timeout means your client stopped waiting; read the sandbox to learn whether the operation completed.

**TypeScript**



```typescript
const changed = await sandbox.stop({ idempotencyKey: requestId });
return changed.waitUntilStopped();
```

<details>
<summary>Complete TypeScript example: lifecycle/stop.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function stopSandbox(sandbox: Sandbox, requestId: string) {
  const changed = await sandbox.stop({ idempotencyKey: requestId });
  return changed.waitUntilStopped();
}
```

</details>



## Start it again {#2-start-it-again}

Do not reuse a handle whose version predates the stop.

Start the stopped sandbox and wait for it to run. As with stopping, the call returns a handle.

Do not assume that a process connection from before the stop remains usable. [Find an existing process](/ai/sandboxes-api/cookbook/stop-and-restart-a-sandbox/find-a-process-you-lost-track-of/) or start the work again as appropriate for the application.

A stopped sandbox still exists. Delete it when you no longer need its disk, and clean up separate snapshots or volumes only when their data is no longer needed.

**TypeScript**



```typescript
const changed = await sandbox.start({ idempotencyKey: requestId });
return changed.waitUntilRunning();
```

<details>
<summary>Complete TypeScript example: lifecycle/start.ts</summary>

```typescript
import type { Sandbox } from '@docker/sandboxes';

export async function startSandbox(sandbox: Sandbox, requestId: string) {
  const changed = await sandbox.start({ idempotencyKey: requestId });
  return changed.waitUntilRunning();
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/what-your-workload-starts-with/ fetched 2026-10-08 -->

# What your workload starts with


Inspect the environment a process receives and override a value for one command. This helps diagnose a missing workspace path or configuration setting.

Use a running sandbox handle. The environment can contain credentials, so do not dump the full result into logs or send it to an untrusted client.

## Read the process environment {#1-read-the-process-environment}

Run `env` and parse its output. Read `WORKSPACE_DIR` to locate the workspace rather than assuming a fixed path.

This reports the environment seen by that process. It is a diagnostic example, not a way to retrieve stored secret values.

**TypeScript**



```typescript
export async function readFloor(sandbox: Sandbox) {
  const result = requireSuccess(
    await sandbox.processes.run({ args: ['env'] }, { timeoutMs: 300_000 }),
  );
  return Object.fromEntries(
    result.stdout
      .split('\n')
      .filter((line) => line.includes('='))
      .map((line) => {
        const delimiter = line.indexOf('=');
        return [line.slice(0, delimiter), line.slice(delimiter + 1)];
      }),
  );
}
```

<details>
<summary>Complete TypeScript example: runtime/read.ts</summary>

```typescript
import { requireSuccess, type Sandbox } from '@docker/sandboxes';

export async function readFloor(sandbox: Sandbox) {
  const result = requireSuccess(
    await sandbox.processes.run({ args: ['env'] }, { timeoutMs: 300_000 }),
  );
  return Object.fromEntries(
    result.stdout
      .split('\n')
      .filter((line) => line.includes('='))
      .map((line) => {
        const delimiter = line.indexOf('=');
        return [line.slice(0, delimiter), line.slice(delimiter + 1)];
      }),
  );
}
```

</details>



## Override a variable for one command {#2-override-a-variable-for-one-command}

Supply a value in the process request's environment map. The first command reads that override. A second command without the override reads the sandbox's original value.

The override belongs to the process request and does not change the sandbox's environment for later commands. Use it for task-specific configuration. For provider credentials, prefer [stored secrets](/ai/sandboxes-api/cookbook/what-your-workload-starts-with/get-a-stored-secret-into-a-sandbox/).

**TypeScript**



```typescript
const fromRequest = requireSuccess(
  await sandbox.processes.run(
    {
      args: ['printenv', name],
      env: { [name]: value },
    },
    { timeoutMs: 300_000 },
  ),
);
const fromSandbox = await sandbox.processes.run(
  {
    args: ['printenv', name],
  },
  { timeoutMs: 300_000 },
);
return {
  fromRequest: fromRequest.stdout.trimEnd(),
  fromSandbox: fromSandbox.stdout.trimEnd(),
};
```

<details>
<summary>Complete TypeScript example: runtime/precedence.ts</summary>

```typescript
import { requireSuccess, type Sandbox } from '@docker/sandboxes';

export async function overrideVariable(
  sandbox: Sandbox,
  name: string,
  value: string,
) {
  const fromRequest = requireSuccess(
    await sandbox.processes.run(
      {
        args: ['printenv', name],
        env: { [name]: value },
      },
      { timeoutMs: 300_000 },
    ),
  );
  const fromSandbox = await sandbox.processes.run(
    {
      args: ['printenv', name],
    },
    { timeoutMs: 300_000 },
  );
  return {
    fromRequest: fromRequest.stdout.trimEnd(),
    fromSandbox: fromSandbox.stdout.trimEnd(),
  };
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/cookbook/work-within-the-limits/ fetched 2026-10-08 -->

# Work within the limits


Bound work so account limits and temporary capacity refusals do not turn into unbounded retries.

Use an [authenticated client](/ai/sandboxes-api/cookbook/work-within-the-limits/connect-to-cloud-with-a-bearer-token/). Account limits are separate from SDK configuration; changing the client does not grant additional capacity.

### Choose a compute size

Cloud Sandboxes uses fixed CPU and memory pairs as billing shapes:

| Size   | vCPUs | Memory | SDK memory value (MiB) |
| ------ | ----: | -----: | ---------------------: |
| Micro  |     1 |  2 GiB |                   2048 |
| Small  |     2 |  4 GiB |                   4096 |
| Medium |     4 |  8 GiB |                   8192 |
| Large  |     8 | 16 GiB |                  16384 |
| XL     |    16 | 32 GiB |                  32768 |

Choose a size by name, for example, `resources: 'small'`. The supported names are `micro`, `small`, `medium`, `large`, and `xl`. Kit launches default to Small when you omit resources. Explicit settings take precedence.

You can still supply both CPU and memory directly. Use a supported pair; 1 CPU with 1024 MiB is not supported in Cloud Sandboxes. A saved image supplies its own resources, so do not override them when creating from that image. Your account and available capacity determine whether a request can be accepted. Check your Docker billing terms for prices.

### Understand account quotas

The default limits are 10 concurrent sandboxes, 50 stored sandboxes, 100 volumes, 100 secrets, and 3 images being prepared at once. These are account-wide defaults, not a separate allowance per user. Your account can have different limits; confirm them with Docker before sizing a large workload.

Stopping an ordinary sandbox frees its concurrency slot but leaves it in stored usage. Starting or resuming it needs a slot again. An always-on sandbox, configured to restart automatically on timeout, retains its concurrency reservation even while stopped. Delete sandboxes you no longer need to release stored usage.

## Count existing sandboxes {#1-count-existing-sandboxes}

Walk all sandbox pages and count resources visible to you. This gives your application a usage observation, not a reservation or authoritative quota balance. Other users can hold resources in the same account that your list does not show.

Another caller can create a sandbox immediately afterward. Treat the create response as the final decision, even when your count appears below a planned limit.

**TypeScript**



```typescript
let count = 0;
for await (const sandbox of client.all({ pageSize })) {
  if (sandbox.name) count++;
}
return count;
```

<details>
<summary>Complete TypeScript example: limits/budget.ts</summary>

```typescript
import type { Sandboxes } from '@docker/sandboxes';

export async function countSandboxes(client: Sandboxes, pageSize: number) {
  let count = 0;
  for await (const sandbox of client.all({ pageSize })) {
    if (sandbox.name) count++;
  }
  return count;
}
```

</details>



## Back off after a refusal {#2-back-off-after-a-refusal}

Use the server's retry delay when supplied and keep the same idempotency key for the same create request. Bound the number of attempts and give the overall operation a deadline.

The example owns the retry loop, disables automatic SDK retries, and sets an overall timeout. Do not layer two retry policies without accounting for their combined attempts and deadlines.

A quota refusal may need cleanup or an account change rather than another immediate request. Stop after the bound, report the failure, and keep any accepted sandbox identity available for inspection.

**TypeScript**



```typescript
for (let attempt = 0; attempt < attempts; attempt++) {
  try {
    return await client.kits.launch(
      'shell',
      { displayName, resources: { cpus: 2, memoryMib: 4096 } },
      {
        idempotencyKey: requestId,
        timeoutMs: 300_000,
        signal,
        maxRetries: 0,
      },
    );
  } catch (error) {
    if (
      !(error instanceof RequestError) ||
      error.raw.code !== 'resourceExhausted' ||
      attempt + 1 === attempts
    )
      throw error;
    await pause(retryAfter(error, fallbackMs), undefined, { signal });
  }
}
throw new Error('attempt count was validated');
```

<details>
<summary>Complete TypeScript example: limits/backoff.ts</summary>

```typescript
import { setTimeout as pause } from 'node:timers/promises';
import {
  RequestError,
  type Sandbox,
  type Sandboxes,
} from '@docker/sandboxes';

export async function createWithBackoff(
  client: Sandboxes,
  displayName: string,
  attempts: number,
  fallbackMs: number,
  requestId: string,
): Promise<Sandbox> {
  if (!Number.isInteger(attempts) || attempts < 1)
    throw new Error(`attempts must be at least 1, got ${attempts}`);
  const signal = AbortSignal.timeout(300000);
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await client.kits.launch(
        'shell',
        { displayName, resources: { cpus: 2, memoryMib: 4096 } },
        {
          idempotencyKey: requestId,
          timeoutMs: 300_000,
          signal,
          maxRetries: 0,
        },
      );
    } catch (error) {
      if (
        !(error instanceof RequestError) ||
        error.raw.code !== 'resourceExhausted' ||
        attempt + 1 === attempts
      )
        throw error;
      await pause(retryAfter(error, fallbackMs), undefined, { signal });
    }
  }
  throw new Error('attempt count was validated');
}

export function retryAfter(
  error: RequestError,
  fallbackMs: number,
): number {
  const header = error.retryAfter?.trim();
  if (header) {
    const delay = /^\d+(?:\.\d+)?$/.test(header)
      ? Number(header) * 1000
      : /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s/.test(header)
        ? Math.max(0, Date.parse(header) - Date.now())
        : NaN;
    if (Number.isFinite(delay) && delay >= 0) return delay;
  }
  return error.decoded.retryDelayMs ?? fallbackMs;
}
```

</details>

<!-- page: https://docs.docker.com/ai/sandboxes-api/errors/ fetched 2026-10-08 -->

# Errors and retries


> [!NOTE]
> The Docker Sandboxes API and SDK are experimental. Features, interfaces,
> and behavior may change.

Before retrying a failed request, check whether the service already started
the work. For example, a create request can succeed even if your application
loses the response. Retrying without checking can create a second sandbox.

## Read an error response

API errors contain a `code`, a `message`, and optional typed `details`. Use the
code to decide how to respond. Several codes share an HTTP status, so the
status alone might not explain the failure.

| Code | What to do |
| --- | --- |
| `invalidArgument` | Correct the malformed request or unsupported value before retrying. |
| `unauthenticated` | Obtain a valid credential to replace the missing, invalid, or expired one. |
| `permissionDenied` | Check that your credentials have permission for the action. |
| `notFound` | Check the resource name and request URL. Cloud also returns this code for routes it doesn't serve. |
| `failedPrecondition` | Check the resource state, required features, and any `If-Match` header. |
| `resourceExhausted` | Check the error details for a quota, rate limit, or request-size limit. |
| `unimplemented` | Check whether the backend supports the requested feature. |
| `unavailable` | Retry after a delay, once you know the retry won't duplicate work. |

For more detail, inspect `google.rpc.ErrorInfo` in the error's `details`, if
present. Use its `reason` and `domain` fields together with the error code to
handle specific causes. Avoid matching the free-form message text, and
handle responses even when they include detail types you don't recognize.

## Recover from a failed wait

If the API returns HTTP 202, the work is still in progress. Keep reading the
resource until it reaches the state you need or fails. The resource's `failure`
field describes a failure that occurs after the initial request succeeds.

If a wait times out or is canceled, the action can still finish. Inspect the
resource before trying again or deleting it. SDK wait helpers report
`WaitError`, which includes the last resource the client received and any
failure details.

If the client never received a resource, retry the original request with its
idempotency key to recover the response. See
[Retry without duplicating work](#retry-without-duplicating-work).

## Retry without duplicating work

An idempotency key identifies one request, so the service can return its
original response if you send it again. For example, repeating a sandbox
creation request with the same key returns the first sandbox instead of
creating another one.

The SDK generates a key for each supported mutation unless you supply one.
For direct API calls, include an `Idempotency-Key` header in the original
request. Keep the key and the exact request, including any `If-Match` value,
for retries.

The service keeps accepted results for at least 24 hours. A replay returns
the original response, so read the resource afterward to check its latest
state.

Use the same key only when repeating the same request. Changing the request
under that key causes an error, and using a different key submits another
action. Send the header only for operations that support it:

| Operations | `Idempotency-Key` |
| --- | --- |
| Create a sandbox, image, process, port, snapshot, secret, or volume | Optional |
| Restore a snapshot | Optional |
| Start, stop, or delete a sandbox | Optional |
| Update a secret | Optional |
| Update a sandbox | Required |

Other operations don't accept an idempotency key.

Once you know a create request succeeded, poll the returned resource to wait
for completion. Retry only when you need to recover from a failure or a lost
response. For temporary failures, wait between retries and limit the number
of attempts.

Process creation also supports an idempotency key. Recover the creation
response with the same key before starting another process. Process input,
signals, and file writes aren't covered by that key. Check the outcome
before repeating those actions.

## Account for SDK retries

The SDK makes up to two additional attempts for eligible transient failures.
If your application manages its own retry loop, set `maxRetries: 0` for the
call to disable automatic retries. Combining both policies can produce more
attempts than you intended.

Automatic retries within a call reuse its idempotency key. When retrying from
your application, pass the original key in the call options as
`idempotencyKey`. Otherwise, a separate create call can generate a different
key and create another sandbox.

Limit both retry attempts and elapsed time, and honor server retry delays.
See [Request rate limits](/ai/sandboxes-api/errors/limits/#request-rate-limits) for how rate limits
differ from resource quotas.

## Handle concurrent changes

To avoid changing a resource that someone else has modified, send its `etag`
in the `If-Match` header. An etag identifies the version of the resource you
read. Operations such as sandbox updates and deletion require this header.
The SDK sends the etag stored in the resource object you're using.

For direct API requests, pass the etag exactly as returned, including its
quotes. A missing required header returns HTTP 428, and a stale etag returns
HTTP 412.

If the etag is stale, read the resource again and decide whether your change
is still appropriate. In the SDK, use the object returned by `refresh()` for
the next operation. The original object still has the old etag. Use a
different idempotency key for a request with an updated etag.

## Check command results

An API request can succeed even when the command it runs fails. Check the
command result's exit code and output separately from request and wait errors.
A nonzero exit code reports a command failure.

## Set a timeout for commands

To limit how long `processes.run()` waits for a command, pass `timeoutMs` in
the second argument. For example,
`sandbox.processes.run(input, { timeoutMs: 300_000 })` waits up to five minutes.
Timing out or canceling the call stops local waiting. It doesn't kill the
process in the sandbox.

Without `timeoutMs`, the overall run has no timeout. Individual requests to
create the process and read its output have a 30-second timeout.

<!-- page: https://docs.docker.com/ai/sandboxes-api/get-started/ fetched 2026-10-08 -->

# Run your first cloud sandbox


> [!NOTE]
> The Docker Sandboxes API and SDK are experimental. Features, interfaces,
> and behavior may change.

Create a cloud sandbox, run a command inside it, and delete it using the Docker
Sandboxes TypeScript SDK. This tutorial uses the bundled `shell` kit to print
`Hello from Docker Sandboxes`. You don't need an AI agent or a model provider
API key to run it.

## Prerequisites

To follow this tutorial, you need:

- A Docker account with an active
  [Docker Agentic Platform subscription](/agentic-platform/signup/#activate-cloud-access)
- Node.js 20 or later and npm

## Create a project

Create a directory and initialize a Node.js project:

```console
$ mkdir sandboxes-api-tutorial
$ cd sandboxes-api-tutorial
$ npm init --yes
$ npm pkg set type=module
```

Install the SDK and TypeScript tooling:

```console
$ npm install @docker/sandboxes
$ npm install --save-dev tsx typescript @types/node
```

## Create and use a sandbox

A kit supplies the sandbox's image and configuration for an agent or tool.
The `shell` kit provides the environment for this example.

The SDK launches it with the default `small` compute size: two CPUs and
4 GiB of memory. Cloud compute is billed to your subscription. See
[Compute sizes and limits](/ai/sandboxes-api/get-started/limits/) for other sizes.

Create a file named `index.ts` with the following code. The program prompts
you to sign in, creates a sandbox, runs a command, and deletes the sandbox.

```typescript
import { oauth, Sandboxes } from '@docker/sandboxes';

const client = new Sandboxes({
  auth: oauth({
    onVerification({ verificationUriComplete, verificationUri, userCode }) {
      console.log(`Open ${verificationUriComplete ?? verificationUri}`);
      console.log(`Verification code: ${userCode}`);
    },
  }),
});

try {
  const sandbox = await client.kits.launchAndWait('shell');
  console.log('Sandbox:', sandbox.name);

  const result = await sandbox.processes.run(
    { args: ['echo', 'Hello from Docker Sandboxes'] },
    { timeoutMs: 300_000 },
  );
  console.log(result.stdout.trim());

  const latest = await sandbox.refresh();
  const deleting = await latest.delete({ force: true });
  await deleting?.waitUntilDeleted();
  console.log('Deleted', sandbox.name);
} finally {
  await client.close();
}
```

`kits.launchAndWait` creates the sandbox and waits until it's running.
`processes.run` runs the command and collects its output.
The program then reads the sandbox's latest state, deletes it, and waits for
deletion to finish. The `force` option permits deletion while the sandbox is
running.

The SDK handles sign-in, access tokens, and the connection to the sandbox.
Closing the client releases its local resources.

## Run the program

Run the program with `tsx`:

```console
$ npx tsx index.ts
```

Open the printed verification URL and sign in with the Docker account that
has your cloud subscription. The program continues after sign-in. On success,
it prints `Hello from Docker Sandboxes`, then confirms sandbox deletion.

For CI jobs and other unattended applications, use
[PAT authentication](/ai/sandboxes-api/get-started/authentication/#authenticate-automation-with-a-pat).

If the program stops after printing the sandbox name, retrieve the sandbox
with `client.get(name)` and delete it when you're finished. Closing the client
doesn't delete the sandbox.

## Next steps

- Explore the [SDK cookbook](/ai/sandboxes-api/get-started/cookbook/) for examples you can use in
  your application.
- If you use a kit that clones a repository or installs tools,
  [wait for kit setup](/ai/sandboxes-api/get-started/concepts/#wait-for-kit-setup) before using its results.
- Read [API concepts](/ai/sandboxes-api/get-started/concepts/) to learn about resource names, lifecycle
  states, and supported Cloud options.
- Review [Errors and retries](/ai/sandboxes-api/get-started/errors/) before adding recovery logic.

<!-- page: https://docs.docker.com/ai/sandboxes-api/install/ fetched 2026-10-08 -->

# Install the Docker Sandboxes SDK


> [!NOTE]
> The Docker Sandboxes API and SDK are experimental. Features, interfaces,
> and behavior may change.

Use the Docker Sandboxes SDK to create and manage cloud sandboxes from
JavaScript or TypeScript. The SDK includes methods for running commands,
transferring files, and waiting for a sandbox to start or stop.

You don't need the Docker CLI to use the SDK.

## Install the SDK

With Node.js 20 or later, install the SDK in your project:

```console
$ npm install @docker/sandboxes
```

Import `Sandboxes` from `@docker/sandboxes`.

## Connect to Cloud Sandboxes

Before connecting, [activate a Docker Agentic Platform subscription](/agentic-platform/signup/#activate-cloud-access)
for your Docker account.

Configure your client with browser sign-in for interactive use or a personal
access token for automation. The SDK supplies the service URL and manages
access tokens. See [Authentication and authorization](/ai/sandboxes-api/install/authentication/) for
setup instructions.

Follow [Run your first cloud sandbox](/ai/sandboxes-api/install/get-started/) for a complete TypeScript
example that creates a sandbox, runs a command, and deletes it.

<!-- page: https://docs.docker.com/ai/sandboxes-api/limits/ fetched 2026-10-08 -->

# Compute sizes and limits


> [!NOTE]
> The Docker Sandboxes API and SDK are experimental. Features, interfaces,
> and behavior may change.

Choose a compute size for each sandbox and keep your application's resource
usage within your account's quotas. Request rate limits also constrain how
quickly your application can send API requests.

## Compute sizes

Cloud Sandboxes supports these CPU and memory pairs:

| SDK size name | CPUs | Memory | Memory in MiB |
| --- | ---: | ---: | ---: |
| `micro` | 1 | 2 GiB | 2048 |
| `small` | 2 | 4 GiB | 4096 |
| `medium` | 4 | 8 GiB | 8192 |
| `large` | 8 | 16 GiB | 16384 |
| `xl` | 16 | 32 GiB | 32768 |

The kit launch helpers default to `small` when you omit `resources`. To select
another size, pass its name:

```typescript
const sandbox = await client.kits.launchAndWait('shell', {
  resources: 'medium',
});
```

For a registry image, specify a size in `client.create()`, such as
`resources: 'small'`. You can also pass an explicit CPU and memory pair:
`resources: { cpus: 2, memoryMib: 4096 }`.

Named sizes are an SDK convenience. In direct REST requests, supply both
`resources.cpus` and `resources.memoryMib`. CPU and memory aren't independent
settings: for example, 1 CPU with 1024 MiB is not a supported pair.

When creating from an existing image resource with `image`, omit resource
settings because the image supplies them.

Your account access and available capacity determine whether a request can
be accepted. See [Billing](/agentic-platform/signup/#billing) for
pricing and usage information.

## Account quotas

The default quotas apply across an account:

| Resource | Default limit |
| --- | ---: |
| Concurrent sandboxes | 10 |
| Stored sandboxes | 50 |
| Volumes | 100 |
| Secrets | 100 |
| Images being prepared at the same time | 3 |

Your account can have different quotas. Confirm your account's limits with
Docker before planning a workload that depends on a particular allowance.

Stopping a sandbox releases its concurrency slot unless the sandbox is
configured as always-on. Restarting a stopped sandbox requires a concurrency
slot. A stopped sandbox still counts toward the stored sandbox quota.
Delete sandboxes you no longer need to reduce stored usage.

Handle quota errors even if you checked usage before creating a resource.
Other applications can consume the remaining allowance between requests.
Reduce concurrency or remove unused resources before retrying.

## Request rate limits

Rate limits control how quickly you can send requests and can vary by
operation. When a request reaches a rate limit, wait before retrying and
honor any delay specified by the server. Limit concurrent requests and set
bounds on retry attempts and elapsed time.

Check the error details to distinguish a rate limit from a resource quota.
Waiting can resolve a rate limit, but exceeding a quota requires reducing
resource usage. See [Errors and retries](/ai/sandboxes-api/limits/errors/) for how to retry without
duplicating work.

