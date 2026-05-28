# Chaos Engineering para Produção de LLM

> Chaos engineering para LLMs é uma disciplina própria em 2026. Pré-requisitos antes de rodar experimentos em produção: SLI/SLO definidos, observabilidade com trace+metric+log, rollback automatizado, runbooks, plantão. Arquitetura tem quatro planos: controle (agendador de experimentos), alvo (serviços, infra, stores de dados), segurança (guardrails + abort + filtros de tráfego), observabilidade (métricas + traces + logs), feedback (para ajustes de SLO). Guardrails são obrigatórios: alertas de burn-rate pausam experimentos se o burn diário do error-budget > 2x o esperado; janelas de supressão + correlação de trace-ID deduplicam ruído de alerta. Cadência: canary semanal pequeno + revisão SLO; game day mensal + postmortem; auditoria trimestral cross-team de resiliência + mapeamento de dependências. Experimentos eespecificaçãoíficos de LLM: sobrecarga de memória, falhas de rede, outages de provedores, prompts malformados, tempestades de evição de KV cache. Ferramentas: Harness Chaos Engineering (recomendações derivadas de AI, downsizing de blast-radius, integração com MCP tool); LitmusChaos (CNCF); Chaos Mesh (CNCF Kubernetes-native).

**Tipo:** Aprender
**Linguagens:** Python (stdlib, simulador brincadeira de rodar experimentos de chaos)
**Pré-requisitos:** Fase 17 · 23 (SRE para AI), Fase 17 · 13 (Observabilidade)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Nomear os cinco pré-requisitos do chaos engineering (SLI/SLO, observabilidade, rollback, runbooks, plantão) e explicar por que pular qualquer um quebra a prática.
- Diagramar os quatro planos (controle, alvo, segurança, observabilidade) e o loop de feedback para SLO.
- Listar cinco experimentos eespecificaçãoíficos de LLM (sobrecarga de memória, falha de rede, outage de provedor, prompt malformado, tempestade de evição de KV).
- Escolher uma ferramenta — Harness, LitmusChaos, Chaos Mesh — dada a stack.

## O Problema

Chaos testing em stacks tradicionais já é estabelecido. Stacks de LLM adicionam novos modos de falha. Um prompt de 4K tokens com caractere venenoso trava o tokenizer por 12 segundos. Um provedor upstream retorna 429; seu gateway retenta; seu serviço dá OOM na concorrência amplificada pelo retry. Uma tempestade de evição de KV cache sob carga burst causa cascata de re-prefill que satura compute.

Nenhum desses aparece em testes unitários. Chaos engineering é como você descobre antes que os usuários descubram.

## O Conceito

### Pré-requisitos

Não rode chaos em produção sem:

1. **SLI/SLO** — indicadores e objetivos de nível de serviço definidos.
2. **Observabilidade** — traces, métricas, logs, conectados a dashboards.
3. **Rollback automatizado** — rollback por flag de política da Fase 17 · 20.
4. **Runbooks** — estruturados, Fase 17 · 23.
5. **Plantão** — alguém pra responder.

Faltar qualquer um significa que chaos vira incidente real.

### Quatro planos + feedback

**Plano de controle** — agendador de experimentos (workflow Litmus, agendamento Chaos Mesh, UI do Harness).

**Plano alvo** — serviços, pods, nós, load balancers, stores de dados.

**Plano de segurança** — kill switch, janelas de supressão, limites de blast-radius, gates de error-budget.

**Plano de observabilidade** — métricas normais + correlação de trace-ID para distinguir falhas induzidas de chaos de falhas naturais.

**Loop de feedback** — descobertas alimentam ajustes de SLO, atualizações de runbook, correções de código.

### Guardrails são obrigatórios

- **Alerta de burn-rate**: pause o experimento se o burn diário do error-budget ultrapassar 2x o esperado.
- **Janelas de supressão**: silencie alertas não-relacionados ao experimento no blast-radius durante o experimento.
- **Correlação de trace-ID**: todos os erros induzidos pelo experimento carregam uma tag para que o plantão deduplique.

### Cinco experimentos eespecificaçãoíficos de LLM

1. **Sobrecarga de memória** — force uma tempestade de preempção de KV cache enviando requests de longo contexto com alta concorrência. Observe: o serviço descarrega graciosamente ou crasha?

2. **Falha de rede** — corte a conectividade entre o gateway de inferência e o provedor. Observe: o reserva entra em ação dentro do SLA? (Fase 17 · 19)

