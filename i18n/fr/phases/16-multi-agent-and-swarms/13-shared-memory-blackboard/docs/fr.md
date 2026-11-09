# La mémoire et les cartes noires partagées

> Deux approches coexistent dans les systèmes multi-agents de 2026: le **message pool**(tous voient les messages de tous, comme dans AutoGen GroupChat ou MetaGPT) et le **blackboard with subscription**Les deux sont la seule partie étatique d'un système multi-agent  ce qui signifie que les deux sont là où vivent les bugs intéressants.**memory poisoning**Un agent hallucine un " fait ", d'autres agents le traitent comme vérifié, et la précision se détériore progressivement d'une manière qui est beaucoup plus difficile à déboguer qu'un accident immédiat.

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## Problème

Les systèmes multi-agents ont besoin d'un endroit pour les agents de partager des faits. Une option littérale est "passer tout dans les messages"  mais qui réinvente l'état partagé avec une copie supplémentaire. Un autre est "donner à tout le monde un journal global"  mais les journaux mondiaux se développent illimités et empoisonnent facilement. Un troisième est "projeter une vue par agent"  évolutif mais schéma-heavy.

Lorsque l'un des agents hallucine et écrit l'hallucination dans un état partagé, chaque agent en aval qui lit cet état adopte l'hallucination comme un fait.

Il s'agit de l'intoxication de la mémoire. C'est la deuxième famille de défaillances la plus documentée dans la taxonomie MAST (Cemri et coll., arXiv:2503.13657) et elle est structurelle: toute conception de mémoire partagée sans provenance et un vérificateur non écrit l'exposera finalement.

## Concept

### Les deux principales topologies

**Full message pool.**Chaque agent lit chaque message. AutoGen GroupChat et MetaGPT utilisent ceci. Simple, transparent, inspectable, mais ne dépasse pas ~ 10 agents parce que le contexte de chaque agent se remplit avec le travail des autres agents.

```
agent-A ──write──▶ ┌────────────────┐ ◀──read── agent-D
                   │ message pool   │
agent-B ──write──▶ │                │ ◀──read── agent-E
                   │ (global log)   │
agent-C ──write──▶ └────────────────┘ ◀──read── agent-F
```

**Blackboard with subscription.**Les agents déclarent leur intérêt pour les sujets; les routes du substrat ne fournissent que des messages pertinents. CA-MCP (arXiv:2601.11595) et le cadre décentralisé de la Matrice (arXiv:2511.21686) utilisent cela.

```
                   ┌─ topic: prices ──┐
agent-A ──pub────▶ │                  │ ──▶ agent-D (subscribed)
                   ├─ topic: orders ──┤
agent-B ──pub────▶ │                  │ ──▶ agent-E (subscribed)
                   ├─ topic: alerts ──┤
agent-C ──pub────▶ │                  │ ──▶ agent-F (subscribed)
                   └──────────────────┘
```

### Quand chacun gagne

- **Full pool**Les arguments sur la question de savoir qui a dit ce qui est trivial quand tout le monde voit tout.
- **Blackboard**Les résultats obtenus par les agents sont nombreux, homogènes dans le rôle mais nombreux dans l'exemple (swarms), et la conversation est longue.

Les systèmes de production se mélangent souvent: une petite piscine complète en haut (couche de planification), des planches noires en bas (couche de travailleurs).

### Envenenement de la mémoire, dans un scénario

Trois agents travaillent sur une tâche de recherche, l'agent A est un agent de récupération, l'agent B est un résumé, l'agent C est un analyste.

1. Un a récupéré une page et a écrit un message à l'état partagé: "L'étude rapporte une amélioration de la précision de 42%".
2. La page qu'on a récupérée disait "4,2% d'amélioration". Un halluciné décimal.
3. B, en lisant l'état partagé, écrit: "Un grand gain de précision de 42% a été rapporté (source: A). "
4. C, en lisant l'état partagé, écrit: " Recommander l'adoption  42% de levage est transformateur. "
5. Le rapport final cite un nombre de 42% qui n'a jamais existé.

