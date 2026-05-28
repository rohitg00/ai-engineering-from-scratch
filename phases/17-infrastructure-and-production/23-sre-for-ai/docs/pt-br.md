# SRE para AI — Resposta a Incidentes Multi-Agent, Runbooks, Detecção Preditiva

> AI SRE usa LLMs fundamentados em dados de infraestrutura (logs, runbooks, topologia de serviços) via RAG para automatizar fases de investigação, documentação e coordenação. O padrão de arquitetura em 2026 é orquestração multi-agent — agents especializados (logs, métricas, runbooks) coordenados por um supervisor; AI propõe hipóteses e consultas, humanos aprovam decisões de julgamento. Datadog Bits AI e Azure SRE Agent já entregam isso como produtos gerenciados. Runbooks estão evoluindo: NeuBird Hawkeye usa avaliação adversarial (dois modelos analisam o mesmo incidente; concordância = confiança, discordância = incerteza); memória operacional persiste entre mudanças de time. Auto-remediação continua cautelosa: AI sugere, humanos aprovam. Ação totalmente autônoma é estreita (reiniciar pod, rollback de deploy específico) com guardrails ríquissimos — quem vende "configura e esquece" está exagerando. Fronteira emergente: previsão pré-incidente. Pesquisa do MIT relata que um LLM treinado em logs históricos + temperaturas de GPU + padrões de erro de API previu 89% dos outages 10-15 min antes. Projeção: 95% dos LLMs empresariais têm failover automatizado até o fim de 2026.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, simulador brincadeira de triagem de incidentes multi-agent)
**Pré-requisitos:** Fase 17 · 13 (Observabilidade), Fase 17 · 24 (Chaos Engineering)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Diagramar a arquitetura AI SRE multi-agent: supervisor + agents especializados (logs, métricas, runbooks) + gate de aprovação humana.
- Explicar por que a auto-remediação é estreita (reiniciar pod, reverter deploy) e não ampla (rearquitetar serviço).
- Nomear o padrão de avaliação adversarial (NeuBird Hawkeye): dois modelos concordam = confiança; discordam = escalam.
- Citar o resultado de detecção antecipada do MIT de 89% e a restrição operacional: previsões sem atuação são só dashboards.

## O Problema

Um engenheiro de plantão recebe page às 3 da manhã. "Taxa de erro alta no checkout." Ele checa Datadog, Loki, três runbooks, o log de deploy. 30 minutos depois ele percebe que a causa raiz é um OOM de vLLM por causa de um pico no KV cache. Ele reinicia o pod; o erro some.

Em 2026 os primeiros 20 minutos dessa investigação são automatizáveis. Agrupar logs por serviço, correlacionar com deploys recentes, combinar com runbooks — tudo é RAG + uso de ferramentas. Um agent supervisionado consegue fazer triagem de primeira passada e apresentar uma hipótese antes do humano abrir o Datadog.

Remediação totalmente autônoma é um problema diferente. Reiniciar pod: seguro. Escalar pool de GPU: seguro se a política permitir. Rearquitetar o serviço: definitivamente não. A disciplina é desenhar a linha estreita.

## O Conceito

### Arquitetura multi-agent

```
          Incidente
             │
             ▼
        Supervisor
        /    |    \
       ▼     ▼     ▼
  Agent de logs  Agent de métricas  Agent de runbooks
       │     │     │
       └─────┴─────┘
             │
             ▼
        Hipótese + evidências
             │
             ▼
        Aprovação humana
             │
             ▼
        Ação (conjunto estreito)
```

Supervisor decompõe o incidente em sub-queries. Agents especializados têm acesso a ferramentas (busca de logs, PromQL, recuperação de docs). Supervisor sintetiza, apresenta hipótese + evidências ao humano. Humano aprova ou redireciona.

### Escopo da auto-remediação

**Seguro (estreito)**: reiniciar pod, reverter deploy específico, escalar pool dentro de limites pré-aprovados, ativar feature flag pré-aprovada.

**Não seguro (amplo)**: mudar topologia do serviço, modificar limites de recursos, deployar código novo, mudar IAM, alterar bancos de dados.

Quem vende "configura e esquece" está exagerando. O conjunto seguro cresce à medida que AI SRE amadurece, mas a fronteira é real.

### Avaliação adversarial (NeuBird Hawkeye)

Dois modelos analisam independentemente o mesmo incidente. Se concordam na causa raiz, confiança é alta. Se discordam, escalam pro humano com ambas as hipóteses visíveis. Padrão simples, filtro eficaz contra causas raiz alucinadas.

