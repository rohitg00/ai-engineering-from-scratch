# Observação do agente: Langfuse, Phoenix, Opik

> Três plataformas de observabilidade de agentes auto-hostage dominam 2026. Langfuse (MIT)  6M+ instalações/mês, rastreamento + gerenciamento de prompt + evals + repetição de sessão. Arize Phoenix (Elastic 2.0)  avaliações específicas de agentes profundas, relevância RAG, auto-instrumentamento OpenInference. Cometa Opik (Apache 2.0)  otimização automática de prompt, guardrails, detecção de alucinações de juízes LLM.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 23 (OTel GenAI)
**Time:** ~45 minutes

## Objetivos de aprendizagem

- Nomear as três principais plataformas de observação de agentes auto-hostables e suas licenças, e dizer qual licença não é código aberto OSI.
- Distinguir o que cada um é mais forte em: Langfuse (sessões de mgmt + rápida), Phoenix (RAG + auto-instrumentamento), Opik (optimização + guardrails).
- Explica por que 89% das organizações relatam ter observabilidade de agentes em vigor até 2026.
- Implementar um canal de rastreamento de dados de um sistema de dados com avaliação de juízes do MLL.

## O problema

OTel GenAI (Lessão 23) fornece o esquema. Você ainda precisa da plataforma que ingere intervalos, executa avaliações, armazena versões rápidas e superficia regressões.

## O conceito

### Langfuse (MIT)

- 6M+ SDK instalações / mês, 19k+ estrelas GitHub.
- Características: rastreamento, gestão rápida com versão + playground, avaliações (LLM-as-judge, feedback do usuário, personalizado), repetições de sessão.
- Junho de 2025: módulos anteriormente comerciais (LLM-as-a-judge, filas de anotações, experimentos rápidos, Playground) de código aberto sob MIT.
- Forte para: observabilidade de ponta a ponta com um ciclo de gestão de prompt apertado.

### Arize Phoenix (Licença Elastica 2.0)

- Avaliação mais profunda específica do agente: aglomeração de vestígios, detecção de anomalias, relevância da recuperação para o RAG.
- Auto-instrumentamento nativo OpenInference.
- Pares com Arize AX gerenciado para produção.
- Não há versão rápida  posicionada como uma ferramenta de deriva/regressão comportamental ao lado de plataformas mais amplas.
- Forte para: relevância RAG, deriva comportamental, detecção de anomalias.

### Cometa Opik (Apache 2.0)

- Otimizar imediatamente automaticamente através de experimentos A/B.
- Os limites de segurança (redagamento de PII, restrições tópicas).
- Juez de LLM detecção de alucinações.
- Benchmark da própria medição do Comet: Os registros de Opik + avaliações em 23.44s vs Langfuse 327.15s (~ 14x gap)  tomam os benchmarks do fornecedor como direcionais.
- Forte para: ciclo de otimização, experimentação automatizada, aplicação de barrancos.

### Dados da indústria

Por Maxim (2026 análise de campo): 89% das organizações têm observabilidade de agentes em vigor; os problemas de qualidade são a principal barreira à produção (32% dos entrevistados citam-nos).

### Escolhendo um

| Need | Pick |
|------|------|
| All-in-one with prompt management | Langfuse |
| Deep RAG evaluation + drift | Phoenix |
| Automated optimization + guardrails | Opik |
| Open licensing, no ELv2 | Langfuse (MIT) or Opik (Apache 2.0) |
| Datadog / New Relic integration | Any — they all export OTel |

### Onde este padrão vai mal

- **No eval strategy.**O rastreamento sem avaliação é apenas uma exploração caríssima.
- **Self-rolled LLM-judge without grounding.**Aplica-se o padrão CRITICO (LECÇÃO 05)  os juízes precisam de ferramentas externas para a verificação factual.
- **Prompt versions not tied to traces.**Quando o prod regressar, não se pode dividir para o impulso que o causou.

```figure
wb-trace-ingest
```

## Construí-lo

`code/main.py`Implementa um colecionador de vestígios stdlib + avaliador de juízes LLM:

- Ingerir espessuras em forma de GenAI.
- Grupo por sessão, etiqueta de corridas falhadas (viagens de guarda-roupa, avaliações de baixa confiança).
- Um juiz de LLM com guião que marca as respostas dos agentes em uma rubrica.
- Um resumo semelhante a um painel de instrumentos: taxa de falhas, principais razões de falhas, distribuição de pontuação de avaliação.

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

Resultado: pontuações de avaliação por sessão e categorização de falhas correspondentes ao que mostraria a Langfuse/Phoenix/Opik.

## Usá-lo

- **Langfuse**Auto-hosted ou em nuvem; via via OTel ou o seu SDK.
- **Arize Phoenix**Auto-hosted; auto-instrument OpenInference.
- **Comet Opik**Auto-hosted ou em nuvem; ciclo de otimização automatizado.
- **Datadog LLM Observability**Para equipes de operações mistas + ML que já executam o Datadog.

## Envia-o

`outputs/skill-obs-platform-wiring.md`escolhe uma plataforma e traça + avalia + solicita versões para um agente existente.

## Exercícios

1. Exportar uma semana de rastreamentos do OTel para a nuvem Langfuse.
2. Escreva uma rubrica de juiz de LLM para o seu domínio (correção factual, tom, adesão ao escopo).
3. Comparar a versão de Lanfuse com a aglomeração de rastreamentos da Phoenix.
4. Leia os documentos do barranco do Opik, entregue um barranco de redação de informações a um dos seus agentes.
5. Marque os três no seu corpus, ignore os números publicados pelo fornecedor, mensure os seus.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Tracing | "Spans collector" | Ingest OTel / SDK spans; index by session |
| Prompt management | "Prompt CMS" | Versioned prompts tied to traces |
| LLM-as-judge | "Automated eval" | Separate LLM scores agent output against a rubric |
| Session replay | "Trace playback" | Step through past runs for debugging |
| RAG relevancy | "Retrieval quality" | Does the retrieved context match the query |
| Trace clustering | "Behavioral grouping" | Cluster similar runs for drift detection |
| Guardrail enforcement | "Policy at log time" | PII/toxicity/scope checks on logged content |

## Mais leitura

- [Langfuse docs](https://langfuse.com/) rastreamento, avaliações, urgência
- [Arize Phoenix docs](https://docs.arize.com/phoenix) Auto-instrumentamento, derivação
- [Comet Opik](https://www.comet.com/site/products/opik/) Optimização + barris
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) o esquema todos os três consumir
