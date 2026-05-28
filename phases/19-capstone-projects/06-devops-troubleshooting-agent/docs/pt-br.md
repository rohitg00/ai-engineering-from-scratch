# Capstone 06 — Agent de Solução de Problemas DevOps para Kubernetes

> O DevOps Agent da AWS entrou em GA, Resolve AI publicou seus playbooks para K8s, NeuBird demonstrou monitoramento semântico e Metoro vinculou IA SRE a SLOs por serviço. A forma de produção está definida: um webhook de alerta dispara, um agente lê telemetria, percorre um grafo de objetos K8s, ranqueia hipóteses de causa raiz e publica um briefing no Slack com botões de aprovação. Somente leitura por padrão. Toda remediação aprovada por humano. Este capstone é esse agent, avaliado em 20 incidentes sintéticos e comparado com o Agent da AWS em três casos compartilhados.

**Tipo:** Capstone
**Linguagens:** Python (agent), TypeScript (integração Slack)
**Pré-requisitos:** Fase 11 (engenharia de LLM), Fase 13 (ferramentas e MCP), Fase 14 (agents), Fase 15 (autônomo), Fase 17 (infraestrutura), Fase 18 (segurança)
**Fases exercitadas:** P11 · P13 · P14 · P15 · P17 · P18
**Tempo:** 30 horas

## Problema

A narrativa SRE de 2025-2026 se tornou: "agents de IA triam incidentes, humanos aprovam remediações." AWS DevOps Agent, Resolve AI, NeuBird, Metoro, PagerDuty AIOps — todos lançam essa forma em produção. O agente lê métricas do Prometheus, logs do Loki, traces do Tempo, kube-state-metrics e um grafo de conhecimento de objetos K8s. Ele produz uma hipótese de causa raiz ranqueada com citações de telemetria em menos de cinco minutos. Ele nunca executa comandos destrutivos sem aprovação explícita de um humano via Slack.

A maioria do trabalho difícil é delimitação e segurança, não raciocínio. O agente precisa de uma superfície RBAC somente-leitura por padrão, um servidor de ferramentas MCP blindado e logs de auditoria de todo comando considerado vs executado. Precisa saber quando está fora do seu alcance e escalar. E precisa rodar barato o suficiente para que cascatas de OOM-kill não gerem uma conta de agente de $5k.

## Conceito

O agente opera em um grafo de conhecimento. Nós são objetos K8s (Pods, Deployments, Services, Nodes, HPAs, PVCs) além de fontes de telemetria (séries do Prometheus, streams do Loki, traces do Tempo). Arestas codificam propriedade (Pod -> ReplicaSet -> Deployment), agendamento (Pod -> Node) e observação (Pod -> série do Prometheus). O grafo é mantido atualizado por uma sincronização do kube-state-metrics e reamostrado a cada alerta.

Quando um alerta dispara, o agente investiga a causa raiz a partir do objeto afetado. Percorre arestas, puxa as fatias de telemetria relevantes (últimos 15 minutos) e elabora uma hipótese. A hipótese é ranqueada por evidência: quantas citações de telemetria a suportam, quão recentes, quão eespecificaçãoíficas. As top-3 hipóteses vão para o Slack com visualizações de caminho no grafo e botões de aprovação para ações de remediação.

Remediação é controlada. Ações permitidas por padrão são somente-leitura. Ações destrutivas (escalar para baixo, fazer rollback, deletar Pods) requerem aprovação no Slack; hooks de rollback do ArgoCD requerem um token de autenticação que o agente nunca detém. O log de auditoria registra todo comando que o agente *considerou* — não apenas executou — para que o processo de revisão pegue quase-acertos.

## Arquitetura

```
webhook PagerDuty / Alertmanager
           |
           v
     receptor FastAPI
           |
           v
   agente de causa raiz LangGraph
           |
           +---- ferramentas MCP somente-leitura ----+
           |                                          |
           v                                          v
   grafo de conhecimento K8s               fatias de telemetria
     (Neo4j / kuzu)                      Prometheus, Loki, Tempo
   propriedade + agendamento              últimos 15m, escopo
           |
           v
   ranqueamento de hipóteses (peso de evidência)
           |
           v
   briefing Slack + botões de aprovação
           |
           v (aprovado)
   hook de rollback ArgoCD / escalar PagerDuty
           |
           v
   log de auditoria: considerado vs executado, todo comando
```