### Memória operacional

Turnover de time é o assassino silencioso do SRE tradicional — conhecimento tribal vai embora. AI SRE armazena runbooks + post-mortems num banco vetorial; agents recuperam a cada incidente novo. Quando engenheiros novos entram, a AI tem o histórico completo.

### Previsão pré-incidente

Pesquisa do MIT 2025: LLM treinado em logs históricos, temperaturas de GPU, padrões de erro de API previu 89% dos outages 10-15 minutos antes de acontecerem no conjunto de teste.

Checagem da realidade: previsões sem atuação são dashboards. A questão operacional é "quando prevemos, o que fazemos?" Drenagem preventiva? Pager? Auto-escalar? A resposta depende da política.

### Produtos em 2026

- **Datadog Bits AI** — copiloto de SRE gerenciado dentro do Datadog.
- **Azure SRE Agent** — nativo do Azure.
- **NeuBird Hawkeye** — avaliação adversarial + memória operacional.
- **PagerDuty AIOps** + triagem + desduplicação.
- **Incident.io Autopilot** — comandante de incidente + coordenação.

### Runbooks como código

Runbooks evoluem de páginas do Confluence para markdown versionado com seções estruturadas (sintoma, hipótese, verificação, ação). Runbooks estruturados alimentam melhor recuperação via RAG. Comece qualquer rollout de AI-SRE transformando runbooks não-estruturados em estruturados.

### Números pra lembrar

- Detecção antecipada do MIT: 89% dos outages, lead time de 10-15 min.
- Triagem multi-agent: supervisor + (logs, métricas, runbooks) + humano.
- Conjunto seguro de auto-remediação: reiniciar pod, reverter deploy, escalar dentro de limites.
- Avaliação adversarial: dois modelos independentes; concordância = confiança.

## Use

`code/main.py` simula triagem multi-agent: agent de logs encontra erro, agent de métricas encontra pico de CPU, agent de runbooks combina com problema conhecido. Supervisor ranqueia hipóteses.

## Entregue

Esta aula produz `outputs/skill-ai-sre-plan.md`. Dado plantão atual, volume de incidentes, maturidade do time, projeta um rollout de AI SRE.

## Exercícios

1. Execute `code/main.py`. E se os agents de logs e métricas discordarem? Como o supervisor resolve?
2. Defina três ações de auto-remediação "seguras" para seu serviço. Justifique cada uma.
3. Escreva um template de runbook estruturado: seções, campos obrigatórios, comandos de verificação.
4. Detecção preditiva dispara com 12 min de lead. Qual é sua política — pager, pré-drenagem, ou ambos?
5. Argumente se um time de 3 pessoas deve adotar AI SRE em 2026 ou esperar. Considere maturidade, volume, risco.

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|---------------------------|
| AI SRE | "agent pro plantão" | Investigação de incidentes + coordenação baseada em LLM |
| Agent supervisor | "o orquestrador" | Agent de alto nível que decompõe incidentes em sub-queries |
| Agent especializado | "agent de domínio" | Sub-agent com acesso a ferramentas (logs, métricas, runbooks) |
| Auto-remediação | "AI conserta" | Ação estreita pré-aprovada; NÃO rearquitetação ampla |
| Memória operacional | "runbooks vetoriais" | Post-mortems + runbooks em banco vetorial para RAG |
| Avaliação adversarial | "checagem de dois modelos" | Análises independentes; concordância = confiança |
| NeuBird Hawkeye | "o adversarial" | Produto com padrão de avaliação adversarial + memória |
| Bits AI | "agent SRE da Datadog" | AI SRE gerenciado pela Datadog |
| Previsão pré-incidente | "detecção antecipada" | Lead time de 10-15 min na previsão de outage |

## Leitura Complementar

- [incident.io — AI SRE Complete Guide 2026](https://incident.io/blog/what-is-ai-sre-complete-guide-2026)
- [InfoQ — Human-Centred AI for SRE](https://www.infoq.com/news/2026/01/opsworker-ai-sre/)
- [DZone — AI in SRE 2026](https://dzone.com/articles/ai-in-sre-whats-actually-coming-in-2026)
- [Datadog Bits AI](https://www.datadoghq.com/product/bits-ai/)
- [NeuBird Hawkeye](https://www.neubird.ai/)
- [awesome-ai-sre](https://github.com/agamm/awesome-ai-sre)
