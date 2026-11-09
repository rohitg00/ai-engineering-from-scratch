# Les modes d'échec: pourquoi les agents se débandent

> MASFT (Berkeley, 2025) catalogue 14 modes de défaillance multi-agents dans 3 catégories. La taxonomie de Microsoft documente comment les défaillances existantes de l'IA s'amplifient dans les paramètres agence. Les données du domaine de l'industrie convergent sur cinq modes récurrents: actions hallucinées, glissement de portée, erreurs en cascade, perte de contexte, mauvaise utilisation des outils.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 05 (Self-Refine and CRITIC), Phase 14 · 24 (Observability)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Nommer les trois catégories de défaillance du MASFT et au moins quatre modes spécifiques dans chacune d'elles.
- Expliquez pourquoi l'échec agentrique amplifie les modes d'échec existants de l'IA (bias, hallucinations).
- Décrivez les cinq modes récurrents dans l'industrie et leurs atténuations.
- Implémenter un détecteur stdlib qui trace les étiquettes de l'agent avec des étiquettes de mode défaillance.

## Le problème

Les équipes envoient des agents qui travaillent sur 90% des traces. Les défaillances de 10% ne sont pas du bruit aléatoire  ils tombent dans un petit nombre de catégories récurrentes. Une fois que vous pouvez les nommer, vous pouvez les surveiller et les corriger.

## Le concept

### Les résultats de l'enquête ont été obtenus au cours de la première année de l'enquête.

La taxonomie des défaillances du système multi-agents. 14 modes de défaillance regroupés en 3 catégories.

L'affirmation centrale: les défaillances sont des défaillances de conception fondamentales dans les systèmes multi-agents, et non des limites de la MLL à corriger avec de meilleurs modèles de base.

### Taxonomie de Microsoft du mode d'échec dans les systèmes d'IA agencés

- Les défaillances existantes de l'IA (bias, hallucinations, fuites de données) se amplifient dans les paramètres agents.
- De nouveaux échecs émergent de l'autonomie: action involontaire à grande échelle, utilisation abusive des outils, dérive de mission.
- Le livre blanc est le registre des risques pour les produits agencés.

### Caractériser les défauts de l'IA agentique (arXiv:2603.06847)

- Les échecs résultent de l'orchestration, de l'évolution de l'état interne et de l'interaction environnementale.
- Pas seulement "mauvais code" ou "mauvais modèle de sortie".

### Enquête sur les hallucinations d'agents de la LLM (arXiv:2509.18970)

Deux manifestations principales:

1. **Instruction-following Deviation**L'agent ne suit pas les instructions du système.
2. **Long-range Contextual Misuse** l'agent oublie ou utilise mal le contexte des virages précédents.

Erreurs de sous-intention: omission (pas de étape), redondance (étape répétée), désordre (étapes hors ordre).

### Les cinq modes récurrents dans l'industrie

Les analyses de terrain d'Arize, Galileo et NimbleBrain 2024-2026 convergent sur:

1. **Hallucinated actions.**L'agent invoque un outil qui n'existe pas ou fabrique des arguments.
2. **Scope creep.**L'agent élargit la tâche au-delà de la demande de l'utilisateur (crée des relations publiques supplémentaires, envoie des courriels supplémentaires).
3. **Cascading errors.**Un faux appel déclenche des effets en aval. Une hallucination fantôme SKU déclenche quatre appels API  un incident multi-système.
4. **Context loss.**Les tâches à long horizon oublient les contraintes de tour en début de journée.
5. **Tool misuse.**Appelle le bon outil avec les mauvais arguments, ou le mauvais outil entièrement.

Les agents ne peuvent pas distinguer "j'ai échoué" de "la tâche est impossible" et hallucinent souvent un message de succès sur 400 erreurs pour fermer la boucle.

### L'atténuation: portes à chaque étape

Ports de vérification automatisés à chaque étape d'une chaîne de raisonnement, vérifiant la base factuelle par rapport à l'état de l'environnement.

- Classifiateur de sécurité par étape (leçon 21).
- Validation des arguments d'appel à l'outil (leçon 06).
- Contrôle croisé des contenus récupérés par rapport à des faits connus (leçon 05, CRITIC).
- Détecter les hallucinations de succès en réessayant l'état (le fichier a-t-il été créé?).

### Où le contrôle des défaillances va mal

- **Tagging only crashes.**La plupart des défaillances d'agents produisent une sortie valide.
- **No baseline.**La détection de la dérive a besoin d'un dernier bien connu; sans elle, vous ne pouvez pas dire "cela s'aggrave".
- **Over-alerting.**Chaque défaillance produit une page, un cluster et une limite de taux.

```figure
failure-cascade
```

## Faites-le

`code/main.py`met en œuvre un étiquetage de mode d'échec stdlib:

- Un ensemble de données de traces synthétiques couvrant les cinq modes.
- Les fonctions du détecteur par mode (patterns de signature des appels à l'outil, sorties, répétitions d'actions).
- Un étiquetage qui étiquette chaque trace et rapporte la distribution de mode.

- Je vais le faire.

```
python3 code/main.py
npx tsx code/main.ts
```

Produit: étiquettes par trace + distribution agrégée, une reproduction bon marché de ce que les surfaces de clustering de trace de Phoenix.

## Utilisez-le

- **Phoenix**pour le regroupement des dérives de production (leçon 24).
- **Langfuse**pour la répétition de session + annotation.
- **Custom**pour les signatures spécifiques à un domaine que votre plateforme d'observabilité ne peut pas détecter.

## La faire partir

`outputs/skill-failure-detector.md`génère des détecteurs de mode d'échec adaptés à votre domaine, câblés à un magasin de traces.

## Exercices

1. Ajouter un détecteur pour "hallucination réussie": l'agent renvoie le succès mais l'état cible est inchangé.
2. Étiquettez 100 traces réelles d'un produit que vous avez construit. Quel mode domine?
3. Mettre en œuvre une métrique de "radius de cascade": compte tenu d'une défaillance à l'étape N, combien d'étapes en aval a-t-elle affectées?
4. Lisez les 14 modes de défaillance de MASFT, choisissez trois qui s'appliquent à votre produit, écrivez des détecteurs.
5. Le câblage d'un détecteur dans un travail d'informatique: défaillance de la construction si >=5% des traces étiquetent un mode.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MASFT | "Multi-agent failure taxonomy" | Berkeley 14-mode categorization |
| Cascading error | "Ripple failure" | One early mistake propagates through N steps |
| Context loss | "Forgot the constraint" | Long-horizon turn drops early-turn facts |
| Tool misuse | "Wrong tool / wrong args" | Valid call, wrong invocation |
| Success hallucination | "Faked completion" | Agent claims success on a 400; state unchanged |
| Scope creep | "Overreach" | Agent does more than asked |
| Instruction-following deviation | "Disobedience" | Ignores system prompt or user constraint |
| Sub-intention errors | "Plan bugs" | Omission, redundancy, disorder in plan execution |

## Pour en savoir plus

- [Cemri et al., MASFT (arXiv:2503.13657)](https://arxiv.org/abs/2503.13657) 14 modes de défaillance, 3 catégories
- [Microsoft, Taxonomy of Failure Mode in Agentic AI Systems](https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/microsoft/final/en-us/microsoft-brand/documents/Taxonomy-of-Failure-Mode-in-Agentic-AI-Systems-Whitepaper.pdf) registre des risques
- [Arize Phoenix](https://docs.arize.com/phoenix) Clustering à la dérive dans la pratique
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) lorsque les modèles plus simples évitent complètement les modes
