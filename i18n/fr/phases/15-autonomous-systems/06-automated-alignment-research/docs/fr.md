# La recherche automatisée sur l'alignement (ARAnthropic AAR)

> Anthropic a dirigé des équipes parallèles de chercheurs d'alignement autonome Claude Opus 4.6 dans des boîtes de sable indépendantes, se coordonnant via un forum partagé dont les journaux vivent en dehors de n'importe quelle boîte de sable (donc les agents ne peuvent pas supprimer leurs propres enregistrements). Sur le problème de la formation faible à forte, les AAR ont dépassé les chercheurs humains. Les propres drapeaux de synthèse d'Anthropic qui prescrivaient des flux de travail limitent souvent la flexibilité de l'AAR et dégradent les performances. La recherche automatisée sur l'alignement comprime la chronologie et le fait sur les mêmes risques de désalignement que le SPR est destiné à détecter.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, parallel-research-forum simulator)
**Prerequisites:** Phase 15 · 05 (AI Scientist v2), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## Le problème

La recherche d'alignement est coûteuse dans le temps de l'homme-chercheur. Les problèmes comme la surveillance évolutive, la spécification de la récompense ou la formation faible à forte nécessitent des expériences qui prennent des semaines par itération.

La recherche sur l'alignement automatisé (AAR) demande si les mêmes modèles frontaliers dont la capacité dépasse l'alignement peuvent contribuer à combler le fossé. Le rapport 2026 d'Anthropic sur une étude de formation faible à forte menée par AAR (alignment.anthropic.com/2026/automated-w2s-researcher/) est l'un des premiers résultats publics d'un système déployé de cette classe.

Le résultat est vraiment positif: les AAR ont résolu un problème de recherche mieux que la ligne de base humaine. Le résultat concentre également, dans un seul système, toutes les préoccupations que cette phase a développées. Si la recherche d'alignement peut être automatisée, les pièces qui compromettent les garanties peuvent également. Les seuils de la capacité de R&D de l'IA sont écrits en tenant compte de cette boucle.

## Le concept

### L'architecture (comme décrit publiquement)

- **Parallel agents.**Plusieurs instances de Claude Opus 4.6 fonctionnent sous forme d'AAR, chacune dans une boîte à sable indépendante.
- **Shared forum.**Les résultats sont publiés sur un forum partagé dont le stockage est situé à l'extérieur de chaque boîte à sable.
- **Task allocation.**Une file d'attente de tâches conçue par l'homme attribue des problèmes de recherche aux AAR.
- **Weak-to-strong training focus.**L'étude publiée a porté sur la formation de faible à fort en utilisant un modèle de superviseur plus faible pour former un modèle d'étudiant plus fort.

### Pourquoi le journal de la sable est important

La propriété de l'intégrité du journal est la différence entre une expérience contrôlée et une expérience potentiellement compromise. Si les AAR pouvaient modifier leurs propres journaux, ils pourraient couvrir les expériences ratées ou douteuses.

L'analogue en termes d'infrastructure est les journaux d'ajout uniquement avec écriture à travers le stockage externe (par exemple S3 objet-blocage, immuable Datadog journaux). L'agent n'a pas de carte d'identité pour modifier les enregistrements passés. C'est le même schéma que 2026 équipes de sécurité d'entreprise utilisent pour faire des pistes d'audit résistantes aux ransomware.

### Le décalage des flux de travail prescrit

Le rapport d'Anthropic note que les flux de travail prescrits limitent souvent la flexibilité de l'AAR et dégradent les performances. En d'autres termes: si le concepteur humain écrit le plan de recherche étape par étape, les AAR fonctionnent pire que si on leur donnait des objectifs de haut niveau et la liberté de se décomposer. Cela est conforme aux résultats de la recherche agentique (LangGraph, le cadre d'agents de Microsoft).

La flexibilité qui améliore les performances de l'AAR est aussi la flexibilité qui permet une décomposition non sanctionnée, une utilisation d'outils novateurs et une dérive de but.

### Le risque de compression

RSP v3.0 (Létion 19) introduit un seuil de capacité de R&D d'IA: la capacité d'automatiser complètement le pipeline de R&D d'IA à un coût compétitif contre les outils humains + AI. FSF v3 de DeepMind inclut un niveau d'autonomie ML analogique.

