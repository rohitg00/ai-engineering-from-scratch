# Cachagem rápida e Cachagem do contexto

> O seu sistema de memória é de 4.000 tokens. Seu contexto RAG é de 20.000 tokens. Você envia ambos com cada solicitação. Você também paga por ambos  toda vez. O cache rápido permite que o provedor mantenha esse prefixo quente do seu lado e lhe faça uma taxa de 10% da taxa normal em reutilização. Usado corretamente, reduz o custo de inferência em 5090% e a latência do primeiro token em 4085%.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 01 (Prompt Engineering), Phase 11 · 05 (Context Engineering), Phase 11 · 11 (Caching and Cost)
**Time:** ~60 minutes

## O problema

Um agente de codificação envia o mesmo aviso de 15 mil tokens para Claude em cada turno de uma conversa.$3/M input tokens is $Multiplica por 10.000 conversas diárias e a conta chega a US$ 9.000 por dia por texto que nunca muda.

Não se pode reduzir o pedido sem prejudicar a qualidade. Não se pode evitar enviá-lo  o modelo precisa dele em cada turno.

Essa medida é o caching rápido. A Anthropic lançou em agosto de 2024 (com uma variante de 1 hora de TTL estendida em 2025), a OpenAI automatizou-a no final desse ano, o Google lançou o caching de contexto explícito ao lado do Gemini 1.5, e os três agora oferecem como um recurso de primeira classe em seus modelos de fronteira.

## O conceito

![Prompt caching: write once, read cheap](../assets/prompt-caching.svg)

**The mechanic.**Quando o prefixo de uma solicitação coincide com um de uma solicitação recente, o provedor serve o cache KV da execução anterior em vez de recodificar os tokens.

**Three provider flavors in 2026.**

| Provider | API style | Hit discount | Write premium | Default TTL | Min cacheable |
|---------|-----------|--------------|---------------|-------------|---------------|
| Anthropic | Explicit `cache_control` markers on content blocks | 90% off input | 25% surcharge | 5 min (extendable to 1 hour) | 1,024 tokens (Sonnet/Opus), 2,048 (Haiku) |
| OpenAI | Automatic prefix detection | 50% off input | none | Up to 1 hour (best-effort) | 1,024 tokens |
| Google (Gemini) | Explicit `CachedContent` API | Storage-billed; read at ~25% of normal | Storage fee per token·hour | User-set (default 1 hour) | 4,096 tokens (Flash), 32,768 (Pro) |

**The invariant.**Os três prefixos de cache apenas. Se qualquer token diferir entre as solicitações, tudo depois do primeiro token diferente é um erro. Coloque as partes * estáveis * no topo, as partes * variáveis * na parte inferior.

### O layout de cache-friendly

```
[system prompt]          <-- cache this
[tool definitions]       <-- cache this
[few-shot examples]      <-- cache this
[retrieved documents]    <-- cache if reused, else don't
[conversation history]   <-- cache up to last turn
[current user message]   <-- never cache (different every time)
```

Viola a ordem  colocar a mensagem do usuário acima do prompt do sistema, interromper recuperações dinâmicas entre poucas fotos  e o cache nunca atinge.

### O cálculo do equilíbrio

O prêmio de escrita de 25% da Anthropic (5 minutos de TTL) paga por si mesmo na primeira leitura, porque uma leitura cache custa 0,1x. 1 escrita + 1 leitura média 0,675x custo por pedido (salva 32%); 1 escrita + 10 leituras médias 0,205x (salva 80%). O TTL de 1 hora cobra 2x para a escrita, então esse bloco precisa de duas leituras para sair à frente. Regra geral: cache qualquer coisa que você espera reutilizar pelo menos 3 vezes dentro do TTL; que limpa o equilíbrio em qualquer TTL.

```figure
prompt-cache-hit
```

## Construí-lo

### Passo 1: Cachagem de prompt antropópica com marcadores explícitos

```python
import anthropic

client = anthropic.Anthropic()

SYSTEM = [
    {
        "type": "text",
        "text": "You are a senior Python reviewer. Follow the rubric exactly.\n\n" + RUBRIC_15K_TOKENS,
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

O `cache_control`O marcador diz à Anthropic para armazenar o bloco por 5 minutos. Reutilizar dentro dessa janela acerta; reutilizar após expirar e escreve novamente.

**Response usage fields:**

```python
response = review(code_a)
response.usage
# InputTokensUsage(
#     input_tokens=120,
#     cache_creation_input_tokens=15023,   # paid at 1.25x
#     cache_read_input_tokens=0,
#     output_tokens=340,
# )

