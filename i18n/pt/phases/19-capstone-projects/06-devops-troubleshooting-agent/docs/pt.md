# Capstone 06  DevOps Agente de solução de problemas para Kubernetes

> O DevOps Agent da AWS foi GA, Resolve AI publicou seus playbooks K8s, NeuBird demonstrou monitoramento semântico e Metoro ligou a AI SRE a SLOs por serviço. A forma de produção está definida: um alerta de webhook dispara, um agente lê telemetria, percorre um gráfico de objetos K8, classifica hipóteses de causa raiz e publica um breve Slack com botões de aprovação. Somente leitura por padrão. Todas as remédios controladas por um humano. Esta pedra final é o agente, avaliado em 20 incidentes sintéticos e comparado com o Agente da AWS em três casos compartilhados.

**Type:** Capstone
**Languages:** Python (agent), TypeScript (Slack integration, agent scaffold)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and MCP), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P11 · P13 · P14 · P15 · P17 · P18
**Time:** 30 hours

## Problemas

A narrativa SRE de 2025-2026 tornou-se: "Agentes de IA triagem incidentes, humanos aprovam remédios". AWS DevOps Agent, Resolve AI, NeuBird, Metoro, PagerDuty AIOps todos enviam essa forma em produção. O agente lê métricas Prometheus, registros Loki, traços Tempo, kube-estado-metricas, e um gráfico de conhecimento de objetos K8. Produz uma hipótese de causa raiz classificada com citações telemétricas em menos de cinco minutos. Nunca executa comandos destrutivos sem aprovação humana explícita através do Slack.

A maior parte do trabalho duro é escopo e segurança, não raciocínio. O agente precisa de uma superfície RBAC de leitura apenas por padrão, um servidor de ferramentas MCP endurecido e registros de auditoria de cada comando considerado versus executado. Ele precisa saber quando está fora de sua profundidade e escalar. E tem que correr barato o suficiente para que as cascadas de OOM-kill não gerem uma conta de agente de $5k.

## Conceptos

O agente opera em um gráfico de conhecimento. Os nós são objetos K8s (Pods, Deployments, Services, Nodes, HPAs, PVCs) além de fontes de telemetria (série Prometheus, fluxos Loki, traços Tempo). As bordas codificam propriedade (Pod -> ReplicaSet -> Deployment), agendamento (Pod -> Node), e observação (série Pod -> Prometheus). O gráfico é mantido fresco por uma sincronização de métricas kube-state e re-sampulado em cada alerta.

Quando um alerta dispara, o agente causa raízes do objeto afetado. Ele caminha pelas bordas, tira as fatias relevantes de telemetria (últimos 15 minutos) e elabora uma hipótese. A hipótese é classificada por evidências: quantas citações de telemetria o suportam, quão recentes, quão específicas. As três principais hipóteses vão para Slack com visualizações de gráfico-caminho e botões de aprovação para ações de remediação.

A remediação é bloqueada. Ações padrão permitidas são somente de leitura. Ações destrutivas (descalando, rolando para trás, excluindo Pods) exigem aprovação Slack; ganchos de rollback ArgoCD exigem um token auth que o agente nunca detém. O registro de auditoria registra cada comando que o agente *considerou*  não apenas executado , então o processo de revisão pega quase faltas.

## Arquitetura

```
PagerDuty / Alertmanager webhook
           |
           v
     FastAPI receiver
           |
           v
   LangGraph root-cause agent
           |
           +---- read-only MCP tools ----+
           |                             |
           v                             v
   K8s knowledge graph              telemetry slices
     (Neo4j / kuzu)              Prometheus, Loki, Tempo
   ownership + scheduling          last 15m, scoped
           |
           v
   hypothesis ranking (evidence weight)
           |
           v
   Slack brief + approval buttons
           |
           v (approved)
   ArgoCD rollback hook / PagerDuty escalate
           |
           v
   audit log: considered vs executed, every command
```

## Estaca

- Fontes de observabilidade: Prometheus, Loki, Tempo, kube-state-metrics
- Grafico de conhecimento: Neo4j (gerido) ou kuzu (embedded) de objetos K8s + bordas de telemetria
- Agente: LangGraph com lista de permissão por ferramenta, apenas para leitura por padrão
- Transporte de ferramentas: FastMCP sobre StreamableHTTP; servidor separado para ferramentas destrutivas atrás da porta de aprovação
- Modelos: Claude Sonnet 4.7 para raciocínio de raiz, Gemini 2.5 Flash para resumo de registro
- Remedição: ArgoCD rollback webhook, PagerDuty escalate, Slack cartão de aprovação
- Auditoria: registro estruturado apenas apêndice (considerado, executado, aprovado, resultado)
- Deploição: implantação de K8s com seu próprio papel de RBAC estreito; espaço de nome separado

```figure
ce-rootcause-walk
```

## Construí-lo

1. **Graph ingestion.**Sincronize kube-state-metrics para Neo4j/kuzu a cada 30 anos. Nodos: Pod, Deployment, Node, Service, PVC, HPA. Arredores: OWNED_BY, SCHEDULED_ON, EXPOSES, MOUNTS, SCALES. Arredores de superposição de telemetria: OBSERVED_BY (um Pod é observado por uma série Prometheus).

2. **Alert receiver.**Endpoint FastAPI que aceita PagerDuty ou Alertmanager webhooks. Extrair os objetos afetados (s) e violação SLO.

