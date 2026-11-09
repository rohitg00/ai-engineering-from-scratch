# SRE para IA  Resposta a Incidentes Multidistribuídos, Runbooks, Detecção Preditiva

> A AI SRE utiliza LLM baseados em dados de infraestrutura (logs, runbooks, topologia de serviços) através do RAG para automatizar as fases de investigação, documentação e coordenação. O padrão de arquitetura de 2026 é a orquestração de vários agentes  agentes especializados (logs, métricas, runbooks) coordenados por um supervisor; A IA propõe hipóteses e consultas, os seres humanos aprovam chamadas de julgamento. Datadog Bits AI e Azure SRE Agent enviam isto como produtos gerenciados. Os runbooks estão evoluindo: NeuBird Hawkeye usa avaliação adversária (dois modelos analisam o mesmo incidente; acordo = confiança, desacordo = incerteza); a memória operacional persiste em todas as mudanças da equipe. A auto-remediação permanece cautelosa: a IA sugere, os seres humanos aprovam. A ação totalmente autónoma é estreita (pod de reinicialização, implantação específica de retorno) com guardrails apertados  qualquer pessoa vendendo "set it and forget it" está supervendendo. Fronteira emergente: previsão pré-incidente. A pesquisa do MIT relata que um LLM treinado em registros históricos + tempos de GPU + padrões de erro de API prevê 89% das interrupções 10-15 minutos antes. Projeção: 95% dos LLM em empresas já têm uma falha automática até o final de 2026.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy multi-agent incident triage simulator)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 24 (Chaos Engineering)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Diagrama da arquitetura multi-agente AI SRE: supervisor + agentes especializados (logs, métricas, runbooks) + portal de aprovação humana.
- Explique por que a remediação automática é limitada (capsula de reinicialização, reimplementação reversa) e não ampla (serviço de rearquitetura).
- Nomear o padrão de avaliação adversária (NeuBird Hawkeye): dois modelos concordam = confiança; discordar = escalada.
- Cite o resultado de detecção precoce do MIT 89% e a restrição operacional: as previsões sem ativação são apenas painéis de controle.

## O problema

Um engenheiro em chamada recebe um sinal às 3 da manhã "Alta taxa de erro na caixa de pagamento". Eles verificam Datadog, Loki, três livretes de execução, o registro de implantação. 30 minutos depois percebem que a causa raiz é um OOM vLLM de um cache de KV. Eles reiniciar a cápsula; erro limpo.

Em 2026 os primeiros 20 minutos dessa investigação são automatizados. Grupar registros por serviço, correlacionando com implantações recentes, combinando com runbooks  todos são RAG + uso de ferramentas. Um agente supervisionado pode fazer triagem de primeira passagem e apresentar uma hipótese antes que o humano abra Datadog.

A remediação totalmente autônoma é um problema diferente. Reiniciar a cápsula: seguro. Polaridade de GPU: seguro se a política permitir. Rearquitar o serviço: absolutamente não. A disciplina está desenhando a linha estreita.

## O conceito

### Arquitetura multi-agente

```
          Incident
             │
             ▼
        Supervisor
        /    |    \
       ▼     ▼     ▼
  Log agent  Metric agent  Runbook agent
       │     │     │
       └─────┴─────┘
             │
             ▼
        Hypothesis + evidence
             │
             ▼
        Human approval
             │
             ▼
        Action (narrow set)
```

O supervisor divide o incidente em sub-queries. Agentes especializados têm acesso a ferramentas (busca de registro, PromQL, recuperação de documentos).

### Ámbito de aplicação da remediação automática

**Safe (narrow)**: reiniciar a cápsula, reverter a implantação específica, agrupar a escala dentro dos limites pré-aprovados, ativar a bandeira de características pré-aprovada.

**Not safe (broad)**A Comissão propõe que a Comissão adopte um novo regulamento relativo à aplicação do código de base.

Quem vende "set it and forget it" está a vender demais. O set de segurança cresce à medida que a AI SRE amadurece, mas o limite é real.

### Avaliação adversária (NeuBird Hawkeye)