response_b = review(code_b)
response_b.usage
# cache_creation_input_tokens=0
# cache_read_input_tokens=15023           # paid at 0.1x
```

Verifique ambos os campos na CI  se `cache_read_input_tokens`mantém-se em zero em todas as solicitações, as tuas chaves de cache estão a drift.

### Passo 2: TTL prolongado por uma hora

Para os trabalhos de longa duração, o prazo de 5 minutos expirará entre os trabalhos.`ttl`- Não .

```python
{"type": "text", "text": RUBRIC, "cache_control": {"type": "ephemeral", "ttl": "1h"}}
```

O TTL de 1 hora custa o dobro da prima de escrita (50% em relação à linha de base em vez de 25%) mas retribui rapidamente em qualquer lote que reutilize o prefixo mais de 5 vezes.

### Passo 3: Caché automático OpenAI

Qualquer prefixo acima de 1.024 tokens que corresponda a uma solicitação recente recebe automaticamente um desconto de 50%.

```python
from openai import OpenAI
client = OpenAI()

resp = client.chat.completions.create(
    model="gpt-5",
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},   # long and stable
        {"role": "user", "content": user_msg},
    ],
)
resp.usage.prompt_tokens_details.cached_tokens  # the discounted portion
```

A mesma regra de layout amigável ao cache aplica-se. Duas coisas matam o cache da OpenAI que não matam o Anthropic: alterando o `user`campo (utilizado como componente de chave de cache) e ferramentas de reordenação.

### Passo 4: Gemini cache de contexto explícito

O Gemini trata o cache como um objeto de primeira classe que você cria e nomeia:

```python
from google import genai
from google.genai import types

client = genai.Client()

cache = client.caches.create(
    model="gemini-3.8-flash",
    config=types.CreateCachedContentConfig(
        display_name="rubric-v3",
        system_instruction=RUBRIC,
        contents=[FEW_SHOT_EXAMPLES],
        ttl="3600s",
    ),
)

resp = client.models.generate_content(
    model="gemini-3.8-flash",
    contents=["Review this code:\n" + code],
    config=types.GenerateContentConfig(cached_content=cache.name),
)
```

O Gemini cobra armazenamento por token·hora durante o tempo que o cache vive e lê a ~25% da taxa de entrada normal. Esta é a forma certa quando você reutiliza o mesmo prompt gigante em várias sessões ao longo de dias.

### Passo 5: medição da taxa de impacto na produção

Veja .`code/main.py`Para uma contabilidade simulada de três provedores que acompanha as contagens de escrita/leitura/malfatura e calcula o custo misturado por 1K solicitações.

## Encurralagens que ainda se lançam em 2026

- **Dynamic timestamps at the top.** `"Current time: 2026-04-22 15:30:02"`Cada pedido falha, move as marcas de tempo abaixo do ponto de ruptura do cache.
- **Tool reordering.**Serialize as ferramentas em uma ordem estável  um reorganização entre as implementações quebra cada golpe.
- **Free-text near-duplicates.**"Você é útil". vs "Você é um assistente útil".  Uma diferença de 1 byte = total falta.
- **Too-small blocks.**O Anthropic impõe um piso de 1.024 tokens (2.048 para Haiku).
- **Blind cost dashboards.**Divide "tokens de entrada" em caché versus não caché.

## Usá-lo

A pilha de armazenamento em cache de 2026:

| Situation | Pick |
|-----------|------|
| Agent with stable 10k+ system prompt, many turns | Anthropic `cache_control` with 5-min TTL |
| Batch job reusing a prefix for 30+ minutes | Anthropic with `ttl: "1h"` |
| Serverless endpoints on GPT-5, no custom infra | OpenAI automatic (just make your prefix stable and long) |
| Multi-day reuse of a giant code/doc corpus | Gemini explicit `CachedContent` |
| Cross-provider fallback | Keep the cacheable prefix layout identical across providers so any hit works |

Combinar com o caching semântico (Fase 11 · 11) para a camada de mensagem do usuário: manuais de caching de prompt *token-identical* reutilização, manuais de caching semântico *meaning-identical* reutilização.

## Envia-o

Salvar`outputs/skill-prompt-caching-planner.md`- Não .

```markdown
---
name: prompt-caching-planner
description: Design a cache-friendly prompt layout and pick the right provider caching mode.
version: 1.0.0
phase: 11
lesson: 15
tags: [llm-engineering, caching, cost]
---