3. **Read-only tool surface.**Wrap kubectl, consulta Prometheus, Loki logql, Tempo traceql através FastMCP. Cada ferramenta tem um verbo RBAC estreito (" obter", " lista ", " descrever ").

4. **Root-cause agent.**LangGraph com três nós: `sample`Põe a última 15 minutos de telemetria,`walk`Queria o gráfico para objetos vizinhos,`hypothesize`Os projectos classificaram os candidatos por causa raiz com citações telemétricas.

5. **Evidence scoring.**Cada hipótese tem uma pontuação = recência * especificidade * comprimento do gráfico-caminho inverso * contagem de citações.

6. **Slack brief.**Coloque um anexo com a hipótese, a visualização do caminho gráfico (uma imagem subgrafica renderizada do lado do servidor) e botões de aprovação para no máximo uma ação de remediação.

7. **Remediation gate.**Ferramentas destrutivas (descansar, reverter, excluir) vivem em um segundo servidor MCP atrás de um token de aprovação.

8. **Audit log.**JSONL somente adicionado: para cada comando candidato, registre se foi considerado, se foi executado, quem o aprovou. Enviar para S3 diariamente.

9. **Synthetic incident suite.**Construa 20 cenários: cascata OOMKill, flap DNS, HPA thrash, PVC preenchimento, barulho vizinho, carro lateral defeituoso, configuração de ConfigMap ruim, rotação de certificado, retorno de imagem, etc. Ponha o agente em precisão de causa raiz e tempo-para-hipótese.

## Usá-lo

```
webhook: alert.pagerduty.com -> checkout-api SLO breach, error rate 14%
[graph]   affected: Deployment checkout-api (3 Pods, Node ip-10-2-3-4)
[walk]    neighbors: ReplicaSet checkout-api-abc, Service checkout-api,
           recent rollout 14m ago
[sample]  prometheus error_rate 14%, up-trend; loki 500s on /api/v2/pay
[hypo]    #1 bad rollout: latest image checkout-api:v2.41 fails /healthz
          citations: deploy.yaml (rev 42), prometheus errorRate, loki 500 stack
[slack]   [ROLL BACK to v2.40]  [ESCALATE]  [IGNORE]
          (approval required; agent does not roll back unilaterally)
```

## Envia-o

`outputs/skill-devops-agent.md`Dado um grupo K8s e fonte de alerta, o agente produz hipóteses de causa raiz classificada e um fluxo de remediação Slack-gated.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | RCA accuracy on scenario suite | ≥80% correct root cause across 20 synthetic incidents |
| 20 | Safety | Destructive-action guard never fires without Slack approval in the audit log |
| 20 | Time-to-hypothesis | p50 under 5 minutes from alert to Slack brief |
| 20 | Explainability | Every hypothesis has graph paths and telemetry citations |
| 15 | Integration completeness | PagerDuty, Slack, ArgoCD, Prometheus end-to-end working |
| **100** | | |

## Exercícios

1. Execute o seu agente nos mesmos três incidentes em que o agente DevOps da AWS está em demonstração, publica o lado a lado, informa onde o agente diverge.

2. Adicione uma auditoria "quase-miss" que sinaliza qualquer comando que o agente *considerou* que teria sido destrutivo sem aprovação.

3. Troque o modelo de hipótese de Claude Sonnet 4.7 para um Llama 3.3 70B auto-host. Messa a precisão RCA delta e dólar por incidente.

4. Construir um filtro causal: distinguir picos de telemetria correlacionados de uma causa raiz verdadeira. Treinar um pequeno classificador nas etiquetas de 20 cenários.

5. Adicionar um rollback dry run: ArgoCD rollback contra um cluster de fase com o mesmo manifesto. Verifique o plano de rollback em um cluster ao vivo antes do botão Slack de aprovação.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| K8s knowledge graph | "Cluster graph" | Nodes = K8s objects + telemetry series; edges = ownership, scheduling, observation |
| Read-only-by-default | "Scoped RBAC" | Agent's service account has only get/list/describe verbs; destructive verbs live in a separate server behind approval |
| Audit log | "Considered vs executed" | Append-only record of every candidate command, whether it ran, who approved |
| Hypothesis ranking | "Evidence score" | Recency × specificity × graph-path length inverse × citation count |
| Slack approval card | "HITL gate" | Interactive Slack message with remediation buttons; agent cannot proceed until a human clicks |
| Telemetry citation | "Evidence pointer" | A Prometheus query, Loki selector, or Tempo trace URL that supports a claim |
| MTTR | "Time to resolution" | Wall-clock from alert fire to SLO recovery |

## Mais leitura

- [AWS DevOps Agent GA](https://aws.amazon.com/blogs/mt/announcing-general-availability-of-aws-devops-agent/): a referência canónica de 2026
- [Resolve AI K8s troubleshooting](https://resolve.ai/blog/kubernetes-troubleshooting-in-resolve-ai) a referência do concorrente
- [NeuBird semantic monitoring](https://www.neubird.ai) abordagem semântica-grafico
- [Metoro AI SRE](https://metoro.io) Estruturação de produção SLO-first
- [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) a fonte do estado do cluster
- [LangGraph](https://langchain-ai.github.io/langgraph/) Agente de referência orquestrante
- [FastMCP](https://github.com/jlowin/fastmcp) Framework de servidores Python MCP
- [ArgoCD rollback](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_rollback/) o objectivo de recuperação de problemas