Aucun agent n'a été blessé, aucun test n'a échoué, le système a fonctionné, l'hallucination est passée du contexte d'un agent à celui de chaque agent en aval via l'état partagé.

### Pourquoi est-ce structurel

Sans état partagé, l'hallucination de l'agent A reste dans le contexte de l'agent A. Les agents en aval récupèrent ou dérivent et peuvent attraper l'erreur. Avec l'état partagé naïf, le contexte de l'agent A devient le contexte de tous, et l'hallucination est blanchie en fait.

Le problème n'est pas l'état partagé en soi  c'est l'état partagé **without provenance and without an independent verifier**Trois mesures d'atténuation s' y rapportent:

1. **Attribute provenance on every write.**Chaque entrée dans les dossiers d'État partagés qui l'a écrite, quand, sous quel prompt, et (le cas échéant) quelle source l'agent a cité.
2. **Version writes; treat them as append-only.**Une correction est une nouvelle entrée qui remplace l'ancienne, pas une mise à jour en place.
3. **Keep at least one agent that cannot write to shared state.**Un agent de vérification à lecture seule prélève des échantillons d'entrées, récupère des sources et détecte les incohérences. Il lit toujours le bassin, de sorte qu'il peut être trompé par une mauvaise entrée, mais il vérifie chaque entrée contre la source originale et ne peut pas écrire, de sorte que ses verdicts ne renvoient jamais un fait empoisonné dans un état partagé.

### Précedent de plaque noire (Hayes-Roth, 1985)

Le modèle de tableau noir précède les agents de LLM de quatre décennies. Hayes-Roth (1985, "A Blackboard Architecture for Control") a décrit des sources de connaissances spécialisées qui observent une planche noire mondiale, contribuent à des solutions partielles et déclenchent d'autres sources. Le tableau noir 2026 (CA-MCP, Matrix) est le même modèle avec les agents LLM comme les sources de connaissances et les taches JSON comme solutions partielles. L'ancienne littérature a documenté des solutions pour écrire la controverse, le contrôle opportuniste et la cohérence que les systèmes modernes redécouvrent.

### Projection par rapport à vue complète