3. **Simulação de outage de provedor** — 100% de 429 da OpenAI. Observe: o roteamento faz failover para Anthropic? (Fase 17 · 16, 19)

4. **Prompt malformado** — injete payload que trava tokenizer (ex: unicode profundamente aninhado, codepoint UTF-8 enorme). Observe: um único request trava um worker?

5. **Tempestade de evição de KV** — force evição saturando o orçamento de blocos do vLLM. Observe: LMCache recupera ou o serviço degrada?

### Cadência

- **Semanal** — pequenos experimentos canary em staging, talvez 5% em prod.
- **Mensal** — game day agendado em cenário eespecificaçãoífico; participação cross-team; postmortem.
- **Trimestral** — auditoria cross-team de resiliência; atualização do mapa de dependências.

### Ferramentas

- **Harness Chaos Engineering** — comercial; recomendações de experimentos derivadas de AI; downsizing de blast-radius; integração com MCP tool.
- **LitmusChaos** — CNCF graduated; baseado em workflow do Kubernetes.
- **Chaos Mesh** — CNCF sandbox; estilo CRD nativo do Kubernetes.
- **Gremlin** — comercial; suporte amplo.
- **AWS FIS** / **Azure Chaos Studio** — ofertas gerenciadas de cloud.

### Começando pequeno

Primeiro experimento: mate um pod de réplica de decode sob tráfego estável. Observe rerouting e recuperação. Se funciona e parece seguro, progrida para chaos de rede.

Primeiro experimento eespecificaçãoífico de LLM: injete 429 de um provedor por 5 minutos. Observe o fallback. A maioria dos times descobre que o reserva não foi totalmente testado.

### Números pra lembrar

- Quatro planos: controle, alvo, segurança, observabilidade.
- Pausa por burn-rate: 2x o burn diário esperado do budget.
- Cadência: canary semanal, game day mensal, auditoria trimestral.
- Cinco experimentos LLM: memória, rede, provedor, prompt malformado, tempestade de KV.

## Use

`code/main.py` simula três experimentos de chaos com gates do plano de segurança. Reporta quais experimentos acionariam o abort por burn-rate.

## Entregue

Esta aula produz `outputs/skill-chaos-plan.md`. Dada stack e maturidade, escolhe os três primeiros experimentos e a ferramentação.

## Exercícios

1. Execute `code/main.py`. Qual experimento aciona o gate de burn-rate e por quê?
2. Projet os cinco primeiros experimentos de chaos para um serviço de RAG baseado em vLLM. Inclua critérios de sucesso.
3. Seu alerta de burn-rate pausou um experimento. Como determina a causa raiz — chaos ou natural?
4. Argumente se chaos deve rodar em produção ou só em staging. Quando é que produção é a resposta certa?
5. Nomeie três modos de falha eespecificaçãoíficos de LLM que chaos de rede genérico não consegue reproduzir.

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|---------------------------|
| SLI / SLO | "targets de serviço" | Indicador + objetivo; pré-requisito obrigatório |
| Blast radius | "escopo" | Conjunto de serviços/usuários afetados pelo experimento |
| Alerta de burn-rate | "gate de budget" | Dispara quando burn rate do error-budget > 2x esperado |
| Game day | "exercício mensal" | Exercício de chaos cross-team agendado |
| LitmusChaos | "workflow CNCF" | Ferramenta de chaos CNCF graduated para Kubernetes |
| Chaos Mesh | "CRD do CNCF" | Chaos Kubernetes-native do sandbox CNCF |
| Harness CE | "comercial com AI" | Chaos do Harness com recomendações de AI |
| Prompt malformado | "bomba de tokenizer" | Input que trava tokenização |
| Tempestade de evição de KV | "cascata de preempção" | Evição em massa que dispara re-prefills |

## Leitura Complementar

- [DevSecOps School — Chaos Engineering 2026 Guide](https://devsecopsschool.com/blog/chaos-engineering/)
- [Ankush Sharma — Observability for LLMs (book)](https://www.amazon.com/Observability-Large-Language-Models-Engineering-ebook/dp/B0DJSR65TR)
- [LitmusChaos (CNCF)](https://litmuschaos.io/)
- [Chaos Mesh (CNCF)](https://chaos-mesh.org/)
- [Harness Chaos Engineering](https://www.harness.io/products/chaos-engineering)
- [AWS FIS](https://aws.amazon.com/fis/)
