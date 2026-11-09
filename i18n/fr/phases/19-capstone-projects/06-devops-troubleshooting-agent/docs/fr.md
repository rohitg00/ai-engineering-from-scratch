# Capstone 06  DevOps Agent de résolution des problèmes pour Kubernetes

> L'agent DevOps d'AWS est allé en GA, Resolve AI a publié ses livres de jeu K8s, NeuBird a démontré la surveillance sémantique, et Metoro a lié AI SRE aux SLO par service. La forme de production est réglée: un feu de mise en garde de la connexion Web, un agent lit la télémétrie, marche un graphique des objets K8, classe les hypothèses de cause et publie un brief Slack avec des boutons d'approbation. - Pour lire uniquement par défaut. Chaque remède est contrôlée par un humain. Cette pierre angulaire est cet agent, évalué sur 20 incidents synthétiques et comparé à l'Agent d'AWS sur trois cas partagés.

**Type:** Capstone
**Languages:** Python (agent), TypeScript (Slack integration, agent scaffold)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and MCP), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P11 · P13 · P14 · P15 · P17 · P18
**Time:** 30 hours

## Problème

Le récit de la SRE de 2025 à 2026 est devenu: " Les agents d'IA trient les incidents, les humains approuvent les remèdes. " AWS DevOps Agent, Resolve AI, NeuBird, Metoro, PagerDuty AIOps envoient tous cette forme en production. L'agent lit les métriques de Prometheus, les journaux de Loki, les traces de Tempo, les métriques kube-état et un graphique de connaissance des objets K8. Il produit une hypothèse de cause de racine classée avec des citations de télémétrie en moins de cinq minutes. Il n'exécute jamais de commandes destructives sans l'approbation humaine explicite par Slack.

La plupart du travail est de la surveillance et de la sécurité, pas de la raison. L'agent a besoin d'une surface RBAC de lecture par défaut, d'un serveur d'outils MCP durci et de journaux d'audit de chaque commande considérée par rapport à exécutée. Il doit savoir quand il est en dehors de sa profondeur et s'escalader. Et il doit fonctionner assez bon marché pour que les cascades OOM-kill ne génèrent pas une facture d'agent de 5 000 $.

## Concept

L'agent opère sur un graphique de connaissances. Les nœuds sont des objets K8 (Pod, déploiements, services, nœuds, HPA, PVC) ainsi que des sources de télémétrie (séries Prométhée, flux Loki, traces Tempo). Les bords codent la propriété (Pod -> ReplicaSet -> déploiement), la planification (Pod -> Node) et l'observation (série Pod -> Prometheus). Le graphique est maintenu à jour par une synchronisation des métriques kube-état et reéchantillonné à chaque alerte.

Lorsqu'une alerte est lancée, l'agent root cause de l'objet affecté. Il marche sur les bords, tire les tranches de télémétrie pertinentes (les 15 dernières minutes) et rédige une hypothèse. L'hypothèse est classée par des preuves: combien de citations de télémétrie la soutiennent, combien récemment, comment précis. Les 3 hypothèses les plus importantes vont à Slack avec des visualisations de graphes-path et des boutons d'approbation pour les actions de réparation.

Les actions destructives (réduction, réouverture, suppression de Pods) nécessitent l'approbation Slack; les crochets de réouverture ArgoCD nécessitent un jeton auth que l'agent ne détient jamais. Le journal d'audit enregistre chaque commande que l'agent *consideré*  pas seulement exécuté  de sorte que le processus de révision prend près de manquements.

## Architecture

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

## La pile

- Sources d'observabilité: Prometheus, Loki, Tempo, métriques de l'état de l'état
- Graphique de connaissances: Neo4j (géré) ou kuzu (intégré) d'objets K8 + bordures de télémétrie
- LangGraph avec liste d'autorisation par outil, en lecture seule par défaut
- Transports d'outils: FastMCP sur StreamableHTTP; serveur séparé pour les outils destructeurs derrière la porte d'approbation
- Modèles: Claude Sonnet 4.7 pour le raisonnement de cause de racine, Gémeaux 2.5 Flash pour la résumé du journal
- Remédiation: Retour de l'ArgoCD, accélération du service de page, carte d'approbation Slack
- Audit: journal structuré uniquement en annexe (consideré, exécuté, approuvé, résultat)
- Déploiement: déploiement des K8 avec son propre rôle de RBAC étroit; espace de nom séparé

```figure
ce-rootcause-walk
```

## Faites-le

1. **Graph ingestion.**Synchronisez les mesures de l'état de kube en Neo4j/kuzu tous les 30 ans. Nodes: Pod, déploiement, nœud, service, PVC, HPA. Arêtes: OWNED_BY, SCHEDULED_ON, EXPOSES, MOUNTS, SCALES. Arêtes de superposition de télémétrie: OBSERVED_BY (un Pod est observé par une série Prometheus).

2. **Alert receiver.**FastAPI endpoint qui accepte PagerDuty ou Alertmanager webhooks.