Dois modelos analisam o mesmo incidente de forma independente. Se concordarem sobre a causa raiz, a confiança é alta. Se discordarem, escalam para humanos com ambas as hipóteses visíveis. Padrão simples, filtro eficaz contra causas raiz alucinadas.

### Memória operacional

O turnover de equipe é a morte silenciosa das folhas tradicionais de conhecimento tribal SRE. A AI SRE armazena runbooks + post-mortems em um vector DB; agentes recuperam em cada novo incidente. Quando novos engenheiros se juntam, a AI tem história completa.

### Previsão de incidentes

Pesquisa MIT 2025: LLM treinado em registros históricos, temperaturas de GPU, padrões de erro API previu 89% de interrupções 10-15 minutos antes de acontecerem no conjunto de testes.

Verificação da realidade: as previsões sem ativação são painéis de controle. A pergunta operacional é "quando nós predizemos, o que fazemos?" Desgaste preventivo? Pager? Auto-escalada? A resposta é específica da política.

### Produtos em 2026

- **Datadog Bits AI**- O co-piloto da SRE no Datadog.
- **Azure SRE Agent**- Nativo de Azure.
- **NeuBird Hawkeye** Avaliação adversária + memória operacional.
- **PagerDuty AIOps** triagem + deduplicação.
- **Incident.io Autopilot**- Comandante de incidentes + coordenação.

### Livros de execução como código

Os runbooks evoluem de páginas de Confluence para marcas de versão com seções estruturadas (símbolo, hipótese, verificação, ato).

### Números que você deve lembrar

- Detecção precoce do MIT: 89% de interrupções, tempo de liderança de 10-15 minutos.
- Classificação multi-agente: supervisor + (registros, métricas, runbooks) + humano.
- Set de remediação automática segura: reinicialização da cápsula, reimplementação, escala dentro dos limites.
- Avaliação adversária: dois modelos independentes; acordo = confiança.

```figure
i4-incident-agents
```

## Usá-lo

`code/main.py`Simula uma triagem de vários agentes: o agente de registro encontra erro, o agente métrico encontra spike da CPU, o agente do runbook corresponde a um problema conhecido.

## Envia-o

Esta lição produz`outputs/skill-ai-sre-plan.md`Dada a atualidade de chamada, o volume de incidentes, a maturidade da equipa, desenha uma implantação de SRE.

## Exercícios

1. Corra .`code/main.py`E se os agentes registos e métricos discordarem?
2. Defina três ações de auto-remediamento "seguras" para o seu serviço.
3. Escrever um modelo estruturado de runbook: seções, campos exigidos, comandos de verificação.
4. Que é a sua política?
5. Argumentar se uma equipe de 3 pessoas deve adotar a AI SRE em 2026 ou esperar.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| AI SRE | "agent for on-call" | LLM-backed incident investigation + coordination |
| Supervisor agent | "the orchestrator" | Top-level agent breaking incidents into sub-queries |
| Specialized agent | "domain agent" | Sub-agent with tool access (logs, metrics, runbooks) |
| Auto-remediation | "AI fixes it" | Narrow pre-approved action; NOT broad re-architecture |
| Operational memory | "vector runbooks" | Post-mortems + runbooks in vector DB for RAG |
| Adversarial eval | "two-model check" | Independent analyses; agreement = confidence |
| NeuBird Hawkeye | "the adversarial one" | Product with adversarial-eval + memory pattern |
| Bits AI | "Datadog's SRE agent" | Datadog-managed AI SRE |
| Pre-incident prediction | "early detection" | 10-15 min lead time on outage prediction |

## Mais leitura

- [incident.io — AI SRE Complete Guide 2026](https://incident.io/blog/what-is-ai-sre-complete-guide-2026)
- [InfoQ — Human-Centred AI for SRE](https://www.infoq.com/news/2026/01/opsworker-ai-sre/)
- [DZone — AI in SRE 2026](https://dzone.com/articles/ai-in-sre-whats-actually-coming-in-2026)
- [Datadog Bits AI](https://www.datadoghq.com/product/bits-ai/)
- [NeuBird Hawkeye](https://www.neubird.ai/)
- [awesome-ai-sre](https://github.com/agamm/awesome-ai-sre)