Un tableau noir pur donne à chaque abonné la même projection (à l'échelle du sujet).**per-agent projection**Les réducteurs d'état de LangGraph sont la mise en œuvre canonique 2026  la fonction de réduction plie l'état global en une tranche spécifique au rôle.

La projection par agent s'élargit mais a besoin d'un schéma.

### Modèles de contenu écrit

La rédaction simultanément de plusieurs agents est un problème de simultanés, pas seulement un problème de LLM.

- **Sequential writer (single producer).**Toutes les écritures passent par un agent de coordination qui sérialise.
- **Optimistic concurrency with versioning.**Chaque entrée a une version; les écrivains échouent à la version de déséquilibre et à la réessayer.
- **Topic partitioning.**Les différents agents possèdent des sujets différents, pas de différends entre sujets, il faut des limites de partition.

La plupart des frameworks 2026 sont par défaut écrits par écrit parce que les appels LLM sont assez lents pour que la dispute soit rare et que le goulot d'étranglement ne fasse pas de mal.

### Le vérificateur non écrit

L'atténuation la plus efficace est le vérificateur à lecture seule.

- Le vérificateur partage l'état avec l'équipe (lire le tableau noir ou la balance).
- Le vérificateur n'a pas de manche d'écriture pour partager l'état  uniquement sur un canal de vérification séparé.
- Le vérificateur récupère indépendamment les sources citées dans les écrits.
- Les résultats du vérificateur sont envoyés à un humain ou à un agent de décision séparé, jamais remis dans la piscine.

Sans cette séparation, les sorties du vérificateur deviennent de nouvelles entrées dans la piscine, ce qui signifie qu'une piscine empoisonnée empoisonne le vérificateur, ce qui empoisonne ses vérifications.

```figure
swarm-blackboard
```

## Faites-le

`code/main.py`Il implique les deux topologies dans Stdlib Python plus une attaque d'empoisonnement de jouet et les trois atténuations.

- `MessagePool` Enregistrement de l'appendice sans fil avec lecture complète.
- `Blackboard` pub/sub à clé de thème avec abonnements par agent.
- `ProvenanceEntry` tous les enregistrements d'écriture (écrivain, timestamp, prompt_hash, source_uri).
- `PoisoningScenario` effectue une tâche de recherche à trois agents où l'agent A hallucine un décimal.
- `Verifier` un agent à lecture seule qui récupère les sources et détecte les incohérences.

Je vais courir .

```
python3 code/main.py
npx tsx code/main.ts
```

Résultats attendus:
- Retour 1 (pas de vérificateur): les 42% hallucinés se propagent au rapport final.
- Exécution 2 (avec vérificateur): le vérificateur détecte l'incohérence, le pool est marqué "déglabré", le rapport final comprend une rétraction.

## Utilisez-le

`outputs/skill-memory-auditor.md`est une compétence qui vérifie la conception de la mémoire partagée de tout système multi-agent pour la provenance, la versionisation et la séparation des vérificateurs.

## La faire partir

Pour toute conception de mémoire partagée:

- Enregistrer la provenance de chaque écriture: `(writer, timestamp, prompt_hash, tool_calls_cited, source_uri)`- Je suis désolé .
- Les corrections sont de nouvelles entrées qui font référence à la liste de remplacement.
- Déployer au moins un agent de vérification à lecture seule avec accès source indépendant.
- Export du vérificateur de route vers un canal séparé, et non vers le pool partagé.
- L'enregistrement du rapport des écritures qui sont des supersessions  un rapport croissant est une preuve précoce des modèles d'hallucination.

## Exercices

1. On court .`code/main.py`Confirmer que la première fois propage l'hallucination et la seconde la prend.
2. Ajouter une deuxième hallucination: l'agent B invente une taille de jeu de données. Le vérificateur doit capturer les deux sans être à la main pour l'un ou l'autre.
3. Transférer la totalité de la piscine à un tableau avec des partitions de thème (`prices`- Je suis là .`summaries`- Je suis là .`analyses`Quels scénarios d'empoisonnement rendent la partition des thèmes plus difficile à réaliser, et quels ne l'aideront pas?
4. Lisez Hayes-Roth (1985, "A Blackboard Architecture for Control"). Identifiez deux modèles de contrôle du document qui ne sont pas discutés dans cette leçon et dont les systèmes 2026 pourraient bénéficier.
5. Lisez CA-MCP (arXiv:2601.11595). Mettez son magasin de contexte partagé dans la classe MessagePool ou Blackboard en `code/main.py`Quels primitifs CA-MCP ajoute-t-il au dessus ?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Message pool | "Shared chat history" | Append-only log that every agent reads. Full transparency, poor scaling. |
| Blackboard | "Shared workspace" | Topic-keyed pub/sub. Agents subscribe to relevant topics. Scales farther. |
| Provenance | "Who wrote what" | Metadata on each write: writer, timestamp, prompt, sources. |
| Memory poisoning | "Hallucinations spreading" | One agent's error enters shared state, downstream agents adopt it as fact. |
| Append-only | "No in-place updates" | Corrections are new entries that supersede. Preserves audit trail. |
| Unwritable verifier | "Independent auditor" | Read-only agent that re-fetches sources and flags inconsistencies. |
| Projection | "Scoped view" | Per-agent view computed from global state. LangGraph reducers are the canonical case. |
| Knowledge Source | "Specialist agent" | Hayes-Roth's 1985 term for a blackboard participant. |

## Pour en savoir plus

- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) Taxonomie MAST; l'empoisonnement par la mémoire est une sous-famille de défaillances de coordination
- [CA-MCP — Context-Aware Multi-Server MCP](https://arxiv.org/abs/2601.11595) Stockage de contexte partagé pour les serveurs MCP coordonnés
- [Matrix — decentralized multi-agent framework](https://arxiv.org/abs/2511.21686) tableau noir basé sur la file d'attente de messages sans orchestrateur central
- [LangGraph state and reducers](https://docs.langchain.com/oss/python/langgraph/workflows-agents) le modèle de projection par agent dans la production
- [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) Notes de provenance et de vérification d'un déploiement de production
