<!-- vendored source: MCP Catalog and Toolkit docs; origin https://docs.docker.com/ai/mcp-catalog-and-toolkit/; fetched 2026-10-08; each page is the raw markdown served at the page URL with .md appended; page text is verbatim, only the page marker lines are added -->

<!-- page: https://docs.docker.com/ai/mcp-catalog-and-toolkit/ fetched 2026-10-08 -->

# Docker MCP Catalog and Toolkit




[Model Context Protocol](https://modelcontextprotocol.io/introduction) (MCP) is
an open protocol that standardizes how AI applications access external tools
and data sources. By connecting LLMs to local development tools, databases,
APIs, and other resources, MCP extends their capabilities beyond their base
training.

The challenge is that running MCP servers locally creates operational friction.
Each server requires separate installation and configuration for every
application you use. You run untrusted code directly on your machine, manage
updates manually, and troubleshoot dependency conflicts yourself. Configure a
GitHub server for Claude, then configure it again for Cursor, and so on. Each
time you manage credentials, permissions, and environment setup.

## Docker MCP features

The [MCP Toolkit](/ai/mcp-catalog-and-toolkit/toolkit/) and [MCP
Gateway](/ai/mcp-catalog-and-toolkit/mcp-gateway/) solve these challenges
through centralized management. Instead of configuring each server for every AI
application separately, you set things up once and connect all your clients to
it. The workflow centers on three concepts: catalogs, profiles, and clients.

![MCP overview](/ai/mcp-catalog-and-toolkit/images/mcp_toolkit.avif)

[Catalogs](/ai/mcp-catalog-and-toolkit/catalog/) are curated collections of
MCP servers. The Docker MCP Catalog provides 300+ verified servers packaged as
container images with versioning, provenance, and security updates. Organizations
can create [custom
catalogs](/ai/mcp-catalog-and-toolkit/catalog/#custom-catalogs) with approved
servers for their teams.

[Profiles](/ai/mcp-catalog-and-toolkit/profiles/) organize servers into named
collections for different projects. Your "web-dev" profile might use GitHub and
Playwright; your "backend" profile, database tools. Profiles support both
containerized servers from catalogs and remote MCP servers. Configure a profile
once, then share it across clients or with your team.

Clients are the AI applications that connect to your profiles. Claude Code,
Cursor, Zed, and others connect through the MCP Gateway, which routes requests
to the right server and handles authentication and lifecycle management.

> [!NOTE]
> MCP Gateway as part of Docker AI Governance is an invite-only feature. [Contact Docker Sales](https://www.docker.com/pricing/contact-sales/) to learn more.

## Learn more

<!-- page: https://docs.docker.com/ai/mcp-catalog-and-toolkit/catalog/ fetched 2026-10-08 -->

# Docker MCP Catalog




The [Docker MCP Catalog](https://hub.docker.com/mcp) is a curated collection of
verified MCP servers, packaged as Docker images and distributed through Docker
Hub. It solves common challenges with running MCP servers locally: environment
conflicts, setup complexity, and security concerns.

The catalog serves as the source of available MCP servers. When you add servers
to your [profiles](/desktop/features/mcp-catalog-and-toolkit/profiles/), you select
them from the catalog. Each server runs as an isolated container, making it
portable and consistent across different environments.

> [!NOTE]
> E2B sandboxes now include direct access to the Docker MCP Catalog, giving
> developers access to over 200 tools and services to seamlessly build and run
> AI agents. For more information, see [E2B Sandboxes](/ai/mcp-catalog-and-toolkit/catalog/e2b-sandboxes/).

## What's in the catalog

The Docker MCP Catalog includes:

- Verified servers: All servers are versioned with full provenance and SBOM
  metadata
- Partner tools: Servers from New Relic, Stripe, Grafana, and other trusted
  partners
- Docker-built servers: Locally-running servers built and digitally signed by
  Docker for enhanced security
- Remote services: Cloud-hosted servers that connect to external services like
  GitHub, Notion, and Linear

### Local versus remote servers

The catalog contains two types of servers based on where they run:

Local servers run as containers on your machine. They work offline once
downloaded and offer predictable performance and complete data privacy. Docker
builds and signs all local servers in the catalog.

Remote servers run on the provider's infrastructure and connect to external
services. Many remote servers use OAuth authentication, which the MCP Toolkit
handles automatically through your browser.

## Browse the catalog

Browse available MCP servers at [hub.docker.com/mcp](https://hub.docker.com/mcp)
or directly in Docker Desktop:

1. In Docker Desktop, select **MCP Toolkit**.
2. Select the **Catalog** tab to browse available servers.
3. Select a server to view its description, tools, and configuration options.

## Add servers to a profile

To add a server from the catalog to a profile:

1. In the **Catalog** tab, select the checkbox next to a server.
2. Choose the profile to add it to from the drop-down.

For step-by-step instructions and client connection, see
[Get started with MCP Toolkit](/ai/mcp-catalog-and-toolkit/catalog/get-started/) or
[MCP Profiles](/ai/mcp-catalog-and-toolkit/catalog/profiles/).

## Custom catalogs

Custom catalogs let you curate focused collections of servers for your team or
organization. Instead of exposing all 300+ servers in the Docker catalog, you
define exactly which servers are available.

Common use cases:

- Restrict which servers your organization approves for use
- Add your organization's private MCP servers alongside public ones
- Control which server versions your team uses
- Define the server set available to AI agents using [Dynamic MCP](/ai/mcp-catalog-and-toolkit/catalog/dynamic-mcp/)

### Custom catalogs with Dynamic MCP

Custom catalogs work particularly well with
[Dynamic MCP](/ai/mcp-catalog-and-toolkit/dynamic-mcp/), where agents discover
and add MCP servers on-demand during conversations. When you run the gateway
with a custom catalog, the `mcp-find` tool searches only within that catalog.
If your catalog contains 20 servers instead of 300+, agents work within that
focused set, discovering and enabling tools as needed without manual
configuration each time.

### Import a custom catalog

If someone on your team has created and published a catalog, you can import it
using its OCI registry reference.

In Docker Desktop:

1. Select **MCP Toolkit** and select the **Catalog** tab.
2. Select **Import catalog**.
3. Enter the OCI reference for the catalog (for example,
   `registry.example.com/mcp/team-catalog:latest`).
4. Select **Import**.

Using the CLI:

```console
$ docker mcp catalog pull <oci-reference>
```

Once imported, the catalog appears alongside the Docker catalog and you can add
its servers to your profiles.

### Create and manage custom catalogs

Creating and managing custom catalogs requires the CLI. See
[Custom catalogs](/desktop/features/mcp-catalog-and-toolkit/cli/#custom-catalogs)
in the CLI how-to for step-by-step instructions, including:

- Curating a subset of the Docker catalog
- Adding private servers to a catalog
- Building a focused catalog from scratch
- Pushing a catalog to a registry for your team to import

## Contribute an MCP server to the catalog

The MCP server registry is available at
https://github.com/docker/mcp-registry. To submit an MCP server, follow the
[contributing guidelines](https://github.com/docker/mcp-registry/blob/main/CONTRIBUTING.md).

When your pull request is reviewed and approved, your MCP server is available
within 24 hours on:

- Docker Desktop's [MCP Toolkit feature](/ai/mcp-catalog-and-toolkit/catalog/toolkit/).
- The [Docker MCP Catalog](https://hub.docker.com/mcp).
- The [Docker Hub](https://hub.docker.com/u/mcp) `mcp` namespace (for MCP
  servers built by Docker).

<!-- page: https://docs.docker.com/ai/mcp-catalog-and-toolkit/cli/ fetched 2026-10-08 -->

# Use MCP Toolkit from the CLI




> [!NOTE]
> The `docker mcp` commands documented here are available in Docker Desktop
> 4.62 and later. Earlier versions may not support all commands shown.

The `docker mcp` commands let you manage MCP profiles, servers, OAuth
credentials, and catalogs from the terminal. Use the CLI for scripting,
automation, and headless environments.

## Profiles

### Create a profile

```console
$ docker mcp profile create --name <profile-id>
```

The profile ID is used to reference the profile in subsequent commands:

```console
$ docker mcp profile create --name web-dev
```

### List profiles

```console
$ docker mcp profile list
```

### View a profile

```console
$ docker mcp profile show <profile-id>
```

### Remove a profile

```console
$ docker mcp profile remove <profile-id>
```

> [!CAUTION]
> Removing a profile deletes all its server configurations and settings. This
> action can't be undone.

## Servers

### Browse the catalog

List available servers and their IDs:

```console
$ docker mcp catalog server ls mcp/docker-mcp-catalog
```

The output lists each server by name. The name (for example, `playwright` or
`github-official`) is the server ID to use in `catalog://` URIs.

To look up a server ID in Docker Desktop, open **MCP Toolkit** > **Catalog**,
select a server, and check the **Server ID** field.

### Add servers to a profile

Servers are referenced by URI. The URI format depends on where the server
comes from:

| Format                                | Source                     |
| ------------------------------------- | -------------------------- |
| `catalog://<catalog-ref>/<server-id>` | An OCI catalog             |
| `docker://<image>:<tag>`              | A Docker image             |
| `https://<url>/v0/servers/<uuid>`     | The MCP community registry |
| `file://<path>`                       | A local YAML or JSON file  |

The most common format is `catalog://`, where `<catalog-ref>` matches the
**Catalog** field and `<server-id>` matches the **Server ID** field shown in
Docker Desktop or in the `catalog server ls` output:

```console
$ docker mcp profile server add <profile-id> \
  --server catalog://<catalog-ref>/<server-id>
```

Add multiple servers in one command:

```console
$ docker mcp profile server add web-dev \
  --server catalog://mcp/docker-mcp-catalog/github-official \
  --server catalog://mcp/docker-mcp-catalog/playwright
```

To add a server defined in a local YAML file:

```console
$ docker mcp profile server add my-profile \
  --server file://./my-server.yaml
```

The YAML file defines the server image and configuration:

```yaml
name: my-server
title: My Server
type: server
image: myimage:latest
description: Description of the server
```

If the server requires OAuth authentication, authorize it in Docker Desktop
after adding. See [OAuth authentication](/desktop/features/mcp-catalog-and-toolkit/toolkit/#oauth-authentication).

### List servers

List all servers across all profiles:

```console
$ docker mcp profile server ls
```

Filter by profile:

```console
$ docker mcp profile server ls --filter profile=web-dev
```

### Remove a server

```console
$ docker mcp profile server remove <profile-id> --name <server-name>
```

Remove multiple servers at once:

```console
$ docker mcp profile server remove web-dev \
  --name github-official \
  --name playwright
```

### Configure server settings

Set and retrieve configuration values for servers in a profile:

```console
$ docker mcp profile config <profile-id> --set <server-id>.<key>=<value>
$ docker mcp profile config <profile-id> --get-all
$ docker mcp profile config <profile-id> --del <server-id>.<key>
```

Server configuration keys and their expected values are defined by each server.
Check the server's documentation or its entry in Docker Desktop under
**MCP Toolkit** > **Catalog** > **Configuration**.

## Gateway

Run the MCP Gateway with a specific profile:

```console
$ docker mcp gateway run --profile <profile-id>
```

Omit `--profile` to use the default profile.

### Connect a client manually

To connect any client that isn't listed in Docker Desktop, configure it to run
the gateway over `stdio`. For example, in a JSON-based client configuration:

```json
{
  "servers": {
    "MCP_DOCKER": {
      "command": "docker",
      "args": ["mcp", "gateway", "run", "--profile", "web-dev"],
      "type": "stdio"
    }
  }
}
```

For Claude Desktop, the format is:

```json
{
  "mcpServers": {
    "MCP_DOCKER": {
      "command": "docker",
      "args": ["mcp", "gateway", "run", "--profile", "web-dev"]
    }
  }
}
```

### Connect a named client

Connect a supported client to a profile:

```console
$ docker mcp client connect <client> --profile <profile-id>
```

For example, to connect VS Code to a project-specific profile:

```console
$ docker mcp client connect vscode --profile my-project
```

This creates a `.vscode/mcp.json` file in the current directory. Because this
is a user-specific file, add it to `.gitignore`:

```console
$ echo ".vscode/mcp.json" >> .gitignore
```

## Share profiles

Share profiles with your team using OCI registries or version control.

### Share via OCI registry

Profiles are shared as OCI artifacts via any OCI-compatible registry.
Credentials are not included for security reasons. Team members configure
authentication credentials separately after pulling.

To push an existing profile called `web-dev` to an OCI registry:

```console
$ docker mcp profile push web-dev registry.example.com/profiles/web-dev:v1
```

To pull the same profile:

```console
$ docker mcp profile pull registry.example.com/profiles/team-standard:latest
```

### Share via version control

For project-specific profiles, you can use the `export` and `import` commands
and store the profiles in version control alongside your code. Team members can
import the file to get the same configuration.

To export a profile to your project directory:

```console
$ mkdir -p .docker
$ docker mcp profile export web-dev .docker/mcp-profile.json
```

Team members who clone the repository can import the profile:

```console
$ docker mcp profile import .docker/mcp-profile.json
```

This creates a profile with the servers and configuration defined in the
file. Any authentication credentials must be configured separately if needed.

## Custom catalogs

Custom catalogs let you curate a focused collection of servers for your team
or organization. For an overview of what custom catalogs are and when to use
them, see [Custom catalogs](/desktop/features/mcp-catalog-and-toolkit/catalog/#custom-catalogs).

Catalogs are referenced by OCI reference, for example
`registry.example.com/mcp/my-catalog:latest`. Servers within a catalog use
the same URI schemes as when
[adding servers to a profile](#add-servers-to-a-profile).

### Customize the Docker catalog

Use the Docker catalog as a base, then add or remove servers to fit your
organization's needs. Copy it first:

```console
$ docker mcp catalog tag mcp/docker-mcp-catalog \
  registry.example.com/mcp/company-tools:latest
```

List the servers it contains:

```console
$ docker mcp catalog server ls registry.example.com/mcp/company-tools:latest
```

Remove servers your organization doesn't approve:

```console
$ docker mcp catalog server remove \
  registry.example.com/mcp/company-tools:latest \
  --name <server-name>
```

Add your own private servers, packaged as Docker images:

```console
$ docker mcp catalog server add registry.example.com/mcp/company-tools:latest \
  --server docker://registry.example.com/mcp/internal-api:latest \
  --server docker://registry.example.com/mcp/data-pipeline:latest
```

Push when ready:

```console
$ docker mcp catalog push registry.example.com/mcp/company-tools:latest
```

### Build a catalog from scratch

To include exactly what you choose and nothing else, create a catalog from
scratch. You can include servers from the Docker catalog, your own private
images, or both.

Create a catalog and specify which servers to include:

```console
$ docker mcp catalog create registry.example.com/mcp/data-tools:latest \
  --title "Data Analysis Tools" \
  --server catalog://mcp/docker-mcp-catalog/sequentialthinking \
  --server catalog://mcp/docker-mcp-catalog/brave \
  --server docker://registry.example.com/mcp/analytics:latest
```

View the result:

```console
$ docker mcp catalog show registry.example.com/mcp/data-tools:latest
```

Push to distribute:

```console
$ docker mcp catalog push registry.example.com/mcp/data-tools:latest
```

### Distribute a catalog

Push your catalog so team members can import it:

```console
$ docker mcp catalog push <oci-reference>
```

Team members can pull it using the CLI:

```console
$ docker mcp catalog pull <oci-reference>
```

Or import it using Docker Desktop: select **MCP Toolkit** > **Catalog** >
**Import catalog** and enter the OCI reference.

### Use a custom catalog with the gateway

Run the gateway with your catalog instead of the default Docker catalog:

```console
$ docker mcp gateway run --catalog <oci-reference>
```

For [Dynamic MCP](/desktop/features/mcp-catalog-and-toolkit/dynamic-mcp/), where
agents discover and add servers during conversations, this limits what agents
can find to your curated set.

To enable specific servers from your catalog without using a profile:

```console
$ docker mcp gateway run --catalog <oci-reference> \
  --servers <name1> --servers <name2>
```

## Further reading

- [Get started with MCP Toolkit](/desktop/features/mcp-catalog-and-toolkit/get-started/)
- [MCP Profiles](/desktop/features/mcp-catalog-and-toolkit/profiles/)
- [MCP Catalog](/desktop/features/mcp-catalog-and-toolkit/catalog/)
- [MCP Gateway](/desktop/features/mcp-catalog-and-toolkit/mcp-gateway/)

<!-- page: https://docs.docker.com/ai/mcp-catalog-and-toolkit/dynamic-mcp/ fetched 2026-10-08 -->

# Dynamic MCP


Dynamic MCP enables AI agents to discover and add MCP servers on-demand during
a conversation, without manual configuration. Instead of pre-configuring every
MCP server before starting your agent session, clients can search the
[MCP Catalog](/desktop/features/mcp-catalog-and-toolkit/catalog/) and add servers
as needed.

This capability is enabled automatically when you connect an MCP client to the
[MCP Toolkit](/desktop/features/mcp-catalog-and-toolkit/toolkit/). The gateway
provides a set of primordial tools that agents use to discover and manage
servers during runtime.

> **Experimental**
>
> 

Dynamic MCP is an experimental feature in early development. While you're
welcome to try it out and explore its capabilities, you may encounter
unexpected behavior or limitations. Feedback is welcome via at [GitHub
issues](https://github.com/docker/mcp-gateway/issues) for bug reports and
[GitHub discussions](https://github.com/docker/mcp-gateway/discussions) for
general questions and feature requests.




## How it works

When you connect a client to the MCP Gateway, the gateway exposes a small set
of management tools alongside any MCP servers in your active profile. These
management tools let agents interact with the gateway's configuration:

| Tool             | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| `mcp-find`       | Search for MCP servers in the catalog by name or description             |
| `mcp-add`        | Add a new MCP server to the current session                              |
| `mcp-config-set` | Configure settings for an MCP server                                     |
| `mcp-remove`     | Remove an MCP server from the session                                    |
| `mcp-exec`       | Execute a tool by name that exists in the current session                |
| `code-mode`      | Create a JavaScript-enabled tool that combines multiple MCP server tools |

With these tools available, an agent can search the catalog, add servers,
handle authentication, and use newly added tools directly without requiring a
restart or manual configuration.

Dynamically added servers and tools are associated with your _current session
only_. They're not persisted to your profile. When you start a new session,
only servers you've added to your profile through the
[MCP Toolkit](/desktop/features/mcp-catalog-and-toolkit/toolkit/) or
[Profiles](/desktop/features/mcp-catalog-and-toolkit/profiles/) are available.

## Prerequisites

To use Dynamic MCP, you need:

- Docker Desktop version 4.50 or later, with [MCP Toolkit](/desktop/features/mcp-catalog-and-toolkit/toolkit/) enabled
- An LLM application that supports MCP (such as Claude Desktop, Visual Studio Code, or Claude Code)
- Your client configured to connect to the MCP Gateway

See [Get started with Docker MCP Toolkit](/desktop/features/mcp-catalog-and-toolkit/get-started/)
for setup instructions.

## Usage

Dynamic MCP is enabled automatically when you use the MCP Toolkit. Your
connected clients can now use `mcp-find`, `mcp-add`, and other management tools
during conversations.

To see Dynamic MCP in action, connect your AI client to the Docker MCP Toolkit
and try this prompt:

```plaintext
What MCP servers can I use for working with SQL databases?
```

Given this prompt, your agent will use the `mcp-find` tool provided by MCP
Toolkit to search for SQL-related servers in the [MCP Catalog](/ai/mcp-catalog-and-toolkit/dynamic-mcp/catalog/).

And to add a server to a session, simply write a prompt and the MCP Toolkit
takes care of installing and running the server:

```plaintext
Add the postgres mcp server
```

## Tool composition with code mode

The `code-mode` tool is available as an experimental capability for creating
custom JavaScript functions that combine multiple MCP server tools. The
intended use case is to enable workflows that coordinate multiple services
in a single operation.

> **Note**
>
> Code mode is in early development and is not yet reliable for general use.
> The documentation intentionally omits usage examples at this time.
>
> The core Dynamic MCP capabilities (`mcp-find`, `mcp-add`, `mcp-config-set`,
> `mcp-remove`) work as documented and are the recommended focus for current
> use.

The architecture works as follows:

1. The agent calls `code-mode` with a list of server names and a tool name
2. The gateway creates a sandbox with access to those servers' tools
3. A new tool is registered in the current session with the specified name
4. The agent calls the newly created tool
5. The code executes in the sandbox with access to the specified tools
6. Results are returned to the agent

The sandbox can only interact with the outside world through MCP tools,
which are already running in isolated containers with restricted privileges.

## Security considerations

Dynamic MCP maintains the same security model as static MCP server
configuration in MCP Toolkit:

- All servers in the MCP Catalog are built, signed, and maintained by Docker
- Servers run in isolated containers with restricted resources
- Code mode runs agent-written JavaScript in an isolated sandbox that can only
  interact through MCP tools
- Credentials are managed by the gateway and injected securely into containers

The key difference with dynamic capabilities is that agents can add new tools
during runtime.

## Disabling Dynamic MCP

Dynamic MCP is enabled by default in the MCP Toolkit. If you prefer to use only
statically configured MCP servers, you can disable the dynamic tools feature:

```console
$ docker mcp feature disable dynamic-tools
```

To re-enable the feature later:

```console
$ docker mcp feature enable dynamic-tools
```

After changing this setting, you may need to restart any connected MCP clients.

## Further reading

Check out the [Dynamic MCP servers with Docker](https://docker.com/blog) blog
post for more examples and inspiration on how you can use dynamic tools.

<!-- page: https://docs.docker.com/ai/mcp-catalog-and-toolkit/e2b-sandboxes/ fetched 2026-10-08 -->

# E2B sandboxes


[E2B](https://e2b.dev/) provides secure cloud sandboxes for AI agents with direct access to Docker's [MCP Catalog](https://hub.docker.com/mcp), a collection of 200+ tools from publishers including GitHub, Notion, and Stripe.

When you create an E2B sandbox, you specify which MCP tools it should access. E2B launches these tools and provides access through the Docker MCP Gateway.

## Example: Using GitHub and Notion MCP server

This example demonstrates how to connect multiple MCP servers in an E2B sandbox. You'll analyze data in Notion and create GitHub issues using Claude.

### Prerequisites

Before you begin, make sure you have the following:

- [E2B account](https://e2b.dev/docs/quickstart) with API access
- Anthropic API key for Claude

  > [!NOTE]
  > This example uses Claude Code, which is pre-installed in E2B sandboxes.
  > However, you can adapt the example to work with other AI assistants of your
  > choice. See [E2B's MCP documentation](https://e2b.dev/docs/mcp/quickstart)
  > for alternative connection methods.

- Node.js 18+ installed on your machine
- Notion account with:
  - A database containing sample data
  - [Integration token](https://www.notion.com/help/add-and-manage-connections-with-the-api)
- GitHub account with:
  - A repository for testing
  - Personal access token with `repo` scope

### Set up your environment

Create a new directory and initialize a Node.js project:

```console
$ mkdir mcp-e2b-quickstart
$ cd mcp-e2b-quickstart
$ npm init -y
```

Configure your project for ES modules by updating `package.json`:

```json
{
  "name": "mcp-e2b-quickstart",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node index.js"
  }
}
```

Install required dependencies:

```console
$ npm install e2b dotenv
```

Create a `.env` file with your credentials:

```console
$ cat > .env << 'EOF'
E2B_API_KEY=your_e2b_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
NOTION_INTEGRATION_TOKEN=ntn_your_notion_integration_token_here
GITHUB_TOKEN=ghp_your_github_pat_here
EOF
```

Protect your credentials:

```console
$ echo ".env" >> .gitignore
$ echo "node_modules/" >> .gitignore
```

### Create an E2B sandbox with MCP servers

**Typescript**



Create a file named `index.ts`:

```typescript
import "dotenv/config";
import { Sandbox } from "e2b";

async function quickstart(): Promise<void> {
  console.log("Creating E2B sandbox with Notion and GitHub MCP servers...\n");

  const sbx: Sandbox = await Sandbox.create({
    envs: {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY as string,
    },
    mcp: {
      notion: {
        internalIntegrationToken: process.env
          .NOTION_INTEGRATION_TOKEN as string,
      },
      githubOfficial: {
        githubPersonalAccessToken: process.env.GITHUB_TOKEN as string,
      },
    },
  });

  const mcpUrl = sbx.getMcpUrl();
  const mcpToken = await sbx.getMcpToken();

  console.log("Sandbox created successfully!");
  console.log(`MCP Gateway URL: ${mcpUrl}\n`);

  // Wait for MCP initialization
  await new Promise<void>((resolve) => setTimeout(resolve, 1000));

  // Connect Claude to MCP gateway
  console.log("Connecting Claude to MCP gateway...");
  await sbx.commands.run(
    `claude mcp add --transport http e2b-mcp-gateway ${mcpUrl} --header "Authorization: Bearer ${mcpToken}"`,
    {
      timeoutMs: 0,
      onStdout: console.log,
      onStderr: console.log,
    },
  );

  console.log("\nConnection successful! Cleaning up...");
  await sbx.kill();
}

quickstart().catch(console.error);
```

Run the script:

```console
$ npx tsx index.ts
```

**Python**



Create a file named `index.py`:

```python
import os
import asyncio
from dotenv import load_dotenv
from e2b import Sandbox

load_dotenv()

async def quickstart():
    print("Creating E2B sandbox with Notion and GitHub MCP servers...\n")

    sbx = await Sandbox.beta_create(
        envs={
            "ANTHROPIC_API_KEY": os.getenv("ANTHROPIC_API_KEY"),
        },
        mcp={
            "notion": {
                "internalIntegrationToken": os.getenv("NOTION_INTEGRATION_TOKEN"),
            },
            "githubOfficial": {
                "githubPersonalAccessToken": os.getenv("GITHUB_TOKEN"),
            },
        },
    )

    mcp_url = sbx.beta_get_mcp_url()
    mcp_token = await sbx.beta_get_mcp_token()

    print("Sandbox created successfully!")
    print(f"MCP Gateway URL: {mcp_url}\n")

    # Wait for MCP initialization
    await asyncio.sleep(1)

    # Connect Claude to MCP gateway
    print("Connecting Claude to MCP gateway...")

    def on_stdout(output):
        print(output, end='')

    def on_stderr(output):
        print(output, end='')

    await sbx.commands.run(
        f'claude mcp add --transport http e2b-mcp-gateway {mcp_url} --header "Authorization: Bearer {mcp_token}"',
        timeout_ms=0,
        on_stdout=on_stdout,
        on_stderr=on_stderr
    )

    print("\nConnection successful! Cleaning up...")
    await sbx.kill()

if __name__ == "__main__":
    try:
        asyncio.run(quickstart())
    except Exception as e:
        print(f"Error: {e}")

```

Run the script:

```console
$ python index.py
```



You should see:

```console
Creating E2B sandbox with Notion and GitHub MCP servers...

Sandbox created successfully!
MCP Gateway URL: https://50005-xxxxx.e2b.app/mcp

Connecting Claude to MCP gateway...
Added HTTP MCP server e2b-mcp-gateway with URL: https://50005-xxxxx.e2b.app/mcp

Connection successful! Cleaning up...
```

### Test with example workflow

Now, test the setup by running a simple workflow that searches Notion and creates a GitHub issue.

**Typescript**



> [!IMPORTANT]
>
> Replace `owner/repo` in the prompt with your actual GitHub username and repository
> name (for example, `yourname/test-repo`).

Update `index.ts` with the following example:

```typescript
import "dotenv/config";
import { Sandbox } from "e2b";

async function exampleWorkflow(): Promise<void> {
  console.log("Creating sandbox...\n");

  const sbx: Sandbox = await Sandbox.create({
    envs: {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY as string,
    },
    mcp: {
      notion: {
        internalIntegrationToken: process.env
          .NOTION_INTEGRATION_TOKEN as string,
      },
      githubOfficial: {
        githubPersonalAccessToken: process.env.GITHUB_TOKEN as string,
      },
    },
  });

  const mcpUrl = sbx.getMcpUrl();
  const mcpToken = await sbx.getMcpToken();

  console.log("Sandbox created successfully\n");

  // Wait for MCP servers to initialize
  await new Promise<void>((resolve) => setTimeout(resolve, 3000));

  console.log("Connecting Claude to MCP gateway...\n");
  await sbx.commands.run(
    `claude mcp add --transport http e2b-mcp-gateway ${mcpUrl} --header "Authorization: Bearer ${mcpToken}"`,
    {
      timeoutMs: 0,
      onStdout: console.log,
      onStderr: console.log,
    },
  );

  console.log("\nRunning example: Search Notion and create GitHub issue...\n");

  const prompt: string = `Using Notion and GitHub MCP tools:
1. Search my Notion workspace for databases
2. Create a test issue in owner/repo titled "MCP Toolkit Test" with description "Testing E2B + Docker MCP integration"
3. Confirm both operations completed successfully`;

  await sbx.commands.run(
    `echo '${prompt.replace(/'/g, "'\\''")}' | claude -p --dangerously-skip-permissions`,
    {
      timeoutMs: 0,
      onStdout: console.log,
      onStderr: console.log,
    },
  );

  await sbx.kill();
}

exampleWorkflow().catch(console.error);
```

Run the script:

```console
$ npx tsx index.ts
```

**Python**



Update `index.py` with this example:

> [!IMPORTANT]
>
> Replace `owner/repo` in the prompt with your actual GitHub username and repository
> name (for example, `yourname/test-repo`).

```python
import os
import asyncio
import shlex
from dotenv import load_dotenv
from e2b import Sandbox

load_dotenv()

async def example_workflow():
    print("Creating sandbox...\n")

    sbx = await Sandbox.beta_create(
        envs={
            "ANTHROPIC_API_KEY": os.getenv("ANTHROPIC_API_KEY"),
        },
        mcp={
            "notion": {
                "internalIntegrationToken": os.getenv("NOTION_INTEGRATION_TOKEN"),
            },
            "githubOfficial": {
                "githubPersonalAccessToken": os.getenv("GITHUB_TOKEN"),
            },
        },
    )

    mcp_url = sbx.beta_get_mcp_url()
    mcp_token = await sbx.beta_get_mcp_token()

    print("Sandbox created successfully\n")

    # Wait for MCP servers to initialize
    await asyncio.sleep(3)

    print("Connecting Claude to MCP gateway...\n")

    def on_stdout(output):
        print(output, end='')

    def on_stderr(output):
        print(output, end='')

    await sbx.commands.run(
        f'claude mcp add --transport http e2b-mcp-gateway {mcp_url} --header "Authorization: Bearer {mcp_token}"',
        timeout_ms=0,
        on_stdout=on_stdout,
        on_stderr=on_stderr
    )

    print("\nRunning example: Search Notion and create GitHub issue...\n")

    prompt = """Using Notion and GitHub MCP tools:
1. Search my Notion workspace for databases
2. Create a test issue in owner/repo titled "MCP Toolkit Test" with description "Testing E2B + Docker MCP integration"
3. Confirm both operations completed successfully"""

    # Escape single quotes for shell
    escaped_prompt = prompt.replace("'", "'\\''")

    await sbx.commands.run(
        f"echo '{escaped_prompt}' | claude -p --dangerously-skip-permissions",
        timeout_ms=0,
        on_stdout=on_stdout,
        on_stderr=on_stderr
    )

    await sbx.kill()

if __name__ == "__main__":
    try:
        asyncio.run(example_workflow())
    except Exception as e:
        print(f"Error: {e}")
```

Run the script:

```console
$ python workflow.py
```



You should see:

```console
Creating sandbox...

Running example: Search Notion and create GitHub issue...

## Task Completed Successfully

I've completed both operations using the Notion and GitHub MCP tools:

### 1. Notion Workspace Search

Found 3 databases in your Notion workspace:
- **Customer Feedback** - Database with 12 entries tracking feature requests
- **Product Roadmap** - Planning database with 8 active projects
- **Meeting Notes** - Shared workspace with 45 pages

### 2. GitHub Issue Creation

Successfully created test issue:
- **Repository**: your-org/your-repo
- **Issue Number**: #47
- **Title**: "MCP Test"
- **Description**: "Testing E2B + Docker MCP integration"
- **Status**: Open
- **URL**: https://github.com/your-org/your-repo/issues/47

Both operations completed successfully. The MCP servers are properly configured and working.
```

The sandbox connected multiple MCP servers and orchestrated a workflow across Notion and GitHub. You can extend this pattern to combine any of the 200+ MCP servers in the Docker MCP Catalog.

## Related pages

- [How to build an AI-powered code quality workflow with SonarQube and E2B](/guides/github-sonarqube-sandbox/)
- [Docker + E2B: Building the Future of Trusted AI](https://www.docker.com/blog/docker-e2b-building-the-future-of-trusted-ai/)
- [Docker Sandboxes](/ai/sandboxes/)
- [Docker MCP Toolkit and Catalog](/desktop/features/mcp-catalog-and-toolkit/)
- [Docker MCP Gateway](/desktop/features/mcp-catalog-and-toolkit/mcp-gateway/)
- [E2B MCP documentation](https://e2b.dev/docs/mcp)

<!-- page: https://docs.docker.com/ai/mcp-catalog-and-toolkit/faqs/ fetched 2026-10-08 -->

# MCP Toolkit FAQs


Docker MCP Catalog and Toolkit is a solution for securely building, sharing, and
running MCP tools. This page answers common questions about MCP Catalog and Toolkit security.

### What process does Docker follow to add a new MCP server to the catalog?

Developers can submit a pull request to the [Docker MCP Registry](https://github.com/docker/mcp-registry) to propose new servers. Docker provides detailed [contribution guidelines](https://github.com/docker/mcp-registry/blob/main/CONTRIBUTING.md) to help developers meet the required standards.

Currently, a majority of the servers in the catalog are built directly by Docker. Each server includes attestations such as:

- Build attestation: Servers are built on Docker Build Cloud.
- Source provenance: Verifiable source code origins.
- Signed SBOMs: Software Bill of Materials with cryptographic signatures.

> [!NOTE]
> When using the images with [Docker MCP gateway](/desktop/features/mcp-catalog-and-toolkit/mcp-gateway/),
> you can verify attestations at runtime using the `docker mcp gateway run
--verify-signatures` CLI command.


In addition to Docker-built servers, the catalog includes select servers from trusted registries such as GitHub and HashiCorp. Each third-party server undergoes a verification process that includes:

- Pulling and building the code in an ephemeral build environment.
- Testing initialization and functionality.
- Verifying that tools can be successfully listed.

### Under what conditions does Docker reject MCP server submissions?

Docker rejects MCP server submissions that fail automated testing and validation processes during pull request review. Additionally, Docker reviewers evaluate submissions against specific requirements and reject MCP servers that don't meet these criteria.

### Does Docker take accountability for malicious MCP servers in the Toolkit?

Docker’s security measures currently represent a best-effort approach. While Docker implements automated testing, scanning, and metadata extraction for each server in the catalog, these security measures are not yet exhaustive. Docker is actively working to enhance its security processes and expand testing coverage. Enterprise customers can contact their Docker account manager for specific security requirements and implementation details.

### How are credentials managed for MCP servers?

Starting with Docker Desktop version 4.43.0, credentials are stored securely in the Docker Desktop VM. The storage implementation depends on the platform (for example, macOS, WSL2). You can manage the credentials using the following CLI commands:

- `docker mcp secret ls` - List stored credentials
- `docker mcp secret rm` - Remove specific credentials
- `docker mcp oauth revoke` - Revoke OAuth-based credentials

In the upcoming versions of Docker Desktop, Docker plans to support pluggable storage for these secrets and additional out-of-the-box storage providers to give users more flexibility in managing credentials.

### Are credentials removed when an MCP server is uninstalled?

No. MCP servers are not technically uninstalled since they exist as Docker containers pulled to your local Docker Desktop. Removing an MCP server stops the container but leaves the image on your system. Even if the container is deleted, credentials remain stored until you remove them manually.

### Why don't I see remote MCP servers in the catalog?

If remote MCP servers aren't visible in the Docker Desktop catalog, your local
catalog may be out of date. Remote servers are indicated by a cloud icon and
include services like GitHub, Notion, and Linear.

Update your catalog by running:

```console
$ docker mcp catalog update
```

After the update completes, refresh the **Catalog** tab in Docker Desktop.

### What's the difference between profiles and the catalog?

The [catalog](/desktop/features/mcp-catalog-and-toolkit/catalog/) is the source of
available MCP servers - a library of tools you can choose from.
[Profiles](/desktop/features/mcp-catalog-and-toolkit/profiles/) are collections of
servers you've added to organize your work. Think of the catalog as a library,
and profiles as your personal bookshelves containing the books you've selected
for different purposes.

### Can I share profiles with my team?

Yes. Profiles can be pushed to OCI-compliant registries using
`docker mcp profile push my-profile registry.example.com/profiles/my-profile:v1`.
Team members can pull your profile with
`docker mcp profile pull registry.example.com/profiles/my-profile:v1`. Note
that credentials aren't included in shared profiles for security reasons - team
members need to configure OAuth and other credentials separately.

### Do I need to create a profile to use MCP Toolkit?

Yes, MCP Toolkit requires a profile to run servers. If you're upgrading from a
version before profiles were introduced, a default profile is automatically
created for you with your existing server configurations. You can create
additional named profiles to organize servers for different projects or
environments.

### What happens to servers when I switch profiles?

Each profile contains its own set of servers and configurations. When you run
the gateway with `--profile profile-name`, only servers in that profile are
available to clients. The default profile is used when no profile is specified.
Switching between profiles changes which servers your AI applications can
access.

### Can I use the same server in multiple profiles?

Yes. You can add the same MCP server to multiple profiles, each with different
configurations if needed. This is useful when you need the same server with
different settings for different projects or environments.

## Related pages

- [Get started with MCP Toolkit](/desktop/features/mcp-catalog-and-toolkit/get-started/)
- [Open-source MCP Gateway](/desktop/features/mcp-catalog-and-toolkit/mcp-gateway/)

<!-- page: https://docs.docker.com/ai/mcp-catalog-and-toolkit/get-started/ fetched 2026-10-08 -->

# Get started with Docker MCP Toolkit




> [!NOTE]
> This page describes the MCP Toolkit interface in Docker Desktop 4.62 and
> later. Earlier versions have a different UI. Upgrade to follow these
> instructions exactly.

The Docker MCP Toolkit makes it easy to set up, manage, and run containerized
Model Context Protocol (MCP) servers in profiles, and connect them to AI
agents. It provides secure defaults and support for a growing ecosystem of
LLM-based clients. This page shows you how to get started quickly with the
Docker MCP Toolkit.

## Setup

Before you begin, make sure you meet the following requirements to get started with Docker MCP Toolkit.

1. Download and install the latest version of [Docker Desktop](/get-started/get-docker/).
2. Open the Docker Desktop settings and select **Beta features**.
3. Select **Enable Docker MCP Toolkit**.
4. Select **Apply**.

The **Learning center** in Docker Desktop provides walkthroughs and resources
to help you get started with Docker products and features. On the **MCP
Toolkit** page, the **Get started** walkthrough guides you through installing
an MCP server, connecting a client, and testing your setup.

Alternatively, follow the step-by-step instructions on this page:

- [Create a profile](#create-a-profile) - Your workspace for organizing servers
- [Add MCP servers to your profile](#add-mcp-servers) - Select tools from the catalog
- [Connect clients](#connect-clients) - Link AI applications to your profile
- [Verify connections](#verify-connections) - Test that everything works

Once configured, your AI applications can use all the servers in your profile.

> [!TIP]
> Prefer working from the terminal? See [Use MCP Toolkit from the CLI](/ai/mcp-catalog-and-toolkit/get-started/cli/)
> for instructions on using the `docker mcp` commands.

## Create a profile

Profiles organize your MCP servers into collections. Create a profile for your
work:

> [!NOTE]
> If you're upgrading from a previous version of MCP Toolkit, your existing
> server configurations are already in a `default` profile. You can continue
> using the default profile or create new profiles for different projects.

1. In Docker Desktop, select **MCP Toolkit** and select the **Profiles** tab.
2. Select **Create profile**.
3. Enter a name for your profile (e.g., "Frontend development").
4. Optionally, add servers and clients now, or add them later.
5. Select **Create**.

Your new profile appears in the profiles list.

## Add MCP servers

1. In Docker Desktop, select **MCP Toolkit** and select the **Catalog** tab.
2. Browse the catalog and select the servers you want to add.
3. Select the **Add to** button and choose whether you want to add the servers
   to an existing profile, or create a new profile.

If a server requires configuration, a **Configuration Required** badge appears
next to the server's name. You must complete the mandatory configuration before
you can use the server.

You've now successfully added MCP servers to your profile. Next, connect an MCP
client to use the servers in your profile.

## Connect clients

To connect a client to MCP Toolkit:

1. In Docker Desktop, select **MCP Toolkit** and select the **Clients** tab.
2. Find your application in the list.
3. Select **Connect** to configure the client.

If your client isn't listed, you can connect the MCP Toolkit manually over
`stdio` by configuring your client to run the gateway with your profile:

```plaintext
docker mcp gateway run --profile my_profile
```

For example, if your client uses a JSON file to configure MCP servers, you may
add an entry like:

```json {title="Example configuration"
{
  "servers": {
    "MCP_DOCKER": {
      "command": "docker",
      "args": ["mcp", "gateway", "run", "--profile", "my_profile"],
      "type": "stdio"
    }
  }
}
```

Consult the documentation of the application you're using for instructions on
how to set up MCP servers manually.

## Verify connections

Refer to the relevant section for instructions on how to verify that your setup
is working:

- [Claude Code](#claude-code)
- [Claude Desktop](#claude-desktop)
- [OpenAI Codex](#codex)
- [Continue](#continue)
- [Cursor](#cursor)
- [Gemini](#gemini)
- [Goose](#goose)
- [LM Studio](#lm-studio)
- [OpenCode](#opencode)
- [Sema4.ai](#sema4)
- [Visual Studio Code](#vscode)
- [Zed](#zed)
- [Mistral Vibe](#mistral-vibe)

### Claude Code

If you configured the MCP Toolkit for a specific project, navigate to the
relevant project directory. Then run `claude mcp list`. The output should show
`MCP_DOCKER` with a "connected" status:

```console
$ claude mcp list
Checking MCP server health...

MCP_DOCKER: docker mcp gateway run - ✓ Connected
```

Test the connection by submitting a prompt that invokes one of your installed
MCP servers:

```console
$ claude "Use the GitHub MCP server to show me my open pull requests"
```

### Claude Desktop

Restart Claude Desktop and check the **Search and tools** menu in the chat
input. You should see the `MCP_DOCKER` server listed and enabled:

![Claude Desktop](/ai/mcp-catalog-and-toolkit/get-started/images/claude-desktop.avif)

Test the connection by submitting a prompt that invokes one of your installed
MCP servers:

```plaintext
Use the GitHub MCP server to show me my open pull requests
```

### Codex

Run `codex mcp list` to view active MCP servers and their statuses. The
`MCP_DOCKER` server should appear in the list with an "enabled" status:

```console
$ codex mcp list
Name        Command  Args             Env  Cwd  Status   Auth
MCP_DOCKER  docker   mcp gateway run  -    -    enabled  Unsupported
```

Test the connection by submitting a prompt that invokes one of your installed
MCP servers:

```console
$ codex "Use the GitHub MCP server to show me my open pull requests"
```

### Continue

Launch the Continue terminal UI by running `cn`. Use the `/mcp` command to view
active MCP servers and their statuses. The `MCP_DOCKER` server should appear in
the list with a "connected" status:

```plaintext
   MCP Servers

   ➤ 🟢 MCP_DOCKER (🔧75 📝3)
     🔄 Restart all servers
     ⏹️ Stop all servers
     🔍 Explore MCP Servers
     Back

   ↑/↓ to navigate, Enter to select, Esc to go back
```

Test the connection by submitting a prompt that invokes one of your installed
MCP servers:

```console
$ cn "Use the GitHub MCP server to show me my open pull requests"
```

### Cursor

Open Cursor. If you configured the MCP Toolkit for a specific project, open the
relevant project directory. Then navigate to **Cursor Settings > Tools & MCP**.
You should see `MCP_DOCKER` under **Installed MCP Servers**:

![Cursor](/ai/mcp-catalog-and-toolkit/get-started/images/cursor.avif)

Test the connection by submitting a prompt that invokes one of your installed
MCP servers:

```plaintext
Use the GitHub MCP server to show me my open pull requests
```

### Gemini

Run `gemini mcp list` to view active MCP servers and their statuses. The
`MCP_DOCKER` should appear in the list with a "connected" status.

```console
$ gemini mcp list
Configured MCP servers:

✓ MCP_DOCKER: docker mcp gateway run (stdio) - Connected
```

Test the connection by submitting a prompt that invokes one of your installed
MCP servers:

```console
$ gemini "Use the GitHub MCP server to show me my open pull requests"
```

### Goose

**Desktop app**



Open the Goose desktop application and select **Extensions** in the sidebar.
Under **Enabled Extensions**, you should see an extension named `Mcpdocker`:

![Goose desktop app](/ai/mcp-catalog-and-toolkit/get-started/images/goose.avif)

**CLI**



Run `goose info -v` and look for an entry named `mcpdocker` under extensions.
The status should show `enabled: true`:

```console
$ goose info -v
…
    mcpdocker:
      args:
      - mcp
      - gateway
      - run
      available_tools: []
      bundled: null
      cmd: docker
      description: The Docker MCP Toolkit allows for easy configuration and consumption of MCP servers from the Docker MCP Catalog
      enabled: true
      env_keys: []
      envs: {}
      name: mcpdocker
      timeout: 300
      type: stdio
```



Test the connection by submitting a prompt that invokes one of your installed
MCP servers:

```plaintext
Use the GitHub MCP server to show me my open pull requests
```

### LM Studio

Restart LM Studio and start a new chat. Open the integrations menu and look for
an entry named `mcp/mcp-docker`. Use the toggle to enable the server:

![LM Studio](/ai/mcp-catalog-and-toolkit/get-started/images/lm-studio.avif)

Test the connection by submitting a prompt that invokes one of your installed
MCP servers:

```plaintext
Use the GitHub MCP server to show me my open pull requests
```

### OpenCode

The OpenCode configuration file (at `~/.config/opencode/opencode.json` by
default) contains the setup for MCP Toolkit:

```json
{
  "mcp": {
    "MCP_DOCKER": {
      "type": "local",
      "command": ["docker", "mcp", "gateway", "run"],
      "enabled": true
    }
  },
  "$schema": "https://opencode.ai/config.json"
}
```

Test the connection by submitting a prompt that invokes one of your installed
MCP servers:

```console
$ opencode "Use the GitHub MCP server to show me my open pull requests"
```

### Sema4.ai Studio {#sema4}

In Sema4.ai Studio, select **Actions** in the sidebar, then select the **MCP
Servers** tab. You should see Docker MCP Toolkit in the list:

![Docker MCP Toolkit in Sema4.ai Studio](/ai/mcp-catalog-and-toolkit/get-started/images/sema4-mcp-list.avif)

To use MCP Toolkit with Sema4.ai, add it as an agent action. Find the agent you
want to connect to the MCP Toolkit and open the agent editor. Select **Add
Action**, enable Docker MCP Toolkit in the list, then save your agent:

![Editing an agent in Sema4.ai Studio](/ai/mcp-catalog-and-toolkit/get-started/images/sema4-edit-agent.avif)

Test the connection by submitting a prompt that invokes one of your installed
MCP servers:

```plaintext
Use the GitHub MCP server to show me my open pull requests
```

### Visual Studio Code {#vscode}

Open Visual Studio Code. If you configured the MCP Toolkit for a specific
project, open the relevant project directory. Then open the **Extensions**
pane. You should see the `MCP_DOCKER` server listed under installed MCP
servers.

![MCP_DOCKER installed in Visual Studio Code](/ai/mcp-catalog-and-toolkit/get-started/images/vscode-extensions.avif)

Test the connection by submitting a prompt that invokes one of your installed
MCP servers:

```plaintext
Use the GitHub MCP server to show me my open pull requests
```

### Zed

Launch Zed and open agent settings:

![Opening Zed agent settings from command palette](/ai/mcp-catalog-and-toolkit/get-started/images/zed-cmd-palette.avif)

Ensure that `MCP_DOCKER` is listed and enabled in the MCP Servers section:

![MCP_DOCKER in Zed's agent settings](/ai/mcp-catalog-and-toolkit/get-started/images/zed-agent-settings.avif)

Test the connection by submitting a prompt that invokes one of your installed
MCP servers:

```plaintext
Use the GitHub MCP server to show me my open pull requests
```

### Mistral Vibe

Mistral Vibe uses a TOML configuration file at `~/.vibe/config.toml`. Add the
MCP Toolkit as a stdio MCP server in the `[[mcp_servers]]` section:

**Linux**



```toml
[[mcp_servers]]
name = "MCP_DOCKER"
transport = "stdio"
command = ["docker"]
args = ["mcp", "gateway", "run", "--profile", "my_profile"]
startup_timeout_sec = 60
disabled = false
```

**macOS**



```toml
[[mcp_servers]]
name = "MCP_DOCKER"
transport = "stdio"
command = ["docker"]
args = ["mcp", "gateway", "run", "--profile", "my_profile"]
startup_timeout_sec = 60
disabled = false
```

**Windows**



On Windows, the Docker installation path (`C:\Program Files\Docker\...`)
contains a space. Use a list for `command` with the full path to `docker.exe`,
and add `PROGRAMFILES` and `PROGRAMDATA` environment variables that the MCP
Python SDK doesn't inherit by default:

```toml
[[mcp_servers]]
name = "MCP_DOCKER"
transport = "stdio"
command = ["C:/Program Files/Docker/Docker/resources/bin/docker.exe"]
args = ["mcp", "gateway", "run", "--profile", "my_profile"]
env = { PROGRAMFILES = "C:\\Program Files", PROGRAMDATA = "C:\\ProgramData" }
startup_timeout_sec = 60
disabled = false
```



The `startup_timeout_sec = 60` is recommended because the Docker MCP Gateway
takes approximately 15-25 seconds to start. The default timeout is 10 seconds,
which isn't enough for the gateway to initialize.

Restart Vibe. In a Vibe CLI session, run `/mcp` to view active MCP servers.
The `MCP_DOCKER` server should appear in the list:

```console
$ vibe
> /mcp
```

Test the connection by submitting a prompt that invokes one of your installed
MCP servers:

```console
$ vibe "Use the GitHub MCP server to show me my open pull requests"
```

## Further reading

- [MCP Profiles](/desktop/features/mcp-catalog-and-toolkit/profiles/)
- [MCP Toolkit](/desktop/features/mcp-catalog-and-toolkit/toolkit/)
- [MCP Catalog](/desktop/features/mcp-catalog-and-toolkit/catalog/)
- [MCP Gateway](/desktop/features/mcp-catalog-and-toolkit/mcp-gateway/)

<!-- page: https://docs.docker.com/ai/mcp-catalog-and-toolkit/mcp-gateway/ fetched 2026-10-08 -->

# MCP Gateway


> [!NOTE]
> MCP Gateway as part of Docker AI Governance is an invite-only feature. [Contact Docker Sales](https://www.docker.com/pricing/contact-sales/) to learn more.

The MCP Gateway is Docker's open source solution for orchestrating Model
Context Protocol (MCP) servers. It acts as a centralized proxy between clients
and servers, managing configuration, credentials, and access control.

When using MCP servers without the MCP Gateway, you need to configure
applications individually for each AI application. With the MCP Gateway, you
configure applications to connect to the Gateway. The Gateway then handles
server lifecycle, routing, and authentication across all servers in your
[profiles](/desktop/features/mcp-catalog-and-toolkit/profiles/).

If you use Docker Desktop with MCP Toolkit enabled, the Gateway runs
automatically in the background. You don't need to start or configure it
manually. This documentation is for users who want to understand how the Gateway works or run it directly for advanced use cases.

> [!TIP]
> E2B sandboxes now include direct access to the Docker MCP Catalog, giving developers
> access to over 200 tools and services to seamlessly build and run AI agents. For
> more information, see [E2B Sandboxes](/ai/mcp-catalog-and-toolkit/mcp-gateway/e2b-sandboxes/).

## How it works

MCP Gateway runs MCP servers in isolated Docker containers with restricted
privileges, network access, and resource usage. It includes built-in logging
and call-tracing capabilities to ensure full visibility and governance of AI
tool activity.

The MCP Gateway manages the server's entire lifecycle. When an AI application
needs to use a tool, it sends a request to the Gateway. The Gateway identifies
which server handles that tool and, if the server isn't already running, starts
it as a Docker container. The Gateway then injects any required credentials,
applies security restrictions, and forwards the request to the server. The
server processes the request and returns the result through the Gateway back to
the AI application.

The MCP Gateway solves a fundamental problem: MCP servers are just programs
that need to run somewhere. Running them directly on your machine means dealing
with installation, dependencies, updates, and security risks. By running them
as containers managed by the Gateway, you get isolation, consistent
environments, and centralized control.

The Gateway works with profiles to determine which servers are available. When
you run the Gateway, you specify which profile to use with the `--profile` flag
to determine which servers are made available to clients.

## Usage

To use the MCP Gateway, you'll need Docker Desktop with MCP Toolkit enabled.
Follow the [MCP Toolkit guide](/ai/mcp-catalog-and-toolkit/mcp-gateway/toolkit/) to enable and configure servers
through the Docker Desktop interface, or see
[Use MCP Toolkit from the CLI](/ai/mcp-catalog-and-toolkit/mcp-gateway/cli/) for terminal-based workflows.

### Install the MCP Gateway manually

For Docker Engine without Docker Desktop, you'll need to download and install
the MCP Gateway separately before you can run it.

1. Download the latest binary from the [GitHub releases page](https://github.com/docker/mcp-gateway/releases/latest).

2. Move or symlink the binary to the destination matching your OS:

   | OS      | Binary destination                  |
   | ------- | ----------------------------------- |
   | Linux   | `~/.docker/cli-plugins/docker-mcp`  |
   | macOS   | `~/.docker/cli-plugins/docker-mcp`  |
   | Windows | `%USERPROFILE%\.docker\cli-plugins` |

3. Make the binaries executable:

   ```bash
   $ chmod +x ~/.docker/cli-plugins/docker-mcp
   ```

You can now use the `docker mcp` command:

```bash
docker mcp --help
```

## Additional information

For more details on how the MCP Gateway works and available customization
options, see the complete documentation [on GitHub](https://github.com/docker/mcp-gateway).

<!-- page: https://docs.docker.com/ai/mcp-catalog-and-toolkit/profiles/ fetched 2026-10-08 -->

# MCP Profiles




Profiles organize your MCP servers into named collections. Without profiles,
you'd configure servers separately for every AI application you use. Each time
you want to change which servers are available, you'd update Claude Desktop, VS
Code, Cursor, and other tools individually. Profiles solve this by centralizing
your server configurations.

## What profiles do

A profile is a named collection of MCP servers with their configurations and
settings. You select servers from the [MCP
Catalog](/desktop/features/mcp-catalog-and-toolkit/catalog/) (the source of
available servers) and add them to your profiles (your configured server
collections for specific work). Think of the catalog as a library of tools, and
profiles as your toolboxes organized for different jobs.

Your "web-dev" profile might include GitHub, Playwright, and database servers.
Your "data-analysis" profile might include spreadsheet, API, and visualization
servers. Connect different AI clients to different profiles, or switch between
profiles as you change tasks.

When you run the MCP Gateway or connect a client without specifying a profile,
Docker MCP uses your default profile. If you're upgrading from a previous
version of MCP Toolkit, your existing server configurations are already in the
default profile.

## Profile capabilities

Each profile maintains its own isolated collection of servers and
configurations. Your "web-dev" profile might include GitHub, Playwright, and
database servers, while your "data-analysis" profile includes spreadsheet, API,
and visualization servers. Create as many profiles as you need, each containing
only the servers relevant to that context.

> [!NOTE]
>
> OAuth credentials are an exception to profile isolation — they are shared
> across all profiles. If you need to use different accounts for different
> projects, revoke and re-authorize when switching profiles.

You can connect different AI applications to different profiles. When you
connect a client, you specify which profile it should use. This means Claude
Desktop and VS Code can have access to different server collections if needed.

Profiles can be shared with your team. Push a profile to your registry, and
team members can pull it to get the exact same server collection and
configuration you use.

## Creating and managing profiles

### Create a profile

1. In Docker Desktop, select **MCP Toolkit** and select the **Profiles** tab.
2. Select **Create profile**.
3. Enter a name for your profile (e.g., "web-dev").
4. Optionally, search and add servers to your profile now, or add them later.
5. Optionally, search and add clients to connect to your profile.
6. Select **Create**.

Your new profile appears in the profiles list.

### View profile details

Select a profile in the **Profiles** tab to view its details. The profile view
has two tabs:

- **Overview**: Shows the servers in your profile, secrets configuration, and
  connected clients. Use the **+** buttons to add more servers or clients.
- **Tools**: Lists all available tools from your profile's servers. You can
  enable or disable individual tools.

### Remove a profile

1. In the **Profiles** tab, find the profile you want to remove.
2. Select ⋮ next to the profile name, and then **Delete**.
3. Confirm the removal.

> [!CAUTION]
> Removing a profile deletes all its server configurations and settings, and
> updates the client configuration (removes MCP Toolkit). This action can't be
> undone.

### Default profile

When you run the MCP Gateway or use MCP Toolkit without specifying a profile,
Docker MCP uses a profile named `default`, or an empty configuration if a
`default` profile does not exist.

If you're upgrading from a previous version of MCP Toolkit, your existing
server configurations automatically migrate to the `default` profile. You don't
need to manually recreate your setup - everything continues to work as before.

You can always specify a different profile using the `--profile` flag with the
gateway command:

```console
$ docker mcp gateway run --profile web-dev
```

## Adding servers to profiles

Profiles contain the MCP servers you select from the catalog. Add servers to
organize your tools for specific workflows.

### Add a server

You can add servers to a profile in two ways.

From the Catalog tab:

1. Select the **Catalog** tab.
2. Select the checkbox next to servers you want to add to see which profile to
   add them to.
3. Choose your profile from the drop-down.

From within a profile:

1. Select the **Profiles** tab and select your profile.
2. In the **Servers** section, select the **+** button.
3. Search for and select servers to add.

If a server requires OAuth authentication, you're prompted to authorize it. See
[OAuth authentication](/desktop/features/mcp-catalog-and-toolkit/toolkit/#oauth-authentication)
for details.

### List servers in a profile

Select a profile in the **Profiles** tab to see all servers it contains.

### Remove a server

1. Select the **Profiles** tab and select your profile.
2. In the **Servers** section, find the server you want to remove.
3. Select the delete icon next to the server.

## Configuring profiles

### Server configuration

Some servers require configuration beyond authentication. Configure server
settings within your profile.

1. Select the **Profiles** tab and select your profile.
2. In the **Servers** section, select the configure icon next to the server.
3. Adjust the server's configuration settings as needed.

### OAuth credentials

OAuth credentials are shared across all profiles. When you authorize access to
a service like GitHub or Notion, that authorization is available to any server
in any profile that needs it.

This means all profiles use the same OAuth credentials for a given service. If
you need to use different accounts for different projects, you'll need to
revoke and re-authorize between switching profiles.

See [OAuth authentication](/desktop/features/mcp-catalog-and-toolkit/toolkit/#oauth-authentication)
for details on authorizing servers.

### Configuration persistence

Profile configurations persist in your Docker installation. When you restart
Docker Desktop or your system, your profiles, servers, and configurations
remain intact.

## Sharing profiles

Profiles can be shared with your team by pushing them to OCI-compliant
registries as artifacts. This is useful for distributing standardized MCP
setups across your organization. Credentials are not included in shared
profiles for security reasons. Team members configure OAuth separately after
pulling.

### Push a profile

1. Select the profile you want to share in the **Profiles** tab.
2. Select **Push to Registry**.
3. Enter the registry destination (e.g., `registry.example.com/profiles/web-dev:v1`).
4. Complete authentication if required.

### Pull a profile

1. Select **Pull from Registry** in the **Profiles** tab.
2. Enter the registry reference (e.g., `registry.example.com/profiles/team-standard:latest`).
3. Complete authentication if required.

The profile is downloaded and added to your profiles list. Configure any
required OAuth credentials separately.

### Team collaboration workflow

A typical workflow for sharing profiles across a team:

1. Create and configure a profile with the servers your team needs.
2. Test the profile to ensure it works as expected.
3. Push the profile to your team's registry with a version tag (e.g.,
   `registry.example.com/profiles/team-dev:v1`).
4. Share the registry reference with your team.
5. Team members pull the profile and configure any required OAuth credentials.

This ensures everyone uses the same server collection and configuration,
reducing setup time and inconsistencies.

## Using profiles with clients

When you connect an AI client to the MCP Gateway, you specify which profile's
servers the client can access.

### Run the gateway with a profile

Connect clients to your profile through the **Clients** section in the MCP
Toolkit. You can add clients when creating a profile or add them to existing
profiles later.

### Configure clients for specific profiles

When setting up a client manually, you can specify which profile the client
uses. This lets different clients connect to different profiles.

For example, your Claude Desktop configuration might use:

```json
{
  "mcpServers": {
    "MCP_DOCKER": {
      "command": "docker",
      "args": ["mcp", "gateway", "run", "--profile", "claude-work"]
    }
  }
}
```

While your VS Code configuration uses a different profile:

```json
{
  "mcp": {
    "servers": {
      "MCP_DOCKER": {
        "command": "docker",
        "args": ["mcp", "gateway", "run", "--profile", "vscode-dev"],
        "type": "stdio"
      }
    }
  }
}
```

### Switching between profiles

To switch the profile your clients use, update the client configuration to
specify a different `--profile` value in the gateway command arguments.

## Further reading

- [Get started with MCP Toolkit](/desktop/features/mcp-catalog-and-toolkit/get-started/)
- [Use MCP Toolkit from the CLI](/desktop/features/mcp-catalog-and-toolkit/cli/)
- [MCP Catalog](/desktop/features/mcp-catalog-and-toolkit/catalog/)
- [MCP Toolkit](/desktop/features/mcp-catalog-and-toolkit/toolkit/)

<!-- page: https://docs.docker.com/ai/mcp-catalog-and-toolkit/toolkit/ fetched 2026-10-08 -->

# Docker MCP Toolkit




> [!NOTE]
> This page describes the MCP Toolkit interface in Docker Desktop 4.62 and
> later. Earlier versions have a different UI. Upgrade to follow these
> instructions exactly.

The Docker MCP Toolkit is a management interface integrated into Docker Desktop
that lets you set up, manage, and run containerized MCP servers in profiles and
connect them to AI agents. It removes friction from tool usage by offering
secure defaults, easy setup, and support for a growing ecosystem of LLM-based
clients. It is the fastest way from MCP tool discovery to local execution.

## Key features

- Cross-LLM compatibility: Works with Claude, Cursor, and other MCP clients.
- Integrated tool discovery: Browse and launch MCP servers from the Docker MCP Catalog directly in Docker Desktop.
- Zero manual setup: No dependency management, runtime configuration, or setup required.
- Profile-based organization: Create separate server collections for different projects or environments.
- Organizes MCP servers into profiles, acting as a gateway for clients to access the servers in each profile.

> [!TIP]
> The MCP Toolkit includes [Dynamic MCP](/desktop/features/mcp-catalog-and-toolkit/dynamic-mcp/),
> which enables AI agents to discover, add, and compose MCP servers on-demand during
> conversations, without manual configuration. Your agent can search the catalog and
> add tools as needed when you connect to the gateway.

## How the MCP Toolkit works

MCP introduces two core concepts: MCP clients and MCP servers.

- MCP clients are typically embedded in LLM-based applications, such as the
  Claude Desktop app. They request resources or actions.
- MCP servers are launched by the client to perform the requested tasks, using
  any necessary tools, languages, or processes.

Docker standardizes the development, packaging, and distribution of
applications, including MCP servers. By packaging MCP servers as containers,
Docker eliminates issues related to isolation and environment differences. You
can run a container directly, without managing dependencies or configuring
runtimes.

Depending on the MCP server, the tools it provides might run within the same
container as the server or in dedicated containers for better isolation.

The MCP Toolkit organizes servers into profiles: named collections of servers
with their configurations. This lets you maintain different server setups for
different projects or environments. When you connect a client, you specify
which profile it should use.

## Security

The Docker MCP Toolkit combines passive and active measures to reduce attack
surfaces and ensure safe runtime behavior.

### Passive security

Passive security refers to measures implemented at build-time, when the MCP
server code is packaged into a Docker image.

- Image signing and attestation: All MCP server images under `mcp/` in the [MCP
  Catalog](/ai/mcp-catalog-and-toolkit/toolkit/catalog/) are built by Docker and digitally signed to verify their
  source and integrity. Each image includes a Software Bill of Materials (SBOM)
  for full transparency.

### Active security

Active security refers to security measures at runtime, before and after tools
are invoked, enforced through resource and access limitations.

- CPU allocation: MCP tools are run in their own container. They are
  restricted to 1 CPU, limiting the impact of potential misuse of computing
  resources.

- Memory allocation: Containers for MCP tools are limited to 2 GB.

- Filesystem access: By default, MCP Servers have no access to the host filesystem.
  The user explicitly selects the servers that will be granted file mounts.

- Interception of tool requests: Requests to and from tools that contain sensitive
  information such as secrets are blocked.

### OAuth authentication

Some MCP servers require authentication to access external services like
GitHub, Notion, and Linear. The MCP Toolkit handles OAuth authentication
automatically. You authorize access through your browser, and the Toolkit
manages credentials securely. You don't need to manually create API tokens or
configure authentication for each service.

#### Authorize a server with OAuth

1. In Docker Desktop, go to **MCP Toolkit** and select the **Catalog** tab.
2. Find and add an MCP server that requires OAuth.
3. In the server's **Configuration** tab, select the **OAuth** authentication
   method. Follow the link to begin the OAuth authorization.
4. Your browser opens the authorization page for the service. Follow the
   on-screen instructions to complete authentication.
5. Return to Docker Desktop when authentication is complete.

View all authorized services in the **OAuth** tab. To revoke access, select
**Revoke** next to the service you want to disconnect.

## Usage examples

### Example: Use Claude Desktop as a client

Imagine you have Claude Desktop installed, and you want to use the GitHub MCP
server and the Puppeteer MCP server. You do not have to install the servers in
Claude Desktop. You can add these 2 MCP servers to your profile in the MCP
Toolkit and connect Claude Desktop as a client:

1. From the **MCP Toolkit** menu, select the **Catalog** tab and find the **Puppeteer** server and add it to your profile.
1. Repeat for the **GitHub Official** server.
1. From the **Clients** tab, select **Connect** next to **Claude Desktop**. Restart
   Claude Desktop if it's running, and it can now access all the servers in the MCP Toolkit.
1. Within Claude Desktop, run a test by submitting the following prompt using the Sonnet 3.5 model:

   ```text
   Take a screenshot of docs.docker.com and then invert the colors
   ```

### Example: Use Visual Studio Code as a client

You can interact with all your installed MCP servers in Visual Studio Code:

1. To enable the MCP Toolkit:

   **Enable globally**


   1. Insert the following in your Visual Studio Code's User `mcp.json`:

      ```json
      "mcp": {
       "servers": {
         "MCP_DOCKER": {
           "command": "docker",
           "args": [
             "mcp",
             "gateway",
             "run",
             "--profile",
             "my_profile"
           ],
           "type": "stdio"
         }
       }
      }
      ```

   **Enable for a given project**


   1. In your terminal, navigate to your project's folder.
   1. Run:

      ```bash
      docker mcp client connect vscode --profile my_profile
      ```

      > [!NOTE]
      > This command creates a `.vscode/mcp.json` file in the current directory
      > that connects VSCode to your profile. As this is a user-specific file,
      > add it to your `.gitignore` file to prevent it from being committed to
      > the repository.
      >
      > ```console
      > echo ".vscode/mcp.json" >> .gitignore
      > ```



1. In Visual Studio Code, open a new Chat and select the **Agent** mode:

   ![Copilot mode switching](/ai/mcp-catalog-and-toolkit/toolkit/images/copilot-mode.png)

1. You can also check the available MCP tools:

   ![Displaying tools in VSCode](/ai/mcp-catalog-and-toolkit/toolkit/images/tools.png)

For more information about the Agent mode, see the
[Visual Studio Code documentation](https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_use-mcp-tools-in-agent-mode).

## Further reading

- [Use MCP Toolkit from the CLI](/desktop/features/mcp-catalog-and-toolkit/cli/)
- [MCP Catalog](/desktop/features/mcp-catalog-and-toolkit/catalog/)
- [MCP Gateway](/desktop/features/mcp-catalog-and-toolkit/mcp-gateway/)

