# Docker MCP Plugin and Docker MCP Gateway

![build](https://github.com/docker/mcp-gateway/actions/workflows/ci.yml/badge.svg)

The [MCP Toolkit](https://docs.docker.com/ai/mcp-catalog-and-toolkit/toolkit/), in Docker Desktop, allows
developers to configure and consume MCP servers from the [Docker MCP Catalog](https://hub.docker.com/mcp).

Underneath, the Toolkit is powered by a docker CLI plugin: `docker-mcp`. This repository is the code of this CLI plugin. It can work in Docker Desktop or independently.

The main feature of this CLI is the **Docker MCP Gateway** which allows easy and secure running and deployment of MCP servers. See [Features](#Features) for a list of all the features.

## What is MCP?

The [Model Context Protocol (MCP)](https://spec.modelcontextprotocol.io/) is an open protocol that standardizes how AI applications connect to external data sources and tools. It provides a secure, controlled way for language models to access and interact with various services, databases, and APIs.

## Overview

Developers face criticial barriers when integrating Model Context Protocol (MCP) tools into production workflows:

- **Managing MCP server lifecycle** Each local MCP sever in the catalog runs in an isolated Docker container. npx and uvx servers are granted minimal host privileges.
- **Providing a unified interface** AI models access MCP servers through a single Gateway.
- **Handling authentication and security** Keep secrets out of environment variables using Docker Desktop's secrets management.
- **Supports dynamic tool discovery** and configuration. Each MCP client (eg VS Code, Cursor, Claude Desktop, etc.) connects to the same Gateway configuration, ensuring consistency across different clients.
- **Enables OAuth flows** for MCPs that require OAuth access token service connections.

## Features

- 🐳 **Container-based Servers**: Run MCP servers as Docker containers with proper isolation.
- 🔧 **Server Management**: List, inspect, and call MCP tools, resources and prompts from multiple servers.
- 🔐 **Secrets Management**: Secure handling of API keys and credentials via Docker Desktop.
- 🌐 **OAuth Integration**: Built-in OAuth flows for service authentication.
- 📋 **Server Catalog**: Manage and configure multiple MCP catalogs.
- 🔍 **Dynamic Discovery**: Automatic tool, prompt, and resource discovery from running servers.
- 📊 **Monitoring**: Built-in logging and call tracing capabilities.

## Installation

### Prerequisites

- Docker Desktop `4.59+` (with MCP Toolkit feature enabled)

<div align="left">
  <img src="./img/enable_toolkit.png" width="400"/>
</div>
- Go 1.24+ (for development)

### Install as Docker CLI Plugin

The MCP cli will already be installed on recent versions of Docker Desktop but you can build and install the latest version by following these steps:

```bash
# Clone the repository
git clone https://github.com/docker/mcp-gateway.git
cd mcp-gateway
mkdir -p "$HOME/.docker/cli-plugins/"

# Build and install the plugin
make docker-mcp
```

After installation, the plugin will be available as:

```bash
docker mcp --help
```

## Usage

> [!NOTE]
> **Running without Docker Desktop Feature Flags**
>
> If you encounter "Docker Desktop is not running" errors when the Docker daemon is active, you can bypass Desktop feature checks by setting:
> ```bash
> export DOCKER_MCP_IN_CONTAINER=1
> ```
> This is useful when running in WSL2, containerized environments, or Docker CE where Desktop backend sockets are unavailable.

> [!NOTE]
> **Enabling Profiles outside Docker Desktop**
>
> Profiles are enabled automatically in Docker Desktop. If you are using the CLI independently (e.g. Docker CE, WSL2, or a containerized environment), enable the profiles feature first:
> ```bash
> docker mcp feature enable profiles
> ```

### Profile Management

Servers are organized into **profiles**. A profile groups related MCP servers together and can be connected to clients, exported, and shared via OCI registries.

Servers in a profile can reference multiple sources:
- **Catalog references**: `catalog://mcp/docker-mcp-catalog/github`
- **OCI image references**: `docker://my-server:latest`
- **MCP Registry references**: `https://registry.modelcontextprotocol.io/v0/servers/<id>`
- **Local file references**: `file://./server.yaml`

```bash
# Make sure to `docker mcp catalog pull mcp/docker-mcp-catalog` first.

# Create a new profile
docker mcp profile create --name dev-tools \
  --server catalog://mcp/docker-mcp-catalog/github

# Create a profile and connect it to a client
docker mcp profile create --name dev-tools \
  --server catalog://mcp/docker-mcp-catalog/github \
  --connect cursor

# List all profiles
docker mcp profile list

# Show profile details
docker mcp profile show <profile-id>

# Remove a profile
docker mcp profile remove <profile-id>

# Export/import profiles
docker mcp profile export <profile-id> output.yaml
docker mcp profile import input.yaml

# Push/pull profiles to OCI registries
docker mcp profile push <profile-id> <oci-reference>
docker mcp profile pull <oci-reference>
```

#### Manage servers in a profile

```bash
# List servers across all profiles
docker mcp profile server ls

# Filter servers by name or profile
docker mcp profile server ls --filter name=github
docker mcp profile server ls --filter profile=dev-tools

# Add servers to a profile
docker mcp profile server add dev-tools \
  --server catalog://mcp/docker-mcp-catalog/notion

# Remove servers from a profile
docker mcp profile server remove dev-tools github slack
```

#### Configure servers in a profile

```bash
# Set configuration values (<server-name>.<config-key>=<value>)
docker mcp profile config <profile-id> --set github.timeout=30

# Get configuration values (<server-name>.<config-key>)
docker mcp profile config <profile-id> --get github.timeout

# Get all configuration
docker mcp profile config <profile-id> --get-all

# Delete configuration values (<server-name>.<config-key>)
docker mcp profile config <profile-id> --del github.timeout
```

#### Manage tool allowlists in a profile

```bash
# Enable specific tools (dot notation: <server>.<tool>)
docker mcp profile tools <profile-id> --enable github.create_issue --enable github.list_repos

# Disable specific tools
docker mcp profile tools <profile-id> --disable github.search_code

# Enable/disable all tools for a server
docker mcp profile tools <profile-id> --enable-all github
docker mcp profile tools <profile-id> --disable-all github
```

### Catalog Management

Manage the OCI-based catalogs available to the MCP gateway. The [default catalog](https://hub.docker.com/mcp) is the image `mcp/docker-mcp-catalog`.

```bash
# List catalogs
docker mcp catalog ls

# Show a catalog
docker mcp catalog show <oci-reference>

# Create a catalog from server references
docker mcp catalog create myorg/catalog:latest --title "My Catalog" \
  --server catalog://mcp/docker-mcp-catalog/github \
  --server file://./my-server.yaml

# Create a catalog from an existing profile
docker mcp catalog create myorg/catalog:latest --from-profile dev-tools

# Create a catalog from the community registry
docker mcp catalog create myorg/catalog:latest \
  --from-community-registry registry.modelcontextprotocol.io

# Push/pull catalogs to OCI registries
docker mcp catalog push <oci-reference>
docker mcp catalog pull <oci-reference>

# Manage servers within a catalog
docker mcp catalog server ls <oci-reference>
docker mcp catalog server add <oci-reference> --server docker://my-server:latest
docker mcp catalog server remove <oci-reference> github
docker mcp catalog server inspect <oci-reference> <server-name>

# Remove a catalog
docker mcp catalog remove <oci-reference>

# Tag a catalog
docker mcp catalog tag <source>:<tag> <target>:<tag>
```


More about [importing from the OSS MCP Community Registry](docs/catalog.md#importing-from-the-oss-mcp-community-registry).

### MCP Gateway Operations

Start up an MCP Gateway. This can be used for one client, or to service multiple clients if using either `sse` or `streaming` transports.

```bash
# Run the MCP gateway (stdio, using the default profile)
docker mcp gateway run

# Run with a specific profile
docker mcp gateway run --profile dev-tools

# Run the MCP gateway (streaming)
docker mcp gateway run --port 8080 --transport streaming
```

If no `--profile` flag is provided, the gateway uses the `default` profile.

* more about [the MCP Gateway](docs/mcp-gateway.md)

### Client Connection

Connect AI clients to the MCP gateway.

```bash
# List client configurations
docker mcp client ls

# Connect a client to a profile
docker mcp client connect <client-name> --profile <profile-id>

# Disconnect from a client
docker mcp client disconnect <client-name>
```

### Secrets and OAuth

Configure MCP servers that require either secrets or OAuth.

```bash
# Manage secrets
docker mcp secret --help

# Handle OAuth flows
docker mcp oauth --help

# export any desktop secrets needed by either server1 or server2
#   (temporary requirement to export secrets for docker cloud runs - this command
#    will no longer be required once Docker Cloud can access secret stores)
docker mcp secret export server1 server2
```

### Tool Management

```bash
# Count available tools
docker mcp tools count

# List all available MCP tools
docker mcp tools ls

# List all available MCP tools in JSON format
docker mcp tools ls --format=json

# Inspect a specific tool
docker mcp tools inspect <tool-name>

# Call a tool with arguments
docker mcp tools call <tool-name> [arguments...]

# Enable/disable tools for a server in a profile
docker mcp profile tools <profile-id> --enable <server>.<tool>
docker mcp profile tools <profile-id> --disable <server>.<tool>
```

## Configuration

Configuration is stored in a local database. Profiles, catalogs, and server configuration are managed through the `docker mcp profile` and `docker mcp catalog` commands. Feature flags are stored in `~/.docker/config.json`.

### Environment Variables

The MCP CLI respects the following environment variables for client configuration:

- **`CLAUDE_CONFIG_DIR`**: Override the default Claude Code configuration directory (`~/.claude`). When set, Claude Code will use `$CLAUDE_CONFIG_DIR/.claude.json` instead of `~/.claude.json` for its MCP server configuration. This is useful for:
  - Maintaining separate Claude Code installations for work and personal use
  - Testing configuration changes in isolation
  - Managing multiple Claude Code profiles

Example usage:
```bash
# Set custom Claude Code configuration directory
export CLAUDE_CONFIG_DIR=/path/to/custom/config

# Connect MCP Gateway to Claude Code
docker mcp client connect claude-code --profile dev-tools --global

# Claude Code will now use /path/to/custom/config/.claude.json
```

## Architecture

The Docker MCP CLI implements a gateway pattern:

```
AI Client → MCP Gateway → MCP Servers (Docker Containers)
```

- **AI Client**: Language model or AI application
- **MCP Gateway**: This CLI tool managing protocol translation and routing
- **MCP Servers**: Individual MCP servers running in Docker containers

See [docs/message-flow.md](docs/message-flow.md) for detailed message flow diagrams.

## Contributing

The build instructions are available in the [contribution guide](CONTRIBUTING.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 💬 [Troubleshooting](/docs/troubleshooting.md)
- 📖 [MCP Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- 🐳 [Docker Desktop Documentation](https://docs.docker.com/desktop/)
- 🐛 [Report Issues](https://github.com/docker/mcp-gateway/issues)
- 💬 [Discussions](https://github.com/docker/mcp-gateway/discussions)
