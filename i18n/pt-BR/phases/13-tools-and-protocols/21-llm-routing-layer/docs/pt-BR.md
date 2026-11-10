# LLM Routing Layer  LiteLLM, OpenRouter, Portkey

> A ficha de serviço é cara. Diferentes cargas de trabalho para chamar ferramentas correspondem a diferentes modelos. Os gateways de roteamento fornecem uma superfície de API, retestes, falhas, rastreamento de custos e barris. Três arquétipos dominam 2026: LiteLLM (self-hosted open source), OpenRouter (managed SaaS), Portkey (producção-grado, open-source em março de 2026). Esta lição nomeia os critérios de decisão e passa por um gateway de roteamento de STDlib.

**Type:** Learn
**Languages:** Python (stdlib, routing + failover + cost tracker), TypeScript
**Prerequisites:** Phase 13 · 02 (function calling), Phase 13 · 17 (gateways)
**Time:** ~45 minutes

## Objetivos de aprendizagem

- Distinguir as opções de roteamento auto-hospedadas, gerenciadas e de nível de produção.
- Implementar uma cadeia de retrocesso que reteste as falhas dos fornecedores em uma ordem de prioridade definida.
- Seguir os custos por pedido e o uso de tokens entre os provedores.
- Decidir entre LiteLLM, OpenRouter e Portkey para uma determinada restrição de produção.

## O problema

Cenários em que o encaminhamento do prestador é importante:

1. **Cost.**Claude Sonnet custa 3 vezes mais do que o Haiku, para uma tarefa de triagem, o Haiku é suficiente, para uma tarefa de síntese, o Sonnet vale a pena.

2. **Failover.**A OpenAI tem uma hora ruim, todas as solicitações falham, queres voltar automaticamente para a Anthropic sem redeploying.

3. **Latency.**Uma interface de chat ao vivo precisa de um time-to-first-token rápido.

4. **Compliance.**Os utilizadores da UE devem permanecer nas regiões da UE.

5. **Experimentation.**A/B dois modelos na mesma carga de trabalho, rota por balde de teste.

A codificação manual de tudo isso por integração é repetitiva. Um gateway de roteamento dá uma API compatível com o OpenAI e lida com o resto.

## O conceito

### Forma de proxy compatível com o OpenAI

Todos falam OpenAI, o gateway de roteamento expõe.`/v1/chat/completions`, aceita o esquema OpenAI, e interamente proxies para Anthropic / Gemini / Cohere / Ollama / qualquer coisa.

### Nome de modelo

Em vez de um ID de instantâneo fichado, o seu código diz:`our_smart_model`Quando um provedor envia uma nova geração, você muda o alias do lado do servidor; o seu código não toca nada.

### Cadeias de retorno

```
primary: openai/gpt-4o
on 5xx: anthropic/claude-3-5-sonnet
on 5xx: google/gemini-1.5-pro
on 5xx: refuse
```

Os gateways definem isto em uma configuração.

### Caching semântico

As instruções idênticas ou quase idênticas atingem um cache em vez do provedor. A economia em loopes de agente repetidas pode ser de 30 a 60 por cento. As chaves são baseadas em incorporação; instruções quase idênticas compartilham um espaço de cache.

### Ferras de guarda

Nível de entrada:

- **PII redaction.**Passar com Regex ou baseado em ML antes de enviar as instruções.
- **Policy violations.**Rejeita instruções com conteúdo proibido.
- **Output filters.**Esfregar as conclusões para vazamentos.

Portkey e Kong têm ambos os barris de guarda.

### Limite de taxa por chave

Uma chave API = uma equipe. Orçamentos por chave impedem uma equipe de consumir a quota compartilhada.

### Comércio de compensações auto-hosted versus administrados

| Factor | LiteLLM (self-hosted) | OpenRouter (managed) | Portkey (production) |
|--------|----------------------|----------------------|----------------------|
| Code | Open source, Python | Managed SaaS | Open source (Mar 2026) + managed |
| Setup | Deploy a proxy | Sign up | Either |
| Providers | 100+ | 300+ | 100+ |
| Billing | Your own keys | OpenRouter credits | Your own keys |
| Observability | OpenTelemetry | Dashboard | Full OTel + PII redaction |
| Best for | Teams that want full control | Rapid prototyping | Production with compliance |