## Stack

- Fontes de observabilidade: Prometheus, Loki, Tempo, kube-state-metrics
- Grafo de conhecimento: Neo4j (gerenciado) ou kuzu (embarcado) de objetos K8s + arestas de telemetria
- Agent: LangGraph com lista de permissão por ferramenta, somente-leitura por padrão
- Transporte de ferramentas: FastMCP via StreamableHTTP; servidor separado para ferramentas destrutivas atrás do portão de aprovação
- Modelos: Claude Sonnet 4.7 para raciocínio de causa raiz, Gemini 2.5 Flash para sumarização de logs
- Remediação: webhook de rollback ArgoCD, escalar PagerDuty, card de aprovação Slack
- Auditoria: log estruturado append-only (considerado, executado, aprovado, resultado)
- Deploy: implantação K8s com sua própria role RBAC estreita; namespace separado

## Construa

1. **Ingestão do grafo.** Sincronize kube-state-metrics no Neo4j/kuzu a cada 30s. Nós: Pod, Deployment, Node, Service, PVC, HPA. Arestas: OWNED_BY, SCHEDULED_ON, EXPOSES, MOUNTS, SCALES. Arestas de telemetria: OBSERVED_BY (um Pod é observado por uma série do Prometheus).

2. **Receptor de alertas.** Endpoint FastAPI que aceita webhooks do PagerDuty ou Alertmanager. Extraia o(s) objeto(s) afetado(s) e a violação de SLO.

3. **Superfície de ferramentas somente-leitura.** Envolta de kubectl, consulta do Prometheus, logql do Loki, traceql do Tempo via FastMCP. Cada ferramenta tem um verbo RBAC estreito ("get", "list", "describe"). Nenhum "delete", "exec", "scale" no servidor padrão.

4. **Agent de causa raiz.** LangGraph com três nós: `sample` puxa a fatia de telemetria dos últimos 15 minutos, `walk` consulta o grafo por objetos vizinhos, `hypothesize` elabora candidatos de causa raiz ranqueados com citações de telemetria.

5. **Pontuação de evidência.** Cada hipótese tem pontuação = recência * eespecificaçãoificidade * inverso do comprimento do caminho no grafo * contagem de citações. Retorne top-3.

6. **Briefing Slack.** Publique um anexo com a hipótese, a visualização do caminho no grafo (uma imagem de subgrafo renderizada server-side) e botões de aprovação para no máximo uma ação de remediação.

7. **Portão de remediação.** Ferramentas destrutivas (escalar para baixo, rollback, delete) ficam num segundo servidor MCP atrás de um token de aprovação. O agente só pode chamá-las após o card Slack ser aprovado por um humano.

8. **Log de auditoria.** JSONL append-only: para cada comando candidato, registre se foi considerado, se foi executado, quem aprovou. Envie para S3 diariamente.

9. **Conjunto de incidentes sintéticos.** Construa 20 cenários: cascata de OOMKill, instabilidade de DNS, thrash de HPA, preenchimento de PVC, vizinho barulhento, sidecar defeituoso, rollout ruim de ConfigMap, rotação de certificado, backoff de pull de imagem, etc. Pontue o agente na acurácia de causa raiz e tempo-até-hipótese.

## Use

```
webhook: alert.pagerduty.com -> violação de SLO do checkout-api, taxa de erro 14%
[grafo]   afetado: Deployment checkout-api (3 Pods, Node ip-10-2-3-4)
[percorrer] vizinhos: ReplicaSet checkout-api-abc, Service checkout-api,
           rollout recente há 14m
[sample]  prometheus error_rate 14%, tendência de alta; loki 500s em /api/v2/pay
[hipótese] #1 rollout ruim: imagem mais recente checkout-api:v2.41 falha /healthz
          citações: deploy.yaml (rev 42), prometheus errorRate, loki 500 stack
[slack]   [FAZER ROLLBACK para v2.40]  [ESCALAR]  [IGNORAR]
          (aprovação necessária; agente não faz rollback unilateralmente)
```

