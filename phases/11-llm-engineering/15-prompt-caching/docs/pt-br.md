# Prompt Caching e Context Caching

> Seu system prompt tem 4.000 tokens. Seu contexto RAG tem 20.000 tokens. Você envia ambos em toda requisição. E paga por ambos — toda vez. Prompt caching permite que o provedor mantenha esse prefixo quente do lado deles e cobre 10% da taxa normal na reutilização. Usado corretamente, reduz custo de inferência em 50-90% e latência de primeiro token em 40-85%.

**Tipo:** Construção
**Linguagens:** Python
**Pré-requisitos:** Fase 11 · 01 (Prompt Engineering), Fase 11 · 05 (Context Engineering), Fase 11 · 11 (Caching and Cost)
**Tempo:** ~60 minutos

## O Problema

Um coding agent envia o mesmo system prompt de 15.000 tokens ao Claude em cada turno de uma conversa. Vinte turnos a $3/M tokens de entrada = $0,90 só de custo de entrada — antes de qualquer mensagem real do usuário. Multiplique por 10.000 conversas diárias e a conta chega a $9.000/dia para texto que nunca muda.

## O Conceito

### O Mecanismo

Quando o prefixo de uma requisição bate com uma requisição recente, o provedor serve o KV-cache da execução anterior em vez de re-encodar os tokens. Você paga um pequeno premium de escrita na primeira vez e um grande desconto de leitura todas as vezes seguintes.

### Três Estilos de Provedor em 2026

| Provedor | Estilo API | Desconto em hit | Premium de write | TTL padrão | Mínimo cacheável |
|----------|-----------|-----------------|-------------------|------------|-------------------|
| Anthropic | Marcadores `cache_control` explícitos | 90% off entrada | 25% extra | 5 min (extensível 1h) | 1.024 tokens |
| OpenAI | Detecção de prefixo automática | 50% off entrada | nenhum | Até 1 hora | 1.024 tokens |
| Google Gemini | API `CachedContent` explícita | ~25% da taxa normal | Taxa de storage | Configurável | 4.096 tokens |

### O Invariante

Todos os três fazem cache apenas de prefixos. Se qualquer token difere entre requisições, tudo após o primeiro token diferente é miss. Coloque as partes *estáveis* no topo, as *variáveis* no fundo.

### Layout Amigável a Cache

```
[system prompt]          <-- cache aqui
[definições de tools]    <-- cache aqui
[exemplos few-shot]      <-- cache aqui
[documentos recuperados] <-- cache se reutilizado, senão não
[histórico da conversa]  <-- cache até o último turno
[mensagem atual do user] <-- nunca cache (diferente toda vez)
```

### Cálculo Break-Even

O premium de 25% de escrita do Anthropic significa que um bloco cacheado precisa ser lido pelo menos 2 vezes para economizar. 1 write + 10 reads = 80% de economia. Regra geral: cache tudo que espera reutilizar pelo menos 3 vezes dentro do TTL.

## Build It

### Passo 1: Anthropic Prompt Caching

```python
import anthropic

client = anthropic.Anthropic()

SYSTEM = [
    {
        "type": "text",
        "text": "Você é um revisor sênior de Python. Siga a rubrica exatamente.\n\n" + RUBRIC_15K_TOKENS,
        "cache_control": {"type": "ephemeral"},
    }
]

def review(code: str):
    return client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        system=SYSTEM,
        messages=[{"role": "user", "content": code}],
    )
```

O marcador `cache_control` diz ao Anthropic para armazenar o bloco por 5 minutos. Reutilização na janela = hit; após expira = reescreve.

**Campos de usage na resposta:**

```python
response = review(code_a)
# cache_creation_input_tokens=15023   # pago a 1.25x
# cache_read_input_tokens=0

response_b = review(code_b)
# cache_creation_input_tokens=0
# cache_read_input_tokens=15023           # pago a 0.1x
```

### Passo 2: TTL Estendido de 1 Hora

```python
{"type": "text", "text": RUBRIC, "cache_control": {"type": "ephemeral", "ttl": "1h"}}
```

