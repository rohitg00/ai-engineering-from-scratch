# Observabilidade de Agent: Langfuse, Phoenix, Opik

> Três plataformas de observabilidade de agentes open-source dominam 2026. Langfuse (MIT) — 6M+ installs/mês, tracing + gestão de prompts + evals + replay de sessão. Arize Phoenix (Elastic 2.0) — evals profundas eespecificaçãoíficas pra agentes, relevância de RAG, auto-instrumentação OpenInference. Comet Opik (Apache 2.0) — otimização automática de prompts, guardrails, detecção de alucinação por LLM-judge.

**Tipo:** Aprender
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 23 (OTel GenAI)
**Tempo:** ~45 minutos

## Objetivos de Aprendizado

- Nomear as três principais plataformas de observabilidade de agentes open-source e suas licenças.
- Distinguir onde cada uma é mais forte: Langfuse (gestão de prompts + sessões), Phoenix (RAG + auto-instrumentação), Opik (otimização + guardrails).
- Explicar por que 89% das organizações reportam ter observabilidade de agentes em 2026.
- Implementar um pipeline stdlib de trace-to-dashboard com avaliação por LLM-judge.

## O Problema

OTel GenAI (Aula 23) te dá o schema. Você ainda precisa da plataforma que ingere spams, roda evals, armazena versões de prompts e superficia regressões. Os três concorrentes enfatizam partes diferentes do ciclo de vida.

## O Conceito

### Langfuse (MIT)

- 6M+ installs de SDK/mês, 19k+ estrelas no GitHub.
- Funcionalidades: tracing, gestão de prompts com versionamento + playground, evals (LLM-as-judge, feedback do usuário, custom), replay de sessão.
- Junho 2025: módulos antes comerciais (LLM-as-a-judge, filas de anotação, experimentos de prompt, Playground) open-sourced sob MIT.
- Mais forte pra: observabilidade ponta a ponta com loop apertado de gestão de prompts.

### Arize Phoenix (Elastic License 2.0)

- Eval eespecificaçãoíficas pra agentes mais profundas: clustering de traces, detecção de anomalias, relevância de recuperação pra RAG.
- Auto-instrumentação OpenInference nativa.
- Complementa o Arize AX gerenciado pra produção.
- Sem versionamento de prompts — posicionado como ferramenta de deriva/regressão comportamental ao lado de plataformas mais amplas.
- Mais forte pra: relevância de RAG, deriva comportamental, detecção de anomalias.

### Comet Opik (Apache 2.0)

- Otimização automática de prompts via experimentos A/B.
- Guardrails (redação de PII, restrições temáticas).
- Detecção de alucinação por LLM-judge.
- Benchmark da própria Comet: logs + evals do Opik em 23.44s vs Langfuse 327.15s (~14x de diferença) — trate benchmarks de vendor como direcionais.
- Mais forte pra: loop de otimização, experimentação automática, imposição de guardrails.

### Dados da indústria

Segundo Maxim (análise de campo 2026): 89% das organizações têm observabilidade de agentes implementada; problemas de qualidade são a principal barreira de produção (32% dos respondentes os citam).

### Escolhendo um

| Necessidade | Escolha |
|-------------|---------|
| Tudo-em-um com gestão de prompts | Langfuse |
| Eval profunda de RAG + deriva | Phoenix |
| Otimização automática + guardrails | Opik |
| Licenciamento aberto, sem ELv2 | Langfuse (MIT) ou Opik (Apache 2.0) |
| Integração Datadog / New Relic | Qualquer — todos exportam OTel |

### Onde esse pattern dá errado

- **Sem estratégia de eval.** Tracing sem avaliação é só logging caro.
- **LLM-judge self-rolled sem grounding.** Padrão CRITIC (Aula 05) se aplica — juízes precisam de ferramentas externas pra verificação factual.
- **Versões de prompts não vinculadas a traces.** Quando a prod regredir, você não consegue bissectar até o prompt que causou.

## Construa

`code/main.py` implementa um coletor de traces + avaliador LLM-judge em stdlib:

- Ingest de spans formato GenAI.
- Agrupamento por sessão, tag de runs falhos (guardrails dispararam, evals com baixa confiança).
- Um LLM-judge roteado que pontua respostas de agentes num rubrica.
- Um resumo tipo dashboard: taxa de falha, principais motivos de falha, distribuição de scores de eval.

Execute:

```
python3 code/main.py
```

Saída: scores de eval por sessão e categorização de falhas correspondente ao que Langfuse/Phoenix/Opik mostrariam.

## Use

- **Langfuse** self-hosted ou cloud; conecte via OTel ou SDK deles.
- **Arize Phoenix** self-hosted; auto-instrumentação OpenInference.
- **Comet Opik** self-hosted ou cloud; loop de otimização automática.
- **Datadog LLM Observability** pra times mistos ops+ML que já rodam Datadog.

## Entregue

`outputs/skill-obs-platform-wiring.md` escolhe uma plataforma e conecta traces + evals + versões de prompts num agente existente.

## Exercícios

1. Exporte uma semana de traces OTel pro Langfuse cloud (tier grátis). Quais sessões falharam? Por quê?
2. Escreva uma rubrica de LLM-judge pro seu domínio (correção factual, tom, aderência ao escopo). Teste em 50 traces.
3. Compare o versionamento de prompts do Langfuse com o clustering de traces do Phoenix. Qual te diz o que quebrou mais rápido?
4. Leia a documentação de guardrails do Opik. Conecte um guardrail de redação de PII a uma das suas execuções de agente.
5. Faça benchmark dos três no seu corpus. Ignore números publicados pelos vendors; meça os seus.

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Tracing | "Coletor de spans" | Ingest de spans OTel / SDK; indexa por sessão |
| Gestão de prompts | "CMS de prompts" | Prompts versionados vinculados a traces |
| LLM-as-judge | "Eval automática" | LLM separado que pontua output do agente contra uma rubrica |
| Replay de sessão | "Playback de trace" | Passo a passo de runs passadas pra debug |
| Relevância de RAG | "Qualidade da recuperação" | O contexto recuperado combina com a consulta |
| Clustering de traces | "Agrupamento comportamental" | Agrupa runs similares pra detecção de deriva |
| Imposição de guardrail | "Política no log" | Checagens de PII/toxicidade/escopo no conteúdo logado |

## Leitura Complementar

- [Langfuse docs](https://langfuse.com/) — tracing, evals, gestão de prompts
- [Arize Phoenix docs](https://docs.arize.com/phoenix) — auto-instrumentação, deriva
- [Comet Opik](https://www.comet.com/site/products/opik/) — otimização + guardrails
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/especificaçãos/semconv/gen-ai/) — o schema que todos três consomem
