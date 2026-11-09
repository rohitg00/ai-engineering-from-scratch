# Bibliothèques de compétences et apprentissage tout au long de la vie (Voyager)

> Voyager (Wang et al., TMLR 2024) traite le code exécutable comme une compétence. Les compétences sont nommées, récupérables, comptables et affinées par les commentaires environnementaux.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 07 (MemGPT), Phase 14 · 08 (Letta Blocks)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Nommez les trois composants de Voyager  programme d'études automatique, bibliothèque de compétences, incitation itérative  et le rôle de chacun.
- Expliquez pourquoi Voyager fait le code de l'espace d'action, pas les commandes primitives.
- Implémenter une bibliothèque de compétences stdlib avec enregistrement, récupération, composition et raffinement basé sur l'échec.
- Mettez le modèle de Voyager sur les compétences du SDK de l'agent Claude 2026 et l'écosystème du kit de compétences.

## Le problème

Les agents qui reconstruisent chaque capacité à partir de zéro à chaque séance font trois choses mal:

1. **Waste tokens.**Chaque tâche réitère le même raisonnement.
2. **Lose progress.**Une correction apprise en session A ne passe pas à la session B.
3. **Fail on long-horizon composition.**Les tâches complexes nécessitent des hiérarchies de capacités; les instructions à un seul coup ne peuvent pas les exprimer.

Voyager répond: traiter chaque capacité réutilisable comme un morceau de code nommé stocké dans une bibliothèque, récupérable par similitude, compostable avec d'autres compétences, et affiné par feedback d'exécution.

## Le concept

### Trois composants

Voyager (arXiv:2305.16291) structure un agent autour de:

1. **Automatic curriculum.**Un proposant motivé par la curiosité choisit la prochaine tâche en fonction de l'état actuel de l'agent et de son environnement.
2. **Skill library.**Chaque compétence est un code exécutable. De nouvelles compétences sont ajoutées lorsque une tâche réussit.
3. **Iterative prompting mechanism.**En cas d'échec, l'agent reçoit des erreurs d'exécution, des commentaires sur l'environnement et des sorties d'auto-vérification, puis affiner la compétence.

L'évaluation de Minecraft (Wang et coll., 2024): 3,3 fois plus d'articles uniques, 8,5 fois plus rapides outils en pierre, 6,4 fois plus rapides outils en fer, 2,3 fois plus long travers de carte par rapport aux lignes de base.

### Espace d'action = code

La plupart des agents émettent des commandes primitives.

```
async function craftIronPickaxe(bot) {
  await mineIron(bot, 3);
  await mineStick(bot, 2);
  await placeCraftingTable(bot);
  await craft(bot, 'iron_pickaxe');
}
```

Composé de sous-compétences, stocké sur la description et l'intégration, récupéré comme un programme, pas une requête.

C'est la compétence du SDK 2026 Claude Agent: une pièce de code nommée et récupérable plus des instructions que l'agent charge à la demande.

### Récupération des compétences

Une nouvelle tâche: faire une hache à diamant.

1. Intégre la description de la tâche.
2. Demande à la bibliothèque des compétences pour des compétences similaires.
3. Retour `craftIronPickaxe`- Je suis là .`mineDiamond`- Je suis là .`placeCraftingTable`et ainsi de suite.
4. Compose la nouvelle compétence à partir de primitives récupérées + nouvelle logique.

Il s'agit de la mise en œuvre des ressources MCP (phase 13) et des compétences SDK d'agent: récupération sur une surface de connaissances/code, axée sur la tâche actuelle.

### Réfinition itérative

La boucle de rétroaction du Voyager:

1. L'agent écrit une compétence.
2. La compétence est contre l'environnement.
3. Un des trois signaux revient:`success`- Je suis là .`error`(avec des traces de pile), `self-verification failure`- Je suis désolé .
4. L'agent réécrit l'habileté en utilisant le signal comme contexte.
5. Va jusqu'à ce que tu réussisses ou que tu réussisses.

Il s'agit de l'auto-réfinition (leçon 05) appliquée à la génération de code avec une vérification fondée sur l'environnement.

