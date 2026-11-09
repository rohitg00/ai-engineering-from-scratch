# Ingénierie du chaos pour la production de LLM

> L'ingénierie du chaos pour les LLM est sa propre discipline en 2026. Pré-requis avant la réalisation d'expériences en production: SLI/SLO définie, trace+metric+log observabilité, retour automatique, runbooks, en appel. L'architecture a quatre plans: contrôle (programateur d'expérience), cible (services, infra, stockage de données), sécurité (gardiens + interruption + filtres de trafic), observabilité (métres + traces + journaux), rétroaction (dans les ajustements SLO). Les barreaux de protection sont obligatoires: les alertes de taux de brûlure arrêtent les expériences si la brûlure quotidienne d'erreur-budget est prévue > 2 fois; fenêtres de suppression + correlation de trace-ID déduction de bruit d'alerte. Cadence: révision hebdomadaire des petits canaris + SLO; jour de jeu mensuel + post mortem; audit trimestriel de la résilience entre équipes + cartographie de la dépendance. Experiments spécifiques à la LLM: surcharge de mémoire, défaillances réseau, coupures de fournisseurs, messages malformés, tempêtes d'évacuation de cache KV. Les outils: Harness Chaos Engineering (récommandations dérivées du LLM, réduction du rayon d'explosion, intégration des outils MCP); LitmusChaos (CNCF); Chaos Mesh (CNCF Kubernetes-native).

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy chaos experiment runner)
**Prerequisites:** Phase 17 · 23 (SRE for AI), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Nombre des cinq prérequis de l'ingénierie du chaos (SLI/SLO, observabilité, réouverture, runbooks, on-call) et explique pourquoi sauter n'importe quelle pratique est une violation de la pratique.
- Décrire les quatre plans (contrôle, cible, sécurité, observabilité) et la boucle de rétroaction dans le SLO.
- Enumérez cinq expériences spécifiques à la LLM (surchargement de mémoire, défaillance du réseau, panne du fournisseur, prompt malformé, tempête d'évacuation de KV).
- Choisissez un outil  Harness, LitmusChaos, Chaos Mesh  donné pile.

## Le problème

Les stacks LLM ajoutent de nouveaux modes d'échec. Un prompt de jeton 4K avec un caractère toxique arrête le jeton pendant 12 secondes. Un fournisseur en amont 429s; vos entrées de retrait; vos OOMs de service sur la simultanée amplifiée à la répétition. Une tempête d'évacuation de cache KV sous charge de débordement provoque des cascades de remplissage qui saturent le calcul.

Aucun de ces tests n'apparaît dans les tests unitaires.

## Le concept

### Préalabilités

Ne provoquez pas de chaos dans la production sans:

1. **SLI/SLO** définir des indicateurs et des objectifs de niveau de service.
2. **Observability** Traces, métriques, journaux, câblées à des tableaux de bord.
3. **Automated rollback** Phase 17 · 20 - Réouverture du programme de politique de réforme.
4. **Runbooks** structurée, phase 17 · 23.
5. **On-call** quelqu'un pour répondre.

Le manque de tout moyen, le chaos devient un véritable incident.

### Quatre avions + rétroaction

**Control plane** programmeur d'expériences (flux de travail Litmus, programme Chaos Mesh, interface utilisateur Harness).

**Target plane** services, capsules, nœuds, équilibrateurs de charge, stockage de données.

**Safety plane** commutateur de compression, fenêtres de suppression, limites de rayon d'explosion, portes de budget d'erreur.

**Observability plane** des mesures normales + corrélation trace-ID pour distinguer les défaillances induites par le chaos des défaillances naturelles.

**Feedback loop** Les résultats se rapportent à l'ajustement du SLO, aux mises à jour des coordonnées, aux corrections de code.

### Les barreaux sont obligatoires

- **Burn-rate alert**: l'expérience de pause si le budget d'erreur quotidien dépasse le double prévu.
- **Suppression windows**: silence des alertes non expérimentales dans le rayon d'explosion pendant l'expérience.
- **Trace-ID correlation**: toutes les erreurs induites par l'expérience sont marquées de manière à pouvoir être déduites sur appel.

### Cinq expériences spécifiques à la LLM

1. **Memory overload** forcer une tempête de préemption de cache KV en envoyant des requêtes de long contexte avec une grande simultanéité.

2. **Network failure** coupure de connectivité entre la passerelle d'inférence et le fournisseur.

3. **Provider outage simulation** 100% 429 de OpenAI. Observez: le routage fait-il une défaillance vers Anthropic? (phase 17 · 16, 19)

4. **Malformed prompt** injecter une charge utile pour l'installation de jetons (par exemple, unicode profondément niché, un codepoint UTF-8 énorme).

5. **KV eviction storm** expulsion forcée par saturation du budget de bloc VLLM. Observez: le LMCache se rétablit-il ou le service se dégrade-t-il?

### Cadence

- **Weekly** petites expériences canaries en mise en scène, peut-être 5% de prod.
- **Monthly** jour de jeu prévu dans un scénario spécifique; présence entre équipes; post mortem.
- **Quarterly** Audit de la résilience entre équipes; mise à jour de la carte de la dépendance.

### Les outils

- **Harness Chaos Engineering** commercial; recommandations d'expériences dérivées de l'IA; réduction de l'échelle du rayon d'explosion; intégration des outils MCP.
- **LitmusChaos** Gradué du CNCF; basé sur le flux de travail Kubernetes.
- **Chaos Mesh** Sandbox CNCF; style CRD natif des Kubernètes.
- **Gremlin** commercial; large soutien.
- **AWS FIS**- Je suis là .**Azure Chaos Studio** Offres gérées dans le cloud.

### Commencez petit

Première expérience: décodez une copie sous un trafic constant, observez le redirigement et la récupération, si cela fonctionne et semble sûr, passez au chaos du réseau.

Première expérience spécifique à la LLM: injecter un fournisseur 429 pendant 5 minutes. Observez le retrait. La plupart des équipes découvrent que leur retrait n'a pas été entièrement testé.

### Les chiffres que vous devriez vous rappeler

- Quatre avions: contrôle, cible, sécurité, observabilité.
- Pause de taux de brûlure: 2 fois le budget quotidien prévu.
- Cadence: canary hebdomadaire, jour de jeu mensuel, audit trimestriel.
- Cinq expériences de LLM: mémoire, réseau, fournisseur, prompt malformé, KV tempête.

```figure
i4-chaos-guard
```

## Utilisez-le

`code/main.py`Il simule trois expériences de chaos avec des portes de sécurité, qui pourraient faire trébucher le taux de brûlure.

## La faire partir

Cette leçon produit `outputs/skill-chaos-plan.md`- Compte tenu de sa taille et de sa maturité, il choisit les trois premières expériences et l'outillage.

## Exercices

1. On court .`code/main.py`Quelle expérience défonce la porte de la vitesse de combustion et pourquoi ?
2. Conceptez les cinq premières expériences de chaos pour un service RAG basé sur vLLM. Incluez des critères de réussite.
3. Votre alerte a interrompu une expérience.
4. Discutez si le chaos doit se produire dans la production ou seulement en scène.
5. Nombre de trois modes de défaillance spécifiques à la MLL que le chaos du réseau générique ne peut reproduire.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| SLI / SLO | "service targets" | Indicator + objective; required prerequisite |
| Blast radius | "scope" | Set of services / users affected by experiment |
| Burn-rate alert | "budget gate" | Fires when error-budget burn rate > 2x expected |
| Game day | "monthly drill" | Scheduled cross-team chaos exercise |
| LitmusChaos | "CNCF workflow" | Graduated CNCF Kubernetes chaos tool |
| Chaos Mesh | "CNCF CRD" | CNCF sandbox Kubernetes-native chaos |
| Harness CE | "commercial AI-assisted" | Harness chaos with AI recommendations |
| Malformed prompt | "tokenizer bomb" | Input that stalls tokenization |
| KV eviction storm | "preemption cascade" | Mass eviction triggering re-prefills |

## Pour en savoir plus

- [DevSecOps School — Chaos Engineering 2026 Guide](https://devsecopsschool.com/blog/chaos-engineering/)
- [Ankush Sharma — Observability for Large Language Models (Apress, 2026)](https://link.springer.com/book/10.1007/979-8-8688-2827-0)
- [LitmusChaos (CNCF)](https://litmuschaos.io/)
- [Chaos Mesh (CNCF)](https://chaos-mesh.org/)
- [Harness Chaos Engineering](https://www.harness.io/products/chaos-engineering)
- [AWS FIS](https://aws.amazon.com/fis/)
