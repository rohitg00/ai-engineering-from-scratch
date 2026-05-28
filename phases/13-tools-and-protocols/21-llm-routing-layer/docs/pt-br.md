# Camada de Roteamento LLM — LiteLLM, OpenRouter, Portkey

> Travamento em vendor é caro. Diferentes workloads de chamada de ferramenta se encaixam em modelos diferentes. Gateways de roteamento dão uma superfície de API, retentativas, failover, rastreamento de custo e guardrails. Três arquétipos dominam 2026: LiteLLM (self-hosted open-source), OpenRouter (SaaS gerenciado), Portkey (produção-grade, open-source em março 2026). Essa lição lista os critérios de decisão e percorre um gateway de roteamento com stdlib.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, roteamento + failover + rastreador de custo)
**Pré-requisitos:** Fase 13 · 02 (function calling), Fase 13 · 17 (gateways)
**Tempo:** ~45 minutos

## Objetivos de Aprendizado

- Distinguir opções de roteamento self-hosted, gerenciado e produção-grade.
- Implemente uma cadeia de reserva que retenta em falhas de provider numa ordem de prioridade definida.
- Rastreie custo por requisição e uso de tokens entre providers.
- Decida entre LiteLLM, OpenRouter e Portkey pra uma restrição de produção dada.

## O Problema

Cenários onde o roteamento de provider importa:

1. **Custo.** Claude Sonnet custa 3x o que Haiku custa. Pra uma tarefa de triagem, Haiku basta; pra uma tarefa de síntese, Sonnet vale a pena. Rote por requisição.
2. **Failover.** OpenAI tem uma hora ruim. Cada requisição falha. Você quer reserva automático pra Anthropic sem redeploy.
3. **Latência.** Uma UI de chat ao vivo precisa de tempo-primeiro-token rápido. Um resumidor em batch não precisa. Rote por SLA de latência.
4. **Compliance.** Usuários EU devem ficar em regiões EU. Rote por região.
5. **Experimentação.** A/B teste dois modelos no mesmo workload. Rote por bucket de teste.

Hard-coding tudo isso pra cada integração é repetitivo. Um gateway de roteamento dá uma API compatível com OpenAI e lida com o resto.

## O Conceito

### Forma de proxy compatível com OpenAI

Todo mundo fala o formato da OpenAI. O gateway de roteamento expõe `/v1/chat/completions`, aceita o schema OpenAI e internamente proxya pra Anthropic / Gemini / Cohere / Ollama / qualquer coisa. O cliente não se importa.

### Aliases de modelo

Em vez de `claude-3-5-sonnet-20251022`, seu código diz `nosso_modelo_inteligente`. O gateway mapeia aliases pra modelos reais. Quando a Anthropic lança Claude 4, você muda o alias no servidor; seu código não toca em nada.

### Cadeias de fallback

```
primary: openai/gpt-4o
on 5xx: anthropic/claude-3-5-sonnet
on 5xx: google/gemini-1.5-pro
on 5xx: refuse
```

Gateways definem isso numa config. Retentativas contam contra um orçamento pra que cascadas de reserva não explodam o custo.

### Cache semântico

Prompts idênticos ou quase-idênticos batem num cache em vez de ir pro provider. Economia em agente loops repetidos pode ser 30 a 60 por cento. Chaves são baseadas em embedding; prompts quase-idênticos compartilham um slot de cache.

### Guardrails

Nível de gateway:

- **Redação de PII.** Pass por regex ou ML antes de enviar prompts.
- **Violações de política.** Rejeite prompts com conteúdo proibido.
- **Filtros de saída.** Limpe completions pra vazamentos.

Portkey e Kong ambos disponibilizam guardrails opinativos. LiteLLM deixa opcionais.

### Limites de taxa por chave

Uma API key = um time. Orçamentos por chave evitam que um time consuma a cota compartilhada. A maioria dos gateways suporta isso.

### Tradeoffs self-hosted vs gerenciado

| Fator | LiteLLM (self-hosted) | OpenRouter (gerenciado) | Portkey (produção) |
|--------|----------------------|----------------------|----------------------|
| Código | Open-source, Python | SaaS gerenciado | Open-source (Mar 2026) + gerenciado |
| Setup | Deploy um proxy | Cadastre-se | Qualquer um |
| Providers | 100+ | 300+ | 100+ |
| Billing | Suas próprias keys | Créditos OpenRouter | Suas próprias keys |
| Observabilidade | OpenTelemetry | Dashboard | OTel completo + redação PII |
| Melhor pra | Times com controle total | Prototipagem rápida | Produção com conformidade |

LiteLLM vence quando você tem um time SRE e quer soberania de dados. OpenRouter vence quando quer uma única assinatura e sem infra. Portkey vence quando precisa de guardrails e conformidade fora da caixa.

