# Les points de référence: WebArena et OSWorld

> WebArena teste la capacité d'agent Web sur quatre applications auto-hébergées. OSWorld teste la capacité d'agent de bureau sur Ubuntu, Windows, macOS. À la sortie (20232024) les deux ont montré un grand écart entre les meilleurs agents de classe et les humains.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 19 (SWE-bench, GAIA)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Décrivez les quatre applications auto-hébergées de WebArena et pourquoi l'évaluation basée sur l'exécution est importante.
- Expliquez pourquoi OSWorld utilise des captures d'écran réelles du système d'exploitation au lieu des API d'accessibilité.
- Nombre des deux modes de défaillance OSWorld principaux: la mise à terre de l'interface graphique et les connaissances opérationnelles.
- Résumez ce que les systèmes OSWorld-G et OSWorld-Human ajoutent au niveau de référence de base.

## Le problème

Les agents généralistes peuvent appeler des outils. Pouvent-ils faire un navigateur à 20 clics pour effectuer une vérification de magasinage? Pouvent-ils configurer une boîte Linux en utilisant uniquement le clavier et la souris?

## Le concept

### Le projet de développement de l'entreprise est prévu pour la période de référence.

- 812 tâches à long horizon sur quatre applications Web auto-hébergées: un site de magasinage, un forum, un outil de développement comme GitLab, un CMS d'entreprise.
- Plus des utilitaires: carte, calculatrice, scratchpad.
- L'évaluation est basée sur l'exécution via des API de gymnase  a-t-elle été passée, le problème a-t-il été fermé, la page CMS a-t-elle été mise à jour?
- À la sortie: le meilleur agent GPT-4 atteint 14,41% de succès contre 78,24% chez l'homme.

Les cadres auto-hébergés sont importants  le critère de référence n'est pas flou parce que les applications cibles sont fixées et reproduisables.

### Extensions

- **VisualWebArena** des tâches basées sur des données visuelles où le succès dépend de l'interprétation des images (captures d'écran comme observations de première classe).
- **TheAgentCompany**(Dec 2024)  ajoute le terminal + le codage; plus comme un véritable environnement de travail à distance.

### OSWorld (Xie et coll., NeurIPS 2024)

- 369 tâches réelles sur ordinateur sur Ubuntu, Windows, macOS.
- Contrôle de clavier et de souris de form libre d'applications réelles.
- 1920×1080 captures d'écran comme observation.
- Au moment de la sortie: meilleur modèle 12,24% contre humain 72,36%.

### Mode de défaillance primaire

1. **GUI grounding.**Le modèle a du mal à localiser les éléments de l'interface utilisateur de manière fiable en 1920×1080.
2. **Operational knowledge.**Quel menu a le réglage, quel raccourci clavier, quel panneau de préférence.

### Suivi des mesures

- **OSWorld-G** 564 échantillons de la suite de mise à terre + Jedi formation ensemble.
- **OSWorld-Human** des trajectoires d'action de l'or sélectionnées manuellement.

### Pourquoi cela importe ?

Claude utilisation de l'ordinateur, OpenAI CUA, Gemini 2.5 utilisation de l'ordinateur (leçon 21) tous entraînés sur des charges de travail façonnées par WebArena et OSWorld.

### Lorsque l'analyse comparative se trompe

- **Screenshot-only evals.**OSWorld est basé sur des captures d'écran; l'évaluation d'un agent qui utilise des API DOM ou d'accessibilité sur OSWorld manque le défi de mise à terre.
- **Ignoring trajectory length.**Le score de succès ne fait que rater les 1,4-2,7 fois l'inefficacité des étapes OSWorld-Human surfaces.
- **Stale self-hosted apps.**Les applications WebArena sont en version spécifique; la mise à jour sans récuration rompt la comparabilité.

```figure
ae-agent-human-gap
```

## Faites-le

`code/main.py`met en place un harnais de jouets avec agent web:

- Une machine d'état "applications de magasinage" minimale: liste_articles, add_to_cart, paiement.
- Des trajectoires en or pour 3 tâches.
- Un agent avec un script qui tente chaque tâche.
- Évaluateur basé sur l'exécution (contrôle d'état) et métrique de l'efficacité de la trajectoire (étapes contre or).

- Je vais le faire.

```
python3 code/main.py
npx tsx code/main.ts
```

Résultats: taux de réussite par tâche et efficacité de la trajectoire, en suivant la méthodologie d'OSWorld-Human.

## Utilisez-le

- **WebArena Verified**auto-hébergé sur un cluster interne pour une évaluation continue.
- **OSWorld**dans une flotte de machines virtuelles pour les agents de bureau.
- **Computer-use agents**(Léction 21) Claude, OpenAI CUA, Gémeaux sont tous formés à des tâches comme celle-ci.
- **Your own product flows** capturer des trajectoires d'or pour vos 20 principales tâches; exécuter des agents contre eux chaque semaine.

## La faire partir

`outputs/skill-web-desktop-harness.md`construit un harnais d'agent web/desktop avec une évaluation et une métrique d'efficacité de trajectoire basées sur l'exécution.

## Exercices

1. Élargir le harnais de jouets avec une deuxième application (un forum).
2. Ajouter des rapports d'efficacité par tâche.
3. La méthode de l'or ne peut pas être utilisée.
4. Comment sépareriez-vous les échecs de mise à terre des échecs de planification dans vos propres évaluations ?
5. Qu'est-ce qui se passe quand vous mettez à jour une version de l'application enfoncée ?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| WebArena | "Web agent benchmark" | 812 tasks across 4 self-hosted apps; gym-style evaluation |
| VisualWebArena | "Visual WebArena" | Visually grounded WebArena; screenshots are observations |
| OSWorld | "Desktop agent benchmark" | 369 tasks on real Ubuntu/Windows/macOS |
| GUI grounding | "Pixel-to-element mapping" | Model localizing UI elements in 1920x1080 |
| Operational knowledge | "OS know-how" | Which menu, which shortcut, which preference pane |
| OSWorld-G | "Grounding suite" | 564 grounding-only samples + training set |
| OSWorld-Human | "Gold trajectories" | Manual expert action sequences to measure efficiency |
| Trajectory efficiency | "Steps over gold" | Agent step count divided by human minimum |

## Pour en savoir plus

- [Zhou et al., WebArena (arXiv:2307.13854)](https://arxiv.org/abs/2307.13854) Un référentiel web de quatre applications
- [Xie et al., OSWorld (arXiv:2404.07972)](https://arxiv.org/abs/2404.07972) référence de bureau cross-OS
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) La capacité de Claude en forme de référence
- [OpenAI, Computer-Using Agent](https://openai.com/index/computer-using-agent/) Numéros OSWorld et WebArena
