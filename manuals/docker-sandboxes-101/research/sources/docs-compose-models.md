<!-- vendored source: Compose models and provider services docs; origin /ai/compose/models-and-compose/, /reference/compose-file/models/, /compose/how-tos/provider-services/; fetched 2026-10-08; each page is the raw markdown served at the page URL with .md appended; page text is verbatim, only the page marker lines are added -->

<!-- page: https://docs.docker.com/ai/compose/models-and-compose/ fetched 2026-10-08 -->

# Define AI Models in Docker Compose applications




Compose lets you define AI models as core components of your application, so you can declare model dependencies alongside services and run the application on any platform that supports the Compose Specification.

## Prerequisites

- Docker Compose v2.38 or later
- A platform that supports Compose models such as [Docker Model Runner (DMR)](/ai/model-runner/#requirements).

## What are Compose models?

Compose `models` are a standardized way to define AI model dependencies in your application. By using the [`models` top-level element](/reference/compose-file/models/) in your Compose file, you can:

- Declare which AI models your application needs
- Specify model configurations and requirements
- Make your application portable across different platforms
- Let the platform handle model provisioning and lifecycle management

## Basic model definition

To define models in your Compose application, use the `models` top-level element:

```yaml
services:
  chat-app:
    image: my-chat-app
    models:
      - llm

models:
  llm:
    model: ai/smollm2
```

This example defines:
- A service called `chat-app` that uses a model named `llm`
- A model definition for `llm` that references the `ai/smollm2` model image

## Model configuration options

Models support various configuration options:

```yaml
models:
  llm:
    model: ai/smollm2
    context_size: 1024
    runtime_flags:
      - "--a-flag"
      - "--another-flag=42"
```

Common configuration options include:
- `model` (required): The OCI artifact identifier for the model. This is what Compose pulls and runs via the model runner.
- `context_size`: Defines the maximum token context size for the model.

   > [!NOTE]
   > Each model has its own maximum context size. When increasing the context length,
   > consider your hardware constraints. In general, try to keep context size
   > as small as feasible for your specific needs.

- `runtime_flags`: A list of raw command-line flags passed to the inference engine when the model is started.
   See [Configuration options](/ai/model-runner/configuration/) for commonly used parameters and examples.
- Platform-specific options may also be available via extension attributes `x-*`

> [!TIP]
> See more example in the [Common runtime configurations](#common-runtime-configurations) section.

## Service model binding

Services can reference models in two ways: short syntax and long syntax.

### Short syntax

The short syntax is the simplest way to bind a model to a service:

```yaml
services:
  app:
    image: my-app
    models:
      - llm
      - embedding-model

models:
  llm:
    model: ai/smollm2
  embedding-model:
    model: ai/all-minilm
```

With short syntax, the platform automatically generates environment variables based on the model name:
- `LLM_URL` - URL to access the LLM model
- `LLM_MODEL` - Model identifier for the LLM model
- `EMBEDDING_MODEL_URL` - URL to access the embedding-model
- `EMBEDDING_MODEL_MODEL` - Model identifier for the embedding-model

### Long syntax

The long syntax allows you to customize environment variable names:

```yaml
services:
  app:
    image: my-app
    models:
      llm:
        endpoint_var: AI_MODEL_URL
        model_var: AI_MODEL_NAME
      embedding-model:
        endpoint_var: EMBEDDING_URL
        model_var: EMBEDDING_NAME

models:
  llm:
    model: ai/smollm2
  embedding-model:
    model: ai/all-minilm
```

With this configuration, your service receives:
- `AI_MODEL_URL` and `AI_MODEL_NAME` for the LLM model
- `EMBEDDING_URL` and `EMBEDDING_NAME` for the embedding model

## Platform portability

One of the key benefits of using Compose models is portability across different platforms that support the Compose specification.

### Docker Model Runner

When [Docker Model Runner is enabled](/ai/model-runner/):

```yaml
services:
  chat-app:
    image: my-chat-app
    models:
      llm:
        endpoint_var: AI_MODEL_URL
        model_var: AI_MODEL_NAME

models:
  llm:
    model: ai/smollm2
    context_size: 4096
    runtime_flags:
      - "--no-prefill-assistant"
```

Docker Model Runner will:
- Pull and run the specified model locally
- Provide endpoint URLs for accessing the model
- Inject environment variables into the service

### Cloud providers

The Compose models specification is portable. Platforms that implement the Compose specification can support the `models` top-level element, allowing the same Compose file to run on different infrastructure. Cloud-specific behavior can be configured using extension attributes (`x-*`):

```yaml
services:
  chat-app:
    image: my-chat-app
    models:
      - llm

models:
  llm:
    model: ai/smollm2
    # Cloud-specific configurations
    x-cloud-options:
      - "cloud.instance-type=gpu-small"
      - "cloud.region=us-west-2"
```

How a platform handles model definitions depends on its implementation. A platform might:

- Use managed AI services instead of running models locally
- Apply platform-specific optimizations and scaling
- Provide additional monitoring and logging capabilities
- Handle model versioning and updates automatically

## Common runtime configurations

Below are some example configurations for various use cases.

### Development

```yaml
services:
  app:
    image: app
    models:
      dev_model:
        endpoint_var: DEV_URL
        model_var: DEV_MODEL

models:
  dev_model:
    model: ai/model
    context_size: 4096
    runtime_flags:
      - "--verbose"                       # Set verbosity level to infinity
      - "--verbose-prompt"                # Print a verbose prompt before generation
      - "--log-prefix"                    # Enable prefix in log messages
      - "--log-timestamps"                # Enable timestamps in log messages
      - "--log-colors"                    # Enable colored logging
```

### Conservative with disabled reasoning

```yaml
services:
  app:
    image: app
    models:
      conservative_model:
        endpoint_var: CONSERVATIVE_URL
        model_var: CONSERVATIVE_MODEL

models:
  conservative_model:
    model: ai/model
    context_size: 4096
    runtime_flags:
      - "--temp"                # Temperature
      - "0.1"
      - "--top-k"               # Top-k sampling
      - "1"
      - "--reasoning-budget"    # Disable reasoning
      - "0"
```

### Creative with high randomness

```yaml
services:
  app:
    image: app
    models:
      creative_model:
        endpoint_var: CREATIVE_URL
        model_var: CREATIVE_MODEL

models:
  creative_model:
    model: ai/model
    context_size: 4096
    runtime_flags:
      - "--temp"                # Temperature
      - "1"
      - "--top-p"               # Top-p sampling
      - "0.9"
```

### Highly deterministic

```yaml
services:
  app:
    image: app
    models:
      deterministic_model:
        endpoint_var: DET_URL
        model_var: DET_MODEL

models:
  deterministic_model:
    model: ai/model
    context_size: 4096
    runtime_flags:
      - "--temp"                # Temperature
      - "0"
      - "--top-k"               # Top-k sampling
      - "1"
```

### Concurrent processing

```yaml
services:
  app:
    image: app
    models:
      concurrent_model:
        endpoint_var: CONCURRENT_URL
        model_var: CONCURRENT_MODEL

models:
  concurrent_model:
    model: ai/model
    context_size: 2048
    runtime_flags:
      - "--threads"             # Number of threads to use during generation
      - "8"
      - "--mlock"               # Lock memory to prevent swapping
```

### Rich vocabulary model

```yaml
services:
  app:
    image: app
    models:
      rich_vocab_model:
        endpoint_var: RICH_VOCAB_URL
        model_var: RICH_VOCAB_MODEL

models:
  rich_vocab_model:
    model: ai/model
    context_size: 4096
    runtime_flags:
      - "--temp"                # Temperature
      - "0.1"
      - "--top-p"               # Top-p sampling
      - "0.9"
```

### Embeddings

When using embedding models with the `/v1/embeddings` endpoint, you must include the `--embeddings` runtime flag for the model to be properly configured.

```yaml
services:
  app:
    image: app
    models:
      embedding_model:
        endpoint_var: EMBEDDING_URL
        model_var: EMBEDDING_MODEL

models:
  embedding_model:
    model: ai/all-minilm
    context_size: 2048
    runtime_flags:
      - "--embeddings"          # Required for embedding models
```

## Reference

- [`models` top-level element](/reference/compose-file/models/)
- [`models` attribute](/reference/compose-file/services/#models)
- [Docker Model Runner documentation](/ai/model-runner/)
- [Configuration options](/ai/model-runner/configuration/) - Context size and runtime parameters
- [Inference engines](/ai/model-runner/inference-engines/) - llama.cpp and vLLM details
- [API reference](/ai/model-runner/api-reference/) - OpenAI and Ollama-compatible APIs

<!-- page: https://docs.docker.com/reference/compose-file/models/ fetched 2026-10-08 -->

# Models




The top-level `models` section declares AI models that are used by your Compose application. These models are typically pulled as OCI artifacts, run by a model runner, and exposed as an API that your service containers can consume.

Services can only access models when explicitly granted by a [`models` attribute](/reference/compose-file/models/services/#models) within the `services` top-level element.

## Examples

### Example 1

```yaml
services:
  app:
    image: app
    models:
      - ai_model


models:
  ai_model:
    model: ai/model
```

In this basic example:

 - The app service uses the `ai_model`.
 - The `ai_model` is defined as an OCI artifact (`ai/model`) that is pulled and served by the model runner.
 - Docker Compose injects connection info, for example `AI_MODEL_URL`, into the container. 

### Example 2

```yaml
services:
  app:
    image: app
    models:
      my_model:
        endpoint_var: MODEL_URL

models:
  my_model:
    model: ai/model
    context_size: 1024
    runtime_flags: 
      - "--a-flag"
      - "--another-flag=42"
```

In this advanced setup:

 - The service app references `my_model` using the long syntax.
 - Compose injects the model runner's URL as the environment variable `MODEL_URL`.

## Attributes

- `model` (required): The OCI artifact identifier for the model. This is what Compose pulls and runs via the model runner. 
- `context_size`: Defines the maximum token context size for the model.
- `runtime_flags`: A list of raw command-line flags passed to the inference engine when the model is started.

## Additional resources

For more examples and information on using `model`, see [Use AI models in Compose](/compose/how-tos/models-and-compose/)

<!-- page: https://docs.docker.com/compose/how-tos/provider-services/ fetched 2026-10-08 -->

# Use provider services




Docker Compose supports provider services, which allow integration with services whose lifecycles are managed by third-party components rather than by Compose itself.  
This feature enables you to define and utilize platform-specific services without the need for manual setup or direct lifecycle management.

## What are provider services?

Provider services are a special type of service in Compose that represents platform capabilities rather than containers.
They allow you to declare dependencies on specific platform features that your application needs.

When you define a provider service in your Compose file, Compose works with the platform to provision and configure
the requested capability, making it available to your application services.

## Using provider services

To use a provider service in your Compose file, you need to:

1. Define a service with the `provider` attribute
2. Specify the `type` of provider you want to use
3. Configure any provider-specific options
4. Declare dependencies from your application services to the provider service

Here's a basic example:

```yaml
services:
  database:
    provider:
      type: awesomecloud
      options:
        type: mysql
        foo: bar  
  app:
    image: myapp 
    depends_on:
       - database
```

Notice the dedicated `provider` attribute in the `database` service.
This attribute specifies that the service is managed by a provider and lets you define options specific to that provider type.

The `depends_on` attribute in the `app` service specifies that it depends on the `database` service.
This means that the `database` service will be started before the `app` service, allowing the provider information
to be injected into the `app` service.

## How it works

During the `docker compose up` command execution, Compose identifies services relying on providers and works with them to provision
the requested capabilities. The provider then populates Compose model with information about how to access the provisioned resource.

This information is passed to services that declare a dependency on the provider service, typically through environment
variables. The naming convention for these variables is:

```env
<<PROVIDER_SERVICE_NAME>>_<<VARIABLE_NAME>>
```

For example, if your provider service is named `database`, your application service might receive environment variables like:

- `DATABASE_URL` with the URL to access the provisioned resource
- `DATABASE_TOKEN` with an authentication token
- Other provider-specific variables

Your application can then use these environment variables to interact with the provisioned resource.

## Provider types

The `type` field in a provider service references the name of either:

1. A Docker CLI plugin (e.g., `docker-model`)
2. A binary available in the user's PATH
3. A path to the binary or script to execute

When Compose encounters a provider service, it looks for a plugin or binary with the specified name to handle the provisioning of the requested capability.

For example, if you specify `type: model`, Compose will look for a Docker CLI plugin named `docker-model` or a binary named `model` in the PATH.

```yaml
services:
  ai-runner:
    provider:
      type: model  # Looks for docker-model plugin or model binary
      options:
        model: ai/example-model
```

The plugin or binary is responsible for:

1. Interpreting the options provided in the provider service
2. Provisioning the requested capability
3. Returning information about how to access the provisioned resource

This information is then passed to dependent services as environment variables.

> [!TIP]
>
> If you're working with AI models in Compose, use the [`models` top-level element](/compose/how-tos/models-and-compose/) instead.

## Benefits of using provider services

Using provider services in your Compose applications offers several benefits:

1. Simplified configuration: You don't need to manually configure and manage platform capabilities
2. Declarative approach: You can declare all your application's dependencies in one place
3. Consistent workflow: You use the same Compose commands to manage your entire application, including platform capabilities

## Creating your own provider

If you want to create your own provider to extend Compose with custom capabilities, you can implement a Compose plugin that registers provider types.

For detailed information on how to create and implement your own provider, refer to the [Compose Extensions documentation](https://github.com/docker/compose/blob/main/docs/extension.md).   
This guide explains the extension mechanism that allows you to add new provider types to Compose.

## Reference

- [Docker Model Runner documentation](/ai/model-runner/)
- [Compose Extensions documentation](https://github.com/docker/compose/blob/main/docs/extension.md)