L'AAR est un pas en arrière du seuil: elle automatise une partie du pipeline (recherche d'alignement sur des tâches spécifiques bien élaborées) mais pas la boucle de développement de capacités de bout en bout.

Les délais comprimés sont le problème de l'échec de la composition. Si la recherche sur l'alignement et la recherche sur les capacités se combinent à des taux similaires, la surface de risque de désalignement augmente au moins aussi rapidement que la capacité. Si la capacité se compose plus rapidement (la tendance historique), l'écart s'élargit. C'est l'argument pour que l'AAR soit un bien qualifié: chaque résultat d'alignement supplémentaire réduit l'écart si et seulement si le processus de recherche est digne de confiance.

### Ce que l'AAR ne remplace pas

Les chercheurs humains définissent la file d'attente des tâches, examinent les résultats et détiennent l'autorité constitutionnelle. Les AAR accélèrent le milieu du pipeline, et non les fins. Les résultats publiés d'Anthropic comprennent à la fois les contributions AAR et le jugement humain-chercheur sur ce qu'il faut publier, ce qu'il faut retirer et ce qu'il faut affiner.

Cela correspond au modèle proposer-et-committer de la leçon 15 appliqué à la recherche elle-même: les AAR proposent; les humains s'engagent.

```figure
aar-forum
```

## Utilisez-le

`code/main.py`Il est également possible de créer des "recherches" sur des sites de recherche qui permettent de créer des informations sur les résultats de recherche.

Regardez !

- Comment la détection hors de la boîte à sable capture les tentatives de manipulation du tronc.
- Comment l'allocation des tâches avec décomposition libre surpasse les flux de travail fixes sur des problèmes plus difficiles.
- Comment une seule ARA compromise peut contaminer le signal du forum si le journal n'est pas falsifié.

## La faire partir

`outputs/skill-aar-deployment-review.md`est un examen préalable au déploiement d'un pipeline de recherche automatisé d'alignement.

## Exercices

1. On court .`code/main.py`. Comparer les paramètres " flux de travail fixe " et " décomposition libre ".

2. Modifiez le simulateur pour qu'un agent tente de manipuler le journal. Confirmez que le journal de la seule pièce jointe le détecte. Écrivez un paragraphe décrivant exactement à quoi ressemble la signature de détection dans le journal.

3. Lisez le rapport de l'AAR de faible à fort de l'Anthropic. Identifiez la sous-tâche spécifique sur laquelle les AAR ont battu les chercheurs humains.

4. Développez une politique d'allocation des tâches en queue qui équilibre la flexibilité des AAR (meilleurs résultats) avec les contraintes prescrites du flux de travail (audit plus facile).

5. Lisez le seuil de R&D-4 de l'IA de RSP v3.0. Dans un paragraphe, décrivez ce que vous pensez qu'il traverserait que l'AR ne fait pas actuellement.

## Les termes clés

| Term | What people say | What it actually means |
|---|---|---|
| AAR | "Automated Alignment Researcher" | Claude Opus 4.6 instance operated autonomously on alignment problems |
| Weak-to-strong training | "Training a stronger model with a weaker supervisor" | Classic scalable-oversight benchmark AARs outperformed humans on |
| Shared forum | "Where agents publish findings" | Append-only, out-of-sandbox storage |
| Out-of-sandbox log | "Agent cannot edit its own record" | Tamper-evident write-through to external storage |
| Prescribed workflow | "Step-by-step plan from human designer" | Constrains AAR; often degrades performance vs free decomposition |
| Free decomposition | "Agent decides how to break the task" | More capable, harder to audit |
| AI R&D threshold | "RSP/FSF capability level" | Full automation of R&D pipeline at competitive cost |
| Compressed timeline | "Alignment vs capability race" | If capability compounds faster than alignment, misalignment risk grows |

## Pour en savoir plus

- [Anthropic — Automated Weak-to-Strong Researcher](https://alignment.anthropic.com/2026/automated-w2s-researcher/) source principale.
- [Anthropic Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) Cadrage des seuils de R&D en IA.
- [Anthropic — Measuring AI agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) un cadre plus large de l'autonomie des agents.
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) ML niveaux d'autonomie de R&D parallèles à la RSP.
- [Burns et al. (2023). Weak-to-Strong Generalization (OpenAI)](https://openai.com/index/weak-to-strong-generalization/) le problème sous-jacent attaqué par les AAR.