LiteLLM ganha quando você tem uma equipe SRE e quer soberania de dados. OpenRouter ganha quando você quer uma assinatura única e sem infra. Portkey ganha quando você precisa de proteções e conformidade fora da caixa.

### Seguimento dos custos

Cada pedido é um .`provider`- Não .`model`- Não .`input_tokens`- Não .`output_tokens`Multiplicar por preços por modelo por token (tirado de uma ficha de preços que o portal mantém).

### MCP mais roteamento

Um gateway pode encaminhar chamadas de LLM E solicitações de amostragem MCP. Quando o modelo de um pedido de amostragemPreferências preferem um modelo específico, o gateway se traduz para o backend direito. É aqui que a Fase 13 · 17 (gateway MCP) e o gateway de roteamento desta lição às vezes se fundem em um serviço.

### Estratégias de roteamento

- **Static priority.**Primeiro na lista, volte ao erro.
- **Load balancing.**- Round-robin ou ponderado.
- **Cost-aware.**Escolha o modelo mais barato para atender a latência / qualidade.
- **Latency-aware.**Escolha o modelo mais rápido nos últimos N minutos.
- **Task-aware.**Rutas de classificação rápida codificando para um modelo, resumindo para outro.

```figure
tp-router-failover
```

## Usá-lo

`code/main.py`implementa um gateway de roteamento em ~ 150 linhas: aceita solicitações em forma de OpenAI, traduz para estubes por fornecedor, executa uma cadeia de fallback prioritária, acompanha o custo por solicitação e aplica um pass de redação de PII em entradas.

O que ver:

- `ROUTES`dict: alias -> lista de fornecedores concretos ordenada por prioridade.
- Voltar a tentar no 5xx.
- O rastreador de custos multiplica o uso de tokens por taxas por modelo.
- O redator de PII limpa os padrões em forma de SSN antes de encaminhar.

## Envia-o

Esta lição produz`outputs/skill-routing-config-designer.md`. Tendo em conta um perfil de carga de trabalho (latencia, custo, conformidade), a habilidade seleciona o LiteLLM / OpenRouter / Portkey e produz uma configuração de roteamento.

## Exercícios

1. Corra .`code/main.py`- Acionar o cenário de interrupção; confirmar que o segundo fornecedor é afectado e que o custo é atribuído corretamente.

2. Adicionar cache semântico: SHA256 do prompt é uma chave de busca; cliques no cache retornam instantaneamente.

3. Adicione um classificador de instruções que encaminhe "código ... " para um alias que favorece a inteligência e " resumir ... " para um alias que favorece a velocidade.

4. Projetar orçamentos por equipe: cada equipe tem um limite de gastos mensal; gateway recusa pedidos uma vez que o limite é atingido. Escolha uma granularidade de execução (por pedido ou em janelas).

5. Leia os documentos LiteLLM, OpenRouter e Portkey lado a lado.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Routing gateway | "LLM proxy" | One-API-surface layer in front of many providers |
| OpenAI-compatible | "Speaks the OpenAI schema" | Accepts `/v1/chat/completions` shape, translates to any backend |
| Model alias | "our_smart_model" | Name in your code that the gateway maps to a concrete model |
| Fallback chain | "Retry list" | Ordered list of providers attempted on failure |
| Semantic caching | "Prompt-embedding cache" | Key is embedding of the prompt; near-duplicates share a cache hit |
| Guardrails | "Input/output filters" | Redact PII, reject policy violations |
| Per-key rate limit | "Team budget" | Quota scoped to an API key |
| Cost tracking | "Per-request spend" | Aggregate token usage x price per model |
| LiteLLM | "The open proxy" | Self-hostable OSS routing gateway |
| OpenRouter | "The managed SaaS" | Hosted gateway with credit-based billing |
| Portkey | "The production option" | Open-source + managed with guardrails built in |

## Mais leitura

- [LiteLLM — docs](https://docs.litellm.ai/) Porta de acesso de roteamento auto-hospedada
- [OpenRouter — quickstart](https://openrouter.ai/docs/quickstart) Routing gerenciado SaaS
- [Portkey — docs](https://portkey.ai/docs) rotação de produção com barris
- [TrueFoundry — LiteLLM vs OpenRouter](https://www.truefoundry.com/blog/litellm-vs-openrouter) Guia de decisão
- [Relayplane — LLM gateway comparison 2026](https://relayplane.com/blog/llm-gateway-comparison-2026) Pesquisa de fornecedores