### Rastreamento de custo

Cada requisição carrega `provider`, `model`, `input_tokens`, `output_tokens`. Multiplique por preços por modelo por token (puxados de uma planilha de preços que o gateway mantém). Agregação por usuário / time / projeto.

### MCP mais roteamento

Um gateway pode rotear tanto chamadas de LLM quanto requisições de sampling MCP. Quando uma requisição de sampling tem modelPreferences preferindo um modelo eespecificaçãoífico, o gateway traduz pro backend certo. É onde a Fase 13 · 17 (gateway MCP) e o gateway de roteamento desta lição às vezes se fundem num único serviço.

### Estratégias de roteamento

- **Prioridade estática.** Primeiro na lista; reserva em erro.
- **Balanceamento de carga.** Round-robin ou ponderado.
- **Consciente de custo.** Escolha o modelo mais barato que atende latência/qualidade.
- **Consciente de latência.** Escolha o modelo mais rápido nos últimos N minutos.
- **Consciente de tarefa.** Classificador de prompt roteia código pra um modelo, resumo pra outro.

## Usar

`code/main.py` implementa um gateway de roteamento em ~150 linhas: aceita requisições no formato OpenAI, traduz pra stubs por provider, roda uma cadeia de reserva de prioridade, rastreia custo por requisição e aplica uma pass de redação de PII nas entradas. Rode com três cenários: requisição normal, outage de provider primário disparando fallback, vazamento de PII pego pela redação.

O que observar:

- Dicionário `ROUTES`: alias -> lista ordenada por prioridade de providers concretos.
- Loop de reserva retenta em 5xx.
- Rastreador de custo multiplica uso de tokens por taxas por modelo.
- Redator de PII limpa padrões estilo SSN antes de encaminhar.

## Entregar

Essa lição produz `outputs/skill-routing-config-designer.md`. Dado um perfil de workload (latência, custo, conformidade), a skill escolhe LiteLLM / OpenRouter / Portkey e produz uma config de roteamento.

## Exercícios

1. Rode `code/main.py`. Dispare o cenário de outage; confirme que o reserva aterrissa no segundo provider e o custo é atribuído corretamente.

2. Adicione cache semântico: SHA256 do prompt é uma chave de busca; cache hits retornam instantaneamente. Meça economia de custo numa chamada repetida.

3. Adicione um classificador de prompt que rote prompts "code ..." pra um alias favorecendo inteligência e prompts "summarize ..." pra um alias favorecendo velocidade.

4. Projete orçamentos por time: cada time tem um teto mensal de gasto; o gateway recusa requisições quando o teto é atingido. Escolha uma granularidade de imposição (por requisição ou em janela).

5. Leia a documentação do LiteLLM, OpenRouter e Portkey lado a lado. Nomeie uma funcionalidade que cada um disponibiliza que os outros dois não.

## Termos Chave

| Termo | O que as pessoas dizem | O que significa de verdade |
|------|----------------|------------------------|
| Gateway de roteamento | "Proxy LLM" | Camada de API única na frente de múltiplos providers |
| Compatível com OpenAI | "Fala o schema da OpenAI" | Aceita formato `/v1/chat/completions`, traduz pra qualquer backend |
| Alias de modelo | "nosso_modelo_inteligente" | Nome no seu código que o gateway mapeia pra um modelo concreto |
| Cadeia de reserva | "Lista de retentativa" | Lista ordenada de providers tentados em falha |
| Cache semântico | "Cache de embedding de prompt" | Chave é embedding do prompt; duplicatas quase-idênticas batem no cache |
| Guardrails | "Filtros de entrada/saída" | Redijam PII, rejeitem violações de política |
| Limite de taxa por chave | "Orçamento de time" | Cota vinculada a uma API key |
| Rastreamento de custo | "Gasto por requisição" | Agregação uso de tokens x preço por modelo |
| LiteLLM | "O proxy aberto" | Gateway de roteamento OSS self-hostable |
| OpenRouter | "O SaaS gerenciado" | Gateway hospedado com billing baseado em créditos |
| Portkey | "A opção de produção" | Open-source + gerenciado com guardrails embutidos |

## Leitura Complementar

- [LiteLLM — docs](https://docs.litellm.ai/) — gateway de roteamento self-hosted
- [OpenRouter — quickstart](https://openrouter.ai/docs/quickstart) — roteamento SaaS gerenciado
- [Portkey — docs](https://portkey.ai/docs) — roteamento de produção com guardrails
- [TrueFoundry — LiteLLM vs OpenRouter](https://www.truefoundry.com/blog/litellm-vs-openrouter) — guia de decisão
- [Relayplane — LLM gateway comparison 2026](https://relayplane.com/blog/llm-gateway-comparison-2026) — pesquisa de vendors