3. **Read-only tool surface.**Wrap kubectl, requête Prometheus, Loki logql, Tempo traceql via FastMCP. Chaque outil a un verbe RBAC étroit (" obtenir ", " liste ", " décrire "). Il n'y a pas de " supprimer ", " exécuter ", " échelle " dans le serveur par défaut.

4. **Root-cause agent.**LangGraph avec trois nœuds: `sample`tire la tranche de télémétrie des 15 dernières minutes,`walk`demande le graphique pour les objets voisins, `hypothesize`Les projets ont classé les candidats à cause de la cause principale avec des citations de télémétrie.

5. **Evidence scoring.**Chaque hypothèse a un score = récente * spécificité * longueur du chemin du graphique inverse * nombre de citations. Retournez au top-3.

6. **Slack brief.**Publier un annexe avec l'hypothèse, la visualisation du chemin graphique (une image sous-graphique rendue du côté du serveur) et les boutons d'approbation pour au plus une action de réparation.

7. **Remediation gate.**Les outils destructeurs (réduction, réouverture, suppression) sont disponibles sur un deuxième serveur MCP derrière un jeton d'approbation.

8. **Audit log.**JSONL uniquement ajouté: pour chaque commande candidate, enregistrer si elle a été considérée, si elle a été exécutée, qui l'a approuvée.

9. **Synthetic incident suite.**Construisez 20 scénarios: cascade OOMKill, flaque DNS, thrash HPA, remplissage PVC, voisin bruyant, voiture de bord défectueuse, déploiement de ConfigMap mal, rotation de certificat, retrait d'image, etc. Marquez l'agent sur la précision de la cause et le temps à l'hypothèse.

## Utilisez-le

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

## La faire partir

`outputs/skill-devops-agent.md`En raison d'un groupe K8s et d'une source d'alerte, l'agent produit des hypothèses de cause de racine classées et un flux de remise en état à la porte de la faille.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | RCA accuracy on scenario suite | ≥80% correct root cause across 20 synthetic incidents |
| 20 | Safety | Destructive-action guard never fires without Slack approval in the audit log |
| 20 | Time-to-hypothesis | p50 under 5 minutes from alert to Slack brief |
| 20 | Explainability | Every hypothesis has graph paths and telemetry citations |
| 15 | Integration completeness | PagerDuty, Slack, ArgoCD, Prometheus end-to-end working |
| **100** | | |

## Exercices

1. Retournez votre agent sur les trois mêmes incidents sur lesquels l'agent DevOps de AWS est démo, publiez-le côte à côte, rapportez où l'agent diverge.

2. Ajoutez un audit "proximité de défaut" qui marque toute commande que l'agent *consideré* aurait été destructive sans l'approbation. Mesurer le taux de près de défaut sur une semaine.

3. Changer le modèle hypothétique de Claude Sonnet 4.7 à un Llama 3.3 70B auto-hébergé. Mesurer la précision RCA delta et dollar par incident.

4. Construire un filtre de causalité: distinguer les pics de télémétrie corrélatifs d'une vraie cause profonde.

5. Ajouter un roulement à sec: Retour d'ArgoCD contre un groupe de mise en scène avec le même manifeste. Vérifiez le plan de roulement dans un groupe en direct avant le bouton d'approbation Slack.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| K8s knowledge graph | "Cluster graph" | Nodes = K8s objects + telemetry series; edges = ownership, scheduling, observation |
| Read-only-by-default | "Scoped RBAC" | Agent's service account has only get/list/describe verbs; destructive verbs live in a separate server behind approval |
| Audit log | "Considered vs executed" | Append-only record of every candidate command, whether it ran, who approved |
| Hypothesis ranking | "Evidence score" | Recency × specificity × graph-path length inverse × citation count |
| Slack approval card | "HITL gate" | Interactive Slack message with remediation buttons; agent cannot proceed until a human clicks |
| Telemetry citation | "Evidence pointer" | A Prometheus query, Loki selector, or Tempo trace URL that supports a claim |
| MTTR | "Time to resolution" | Wall-clock from alert fire to SLO recovery |

## Pour en savoir plus

- [AWS DevOps Agent GA](https://aws.amazon.com/blogs/mt/announcing-general-availability-of-aws-devops-agent/): la référence canonique 2026
- [Resolve AI K8s troubleshooting](https://resolve.ai/blog/kubernetes-troubleshooting-in-resolve-ai) la référence du concurrent
- [NeuBird semantic monitoring](https://www.neubird.ai) Approche sémantique-graphique
- [Metoro AI SRE](https://metoro.io) Cadrage de la production par SLO
- [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) la source de l'état de cluster
- [LangGraph](https://langchain-ai.github.io/langgraph/) agent de référence orchestrateur
- [FastMCP](https://github.com/jlowin/fastmcp) Framework de serveur Python MCP
- [ArgoCD rollback](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_rollback/) l'objectif de réparation fermé