## Entregue

`outputs/skill-devops-agent.md` é a entrega. Dado um cluster K8s e uma fonte de alerta, o agente produz hipóteses ranqueadas de causa raiz e um fluxo de remediação controlado pelo Slack.

| Peso | Critério | Como é medido |
|:-:|---|---|
| 25 | Acurácia de causa raiz no conjunto de cenários | ≥80% causa raiz correta em 20 incidentes sintéticos |
| 20 | Segurança | Guard de ação destrutiva nunca dispara sem aprovação Slack no log de auditoria |
| 20 | Tempo até hipótese | p50 abaixo de 5 minutos do alerta ao briefing Slack |
| 20 | Explicabilidade | Cada hipótese tem caminhos no grafo e citações de telemetria |
| 15 | Completude da integração | PagerDuty, Slack, ArgoCD, Prometheus funcionando ponta a ponta |
| **100** | | |

## Exercícios

1. Rode seu agente nos mesmos três incidentes que o DevOps Agent da AWS demonstra. Publique a comparação lado a lado. Relate onde o agente diverge.

2. Adicione uma auditoria de "quase-acerto" que marque qualquer comando que o agente *considerou* que seria destrutivo sem aprovação. Meça a taxa de quase-acertos em uma semana.

3. Troque o modelo de hipótese de Claude Sonnet 4.7 para um Llama 3.3 70B auto-hospedado. Meça o delta de acurácia de causa raiz e custo por incidente.

4. Construa um filtro causal: distinga picos correlacionados de telemetria de uma causa raiz verdadeira. Treine um pequeno classificador nos rótulos dos 20 cenários.

5. Adicione um dry-run de rollback: rollback ArgoCD contra um cluster de staging com o mesmo manifesto. Verifique o plano de rollback num cluster vivo antes do botão de aprovação no Slack.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|------------------------|------------------------|
| Grafo de conhecimento K8s | "Grafo do cluster" | Nós = objetos K8s + séries de telemetria; arestas = propriedade, agendamento, observação |
| Somente-leitura por padrão | "RBAC escopado" | Conta de serviço do agente só tem verbos get/list/describe; verbos destrutivos ficam num servidor separado atrás de aprovação |
| Log de auditoria | "Considerado vs executado" | Registro append-only de cada comando candidato, se rodou, quem aprovou |
| Ranqueamento de hipóteses | "Pontuação de evidência" | Recência × eespecificaçãoificidade × inverso do comprimento do caminho no grafo × contagem de citações |
| Card de aprovação Slack | "Portão HITL" | Mensagem Slack interativa com botões de remediação; agente não pode prosseguir até um humano clicar |
| Citação de telemetria | "Ponteiro de evidência" | Uma consulta do Prometheus, seletor do Loki ou URL de trace do Tempo que sustenta uma afirmação |
| MTTR | "Tempo até resolução" | Tempo de relógio do disparo do alerta até a recuperação do SLO |

## Leitura Complementar

- [DevOps Agent GA da AWS](https://aws.amazon.com/blogs/aws/aws-devops-agent-helps-you-accelerate-incident-response-and-improve-system-reliability-preview/) — a referência canônica de 2026
- [Solução de problemas K8s do Resolve AI](https://resolve.ai/blog/kubernetes-troubleshooting-in-resolve-ai) — referência do concorrente
- [Monitoramento semântico NeuBird](https://www.neubird.ai) — abordagem de grafo semântico
- [IA SRE Metoro](https://metoro.io) — enquadramento de produção SLO-first
- [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) — a fonte de estado do cluster
- [LangGraph](https://langchain-ai.github.io/langgraph/) — orquestrador de agente de referência
- [FastMCP](https://github.com/jlowin/fastmcp) — framework Python MCP server
- [Rollback ArgoCD](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_rollback/) — o alvo de remediação controlada