1h de TTL custa 2x o premium de escrita (50% em vez de 25%) mas se paga rápido em qualquer batch que reutiliza o prefixo mais de 5 vezes.

### Passo 3: OpenAI Cache Automática

```python
from openai import OpenAI
client = OpenAI()

resp = client.chat.completions.create(
    model="gpt-5",
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},   # longo e estável
        {"role": "user", "content": user_msg},
    ],
)
resp.usage.prompt_tokens_details.cached_tokens  # a porção com desconto
```

Qualquer prefixo de 1.024+ tokens que bate com requisição recente ganha 50% de desconto automaticamente. Sem mudança de código.

### Passo 4: Gemini Context Caching

```python
from google import genai
from google.genai import types

client = genai.Client()

cache = client.caches.create(
    model="gemini-3-pro",
    config=types.CreateCachedContentConfig(
        display_name="rubric-v3",
        system_instruction=RUBRIC,
        contents=[FEW_SHOT_EXAMPLES],
        ttl="3600s",
    ),
)

resp = client.models.generate_content(
    model="gemini-3-pro",
    contents=["Revise este código:\n" + code],
    config=types.GenerateContentConfig(cached_content=cache.name),
)
```

Cobra storage por token·hora enquanto o cache vive, e lê a ~25% da taxa normal de entrada.

## Use

| Situação | Escolha |
|----------|---------|
| Agent com system prompt estável 10k+, muitos turnos | Anthropic `cache_control` com TTL 5min |
| Batch job reutilizando prefixo 30+ minutos | Anthropic com `ttl: "1h"` |
| Serverless no GPT-5, sem infra custom | OpenAI automático |
| Reutilização multi-dia de corpus grande | Gemini `CachedContent` explícito |
| Fallback cross-provider | Layout de prefixo cacheável idêntico entre provedores |

Combine com cache semântico (Fase 11 · 11) para a camada de mensagem do usuário: prompt caching lida com reutilização *token-idêntica*, cache semântico lida com reutilização *meaning-idêntica*.

## Entregue

- `outputs/skill-prompt-caching-planner.md` — skill para projetar layout de prompt amigável a cache e escolher o modo certo de cache de provedor

## Exercícios

1. **Fácil**: Rode uma conversa de 10 turnos com system prompt de 5.000 tokens contra Claude. Sem `cache_control` e depois com. Reporte o custo de tokens de entrada de cada.

2. **Médio**: Escreva um test harness que, dado um template de prompt e um log de requisições, calcula a taxa de hit esperada e economia em dólar por provedor.

3. **Difícil**: Construa um otimizador de layout: dado um prompt e campos marcados `stable=True/False`, reescreva o prompt colocando um breakpoint de cache na posição máxima amigável sem perder informação.

## Termos-Chave

| Termo | O que o pessoal diz | O que realmente significa |
|-------|--------------------|-----------------------|
| Prompt caching | "Torna prompts longos baratos" | Reutilizar KV-cache do lado do provedor para prefixos correspondentes |
| `cache_control` | "O marcador Anthropic" | Atributo de content-block que declara "tudo até aqui é cacheável" |
| Cache write | "Pagando o premium" | Primeira requisição que popula o cache |
| Cache read | "O desconto" | Requisições seguintes que batem no prefixo |
| TTL | "Quanto tempo vive" | Segundos que o cache fica quente |
| Extended TTL | "Cache de 1 hora Anthropic" | TTL de 1h com 2x premium de escrita |
| Prefix match | "Por que meu cache errou" | Caches só batem quando cada token desde o início é byte-idêntico |

## Leitura Adicional

- [Anthropic — Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — `cache_control`, TTL 1h, tabelas break-even
- [OpenAI — Prompt caching](https://platform.openai.com/docs/guides/prompt-caching) — detecção automática de prefixo
- [Google — Context caching](https://ai.google.dev/gemini-api/docs/caching) — API `CachedContent` e pricing de storage
- [Anthropic engineering — Prompt caching for long-context workloads](https://www.anthropic.com/news/prompt-caching) — post original com números de latência
