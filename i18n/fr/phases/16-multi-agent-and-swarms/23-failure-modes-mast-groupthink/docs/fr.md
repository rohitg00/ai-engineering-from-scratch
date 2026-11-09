# Les modes d'échec  MAST, pensée de groupe, monoculture, erreurs en cascade

> La taxonomie de référence pour 2026 est **MAST**(Cemri et coll., NeurIPS 2025, arXiv:2503.13657), dérivé de 1642 traces d'exécution sur 7 MAS open source à la pointe de la technologie montrant **41–86.7% failure rate**. Trois catégories racines: **Specification Problems**(41,77%)  ambiguïté de rôle, définition de tâches peu claire; **Coordination Failures**(36,94%)  défaillances de communication, désynchronisation de l'état; **Verification Gaps**(21,30%)  manque de validation, absence de vérifications de qualité.**Groupthink**La famille (arXiv:2508.05687) ajoute: effondrement de la monoculture (même modèle de base → défaillances corrélatives), biais de conformité (les agents renforcent les erreurs de l'autre), théorie déficiente de l'esprit, dynamique de motifs mixtes, défaillances de fiabilité en cascade. Exemple en cascade: tempêtes de retrait où une défaillance de paiement déclenche des retraités de commandes, qui déclenchent des retraités d'inventaire, qui submergent le service d'inventaire (10 fois la charge en secondes  nécessite des interrupteurs). Poison de mémoire: l'hallucination d'un agent entre dans la mémoire partagée, les agents en aval la traitent comme un fait; la précision se détériore progressivement, rendant douloureux le diagnostic de la cause racine.**STRATUS**(NeurIPS 2025) rapporte une amélioration de 1,5 fois de la réussite de l'atténuation par l'intermédiaire d'agents spécialisés de détection / diagnostic / validation.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 13 (Shared Memory), Phase 16 · 14 (Consensus and BFT), Phase 16 · 15 (Voting and Debate Topology)
**Time:** ~75 minutes

## Problème

Les systèmes multi-agents échouent 41 à 86,7% du temps sur des tâches réelles (Cemri et coll. 2025 ont mesuré cela sur 7 MAS open-source). Cela ne peut pas être débogable par " juste ajouter plus d'agents. " Les défaillances ont des causes structurelles. La taxonomie MAST vous donne les catégories. Cette leçon cartographique chaque catégorie à un modèle de détection, de diagnostic et d'atténuation concret afin que les chiffres cessent d'être arbitraires.

La pratique de production 2026 consiste à traiter les modes d'échec comme des entrées de conception.

## Concept

### Catégories MAST

**Specification Problems (41.77% of failures).**La tâche de l'agent n'a pas été définie assez étroitement.

- Ambigüité de rôle: deux agents pensent tous deux qu'ils sont le critique.
- La tâche a été sous-déclarée: "récapituler ceci" lorsque l'utilisateur voulait un angle spécifique.
- Critères de réussite implicites: l'agent ne peut pas dire si elle a réussi.

Les atténuations:
- Écrivez des contrats explicites de rôle.
- Avant de commencer, définissez "fait ressemble à X".
- Vérifie des spécifications avant vol: un agent séparé examine la définition de la tâche avant l'expédition.

**Coordination Failures (36.94%).**Les communications ou les échecs d'état.

Les exemples:
- Deux agents mettent à jour l'état partagé sans synchronisation.
- Message perdu entre les agents (failure de file d'attente, délai de résiliation).
- Départ de l'état: l'agent A pense que la tâche est terminée; l'agent B est toujours en train d'exécuter.

Les atténuations:
- L'état partagé de version avec une synchronisation optimiste.
- Reconnaissance explicite des messages critiques (retrait jusqu'à ce qu'ils soient accrus).
- Les points de contrôle de synchronisation d'état sont périodiques. Détecter la dérive tôt.

**Verification Gaps (21.30%).**Aucune vérification indépendante des sorties.

Les exemples:
- Un agent prétend réussir, personne ne le confirme.
- Chaque chaîne d'agents fait confiance à la production du précurseur.
- Des tests manquant sur le comportement composé émergent.

Les atténuations:
- Agents de vérification indépendants (leçon 13).
- Contract explicite de remise: "La sortie d'A doit passer le contrôleur C avant que B ne démarre".
- L'enregistrement des résultats pour l'analyse post-hoc.

### La famille de la pensée de groupe (arXiv:2508.05687)

Cinq défaillances liées lorsque les agents homogénéisent ou s'imitent:

**Monoculture collapse.**Les mêmes données de base ou de formation → erreurs corrélatives.

**Conformity bias.**Les agents s'adaptent au plus fort ou le plus confiant de leurs pairs, même quand ils se trompent.

**Deficient ToM.**Les agents ne peuvent pas modéliser les croyances de l'autre; la coordination tombe en panne (leçon 18).

**Mixed-motive dynamics.**Les agents avec des incitations partiellement alignées dérivent vers le compromis, ce qui ne satisfait personne.

**Cascading reliability failures.**Le modèle d'erreur d'un composant déclenche des modèles d'erreur dans les composants dépendants.

### Exemple en cascade  la tempête de réessayer

Un modèle classique d'incidents de 2026:

```
payment service fails 10% of requests
   ↓
order agent retries payment (exponential backoff but naive)
   ↓
each retry is a new order-inventory check
   ↓
inventory service sees 2x normal load
   ↓
inventory service starts timing out
   ↓
every order retries inventory check
   ↓
inventory service sees 10x normal load
   ↓
cluster goes down
```

La solution est classique:**circuit breakers**- lorsque le taux d'erreur en aval dépasse le seuil, courts-circuits avec des résultats en cache ou par défaut.

Les interrupteurs de circuit sont l'une des rares mesures d'atténuation des défaillances multi-agents que vous empruntez directement à des systèmes distribués sans modification.

### Poison de mémoire (revisé)

La leçon 13 est que l'hallucination d'un agent devient un fait de mémoire partagée, les agents en aval raisonnent sur le fait empoisonné.

Le symptôme est une dégradation progressive de la précision.

L'atténuation: journal de l'annexe, provenance, vérificateur non rédigé.

### STRATUS  agents spécialisés pour la détection des défaillances

STRATUS (NeurIPS 2025) rapporte une amélioration de 1,5 fois du succès de l'atténuation lorsque vous déployez:

- **Detection agent.**Observation des symptômes (contradiction élevée, augmentation des tentatives, dérive de précision).
- **Diagnosis agent.**Compte tenu des symptômes, il est probable qu'il en résulte une cause profonde de la taxonomie MAST.
- **Validation agent.**Après l'atténuation, vérifiez si les symptômes disparaissent.

C'est une réponse à des incidents de style SRE, appliquée aux systèmes d'agents.

### L'audit en mode défaillance

Une meilleure pratique pour 2026 est un audit trimestriel (et par major-release) en mode défaillance:

1. **Trace sample.**Ramassez 1000 traces d'exécution réelles.
2. **Categorize.**Pour chaque défaillance de la trace, carte des catégories MAST + Groupthink.
3. **Compute failure-by-category rate.**Quelles catégories dominent votre système ?
4. **Rank mitigations.**Quel remède éliminerait le plus de défaillances ?
5. **Pick 2-3 mitigations.**Mise en œuvre; réaudit au trimestre prochain.

La discipline est plus importante que les choix spécifiques. Sans audits, les échecs se mélangent au bruit et ne sont jamais traités de manière systématique.

### Quand les systèmes échouent silencieusement

La catégorie de défaillance la plus dangereuse est la catégorie de défaillance de la correction silencieuse. Un système qui échoue fortement (crash, exception, alerte) peut être surveillé. Un système qui produit des sorties plausibles mais erronées ne peut pas être détecté par les journaux d'exception. C'est pourquoi les lacunes de vérification sont la catégorie la plus chère par défaillance même si elles ne sont que 21,30% par compte.

Investir dans:
- Révision humaine basée sur des échantillons.
- Des tests de régression de l'ensemble de données doré.
- Contrôle croisé entre agents sur des résultats importants.

### Échec par rapport à échec lent

Certains échecs sont immédiats; certains sont lents. Les échecs immédiats (délais de mise en œuvre, désaccord de schéma, erreur d'auteur) sont peu coûteux à détecter.

Le mouvement d'ingénierie de 2026: les proxies de défaillance lente de l'instrument afin que vous puissiez attraper la dérive avant qu'elle ne devienne une erreur visible.

```figure
a5-retry-cascade
```

## Faites-le

`code/main.py`les implémentations:

- `FailureTaxonomy` classe les incidents simulés en catégories MAST + Groupthink.
- `CircuitBreaker` modèle classique; s'ouvre lorsque le taux d'erreur dépasse le seuil.
- `RetryStormSimulator` montre la défaillance en cascade; allume/éteint le disjoncteur.
- `DetectionAgent` matcheur de symptômes de style STRATUS.

Je vais courir .

```
python3 code/main.py
npx tsx code/main.ts
```

Résultats attendus:
- tempête de reprise sans interrupteur: les erreurs d'inventaire explosent (simulées).
- avec interrupteur: plaquette au seuil; réponse en mode dégradé fournie.
- l'agent de détection marque le motif et nomme la catégorie MAST.

## Utilisez-le

`outputs/skill-mast-auditor.md`effectue un audit de mode défaillance de type MAST sur un système multi-agents.

## La faire partir

Discipline en mode défaillance dans la production:

- **MAST audit per quarter.**Les catégories changent à mesure que votre système grandit.
- **Circuit breakers everywhere.**Chaque appel sortant vers un service dépendant.
- **Golden datasets.**Petit, de haute qualité, vérifié à la main, test de régression contre eux chaque semaine.
- **STRATUS trio.**Les agents de détection + diagnostic + validation surveillent la production. Commencez par le seul agent de détection; ajoutez le diagnostic lorsque les symptômes sont bruyants.
- **Failure budget.**Expliquer explicitement le taux de défaillance par catégorie.

## Exercices

1. On court .`code/main.py`Confirmez que le circuit est coupé, que la tempête est réinitialisée, modifiez le seuil de défaillance et observez le compromis.
2. La mise en œuvre d'une **slow-failure proxy**Le taux d'accords entre trois agents parallèles. Lorsqu'il baisse fortement, déclenchez une alerte. Simuler une dérive de monocultures en corréla­tion progressive des sorties d'agents.
3. Lisez Cemri et collègues (arXiv:2503.13657). Choisissez l'un de leurs 7 systèmes MAS et cartez ses 3 principales catégories de défaillance.
4. Lisez le document Groupthink (arXiv:2508.05687). Identifiez lequel des cinq modèles est le plus difficile à détecter dans la production.
5. Conceptez un trio de détection-diagnostic-validation de style STRATUS pour un système multi-agents spécifique que vous connaissez. Quels symptômes la détection surveille-t-elle? Quelles atténuations le diagnostic recommande-t-il? Comment la validation confirme-t-elle qu'ils fonctionnent?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MAST | "The 2026 taxonomy" | Cemri 2025; 3 root categories + 14 sub-types of failures. |
| Specification Problem | "Role ambiguity" | Task or role under-defined; agents do not know what to do. |
| Coordination Failure | "State drift" | Communication or sync breakdown between agents. |
| Verification Gap | "No one checked" | Outputs accepted without independent validation. |
| Groupthink family | "Homogeneity failures" | Monoculture, conformity, deficient ToM, mixed-motive, cascading. |
| Monoculture collapse | "Same model, same hallucinations" | Correlated errors from shared base model or training data. |
| Retry storm | "Cascading error amplification" | One failure triggers retries which amplify load downstream. |
| Circuit breaker | "Fail fast on error rate" | Open when error rate exceeds threshold; short-circuit with default. |
| STRATUS | "Incident response trio" | Detection + diagnosis + validation agents. 1.5x mitigation success. |
| Memory poisoning | "Hallucinations propagate" | Shared-memory fact tainted; downstream agents reason on poison. |

## Pour en savoir plus

- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) Taxonomie MAST, NeurIPS 2025
- [Groupthink failures in multi-agent LLMs](https://arxiv.org/abs/2508.05687) monoculture, conformité et taxonomie des cinq familles
- [STRATUS — specialized agents for MAS incident response](https://neurips.cc/) Entrée dans la procédure NeurIPS 2025 (détection + diagnostic + validation)
- [Release It! — stability patterns (Nygard)](https://pragprog.com/titles/mnee2/release-it-second-edition/) la référence canonique du disjoncteur
- [Anthropic — Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) Notes de défaillance de la production