Given a prompt (system + tools + few-shot + retrieval + history + user) and a usage profile (requests per hour, TTL needed, provider), output:

1. Layout. Reordered sections with a single cache breakpoint marked; explain which sections are stable, which are volatile.
2. Provider mode. Anthropic cache_control, OpenAI automatic, or Gemini CachedContent. Justify from TTL and reuse pattern.
3. Break-even. Expected reads per write within TTL; net cost vs no-cache with math.
4. Verification plan. CI assertion that cache_read_input_tokens > 0 on the second identical request; dashboard split by cached vs uncached tokens.
5. Failure modes. List the three most likely reasons the cache will miss in this setup (dynamic timestamp, tool reorder, near-duplicate text) and how you will prevent each.

Refuse to ship a cache plan that places a dynamic field above the breakpoint. Refuse to enable 1h TTL without a reuse count that makes the 2x write premium pay back.
```

## Exercícios

1. **Easy.**Faça uma conversa de 10 voltas com um sistema de 5.000 tokens contra o Claude.`cache_control`Relata a conta de entrada de cada token.
2. **Medium.**Escrever um arame de teste que, dada uma template de solicitação e um registro de solicitação, calcule a taxa de sucesso esperada e a economia de dólares por fornecedor (Anthropic 5m, Anthropic 1h, OpenAI automático, Gemini explícito).
3. **Hard.**Construir um optimizador de layout: dado um prompt e uma lista de campos marcados `stable=True/False`, reescrever o prompt para colocar um único ponto de ruptura de cache na posição máxima de cache-friendly sem perder informações. Verificar em um endpoint real Antropic.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Prompt caching | "Makes long prompts cheap" | Reusing a provider-side KV-cache for matching prefixes; 50-90% discount on repeated input tokens. |
| `cache_control` | "The Anthropic marker" | Content-block attribute that declares "everything up to here is cacheable"; `{"type": "ephemeral"}`. |
| Cache write | "Paying the premium" | The first request that populates the cache; billed at ~1.25x input rate on Anthropic, free on OpenAI. |
| Cache read | "The discount" | Subsequent requests matching the prefix; billed at 10% (Anthropic), 50% (OpenAI), ~25% (Gemini). |
| TTL | "How long it lives" | Seconds the cache stays warm; Anthropic 5m default (extendable 1h), OpenAI best-effort up to 1h, Gemini user-set. |
| Extended TTL | "1-hour Anthropic cache" | `{"type": "ephemeral", "ttl": "1h"}`; 2x write premium but worth it for batch reuse. |
| Prefix match | "Why my cache missed" | Caches only hit when every token from the start up to the breakpoint is byte-identical. |
| Context caching (Gemini) | "The explicit one" | Google's named, storage-billed cache object; best for multi-day reuse of large corpora. |

## Mais leitura

- [Anthropic — Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)- Não .`cache_control`, 1h TTL, desdobrar as mesas.
- [OpenAI — Prompt caching](https://platform.openai.com/docs/guides/prompt-caching) correspondência automática de prefixos.
- [Google — Context caching](https://ai.google.dev/gemini-api/docs/caching)- Não .`CachedContent`API e preços de armazenamento.
- [Anthropic engineering — Prompt caching for long-context workloads](https://www.anthropic.com/news/prompt-caching) post de lançamento original com números de latência.
- Fase 11 · 05 (Engenharia de contexto)  onde cortar o prompt para que o cache possa aterrar.
- Fase 11 · 11 (Cachagem e Custos)  par de prompt caching com um cache semântico nas mensagens do usuário.
- [Pope et al., "Efficiently Scaling Transformer Inference" (2022)](https://arxiv.org/abs/2211.05102) o modelo de memória KV-cache que solicita o cache expõe aos usuários; explica por que um prefixo em cache é ~ 10x mais barato para ler novamente do que para recomputar.
- [Agrawal et al., "SARATHI: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills" (2023)](https://arxiv.org/abs/2308.16369) prefill é o ponto de urgência de cache atalhos; este artigo explica por que TTFT cai dramaticamente no cache hit enquanto TPOT não é afetado.
- [Leviathan et al., "Fast Inference from Transformers via Speculative Decoding" (2023)](https://arxiv.org/abs/2211.17192) o cache rápido fica ao lado da descodificação especulativa, da atenção flash e da MQA/GQA como alavancas que dobram a curva de custo de inferência; leia isto para os outros três.