### Programme et exploration

Le module du programme de Voyager propose des tâches telles que " construire un abri près du lac " en fonction de ce que l'agent a et ce qu'il n'a pas encore fait.

Pour les agents de production, cela se traduit par un opérateur "ce qui manque": étant donné la bibliothèque de compétences actuelle et un domaine, quelles compétences ne sont pas encore couvertes?

### Où ce modèle va mal

- **Skill library rot.**La même compétence est ajoutée 10 fois avec des descriptions légèrement différentes.
- **Composed-skill drift.**Les compétences des parents dépendent d'un enfant qui a été affiné.
- **Retrieval quality.**La récupération vectorielle sur les descriptions de compétences se dégrade à mesure que la bibliothèque dépasse quelques centaines.`category=tooling`").

```figure
voyager-skills
```

## Faites-le

`code/main.py`met en œuvre une bibliothèque de compétences stdlib:

- `Skill` nom, description, code (en tant que chaîne), version, étiquettes, dépendances.
- `SkillLibrary` enregistrer, rechercher (coupe de jetons), composer (type topologique de dép) et affiner (boîte de version à la mise à jour).
- Un agent scripté qui enregistre trois compétences primitives, compose une quatrième, frappe un échec et raffinera.

- Je vais le faire.

```
python3 code/main.py
npx tsx code/main.ts
```

La trace montre les écrits de la bibliothèque, la récupération, la composition, une exécution ratée et un raffinement v2 de la boucle de Voyager de bout en bout.

## Utilisez-le

- **Claude Agent SDK skills**(Anthropic)  la référence 2026: chaque compétence a une description, un code et des instructions; chargée à la demande pendant une session d'agent.
- **skillkit**(npm: skillkit)  Gestion des compétences entre agents pour plus de 32 agents de codage d'IA.
- **Custom skill libraries** Spécifique pour le domaine (compétences SQL pour les agents de données, compétences Terraform pour les infra-agents).
- **OpenAI Agents SDK `tools`** à la fin inférieure; chaque outil est une compétence légère.

## La faire partir

`outputs/skill-skill-library.md`génère une bibliothèque de compétences en forme de Voyager avec enregistrement, récupération, versionnement et raffinement câblé pour tout temps d'exécution cible.

## Exercices

1. Ajouter un détecteur de cycle de dépendance à `compose()`Que se passe-t-il quand la compétence A dépend de B qui dépend de A ?
2. Implémenter la version de la mise en place de compétences.`crafting@1`, un raffinement à `crafting@2`ne doit pas mettre à niveau le parent en silence.
3. Remplacez la récupération par superposition de jetons par des intégrations de transformateurs de phrases (ou une impl BM25 stdlib). Mesurer la récupération@5 sur une bibliothèque de jouets de 50 compétences.
4. Ajouter un agent "curriculum": compte tenu de la bibliothèque actuelle et de la description du domaine, proposer 5 compétences manquantes.
5. Lisez les documents de compétences de Claude Agent SDK d'Anthropic, portez la bibliothèque de jouets au schéma de compétences du SDK.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Skill | "Reusable capability" | Named chunk of code + description, retrievable by similarity |
| Skill library | "Agent memory of how-to" | Persistent store of skills, searchable and composable |
| Curriculum | "Task proposer" | Bottom-up goal generator driven by current capability gap |
| Composition | "Skill DAG" | Skills invoking skills; topologically sorted on execution |
| Iterative refinement | "Self-correcting loop" | Env feedback + errors + self-verification fold back into the next version |
| Action-space-as-code | "Programmatic actions" | Emit functions, not primitive commands, for temporally extended behavior |
| Dedup on write | "Skill collapse" | Near-duplicate descriptions collapse to one canonical skill |

## Pour en savoir plus

- [Wang et al., Voyager (arXiv:2305.16291)](https://arxiv.org/abs/2305.16291) le papier de la bibliothèque de compétences original
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) les compétences en tant que productivisation de 2026
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) compétences et subagents en pratique
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) la boucle de raffinement sous le Voyager
