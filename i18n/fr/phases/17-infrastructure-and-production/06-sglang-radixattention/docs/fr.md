# Préfixe-cache de service  RadixAttention et réutilisation KV

> Traitez le cache KV comme une ressource réutilisable de première classe stockée dans un arbre radix et modifiez le calendrier avec lui: au lieu de FCFS (first-come, first-served) comme des horaires vLLM, un planificateur conscient du cache priorise les demandes avec des préfixes partagés plus longs  efficacement un traversage de radix de profondeur pour que les branches chaudes restent résidentes dans HBM. SGLang est le moteur qui a construit en fonction de cette idée. Sur Llama 3.1 8B avec des requêtes 1K similaires à ShareGPT, SGLang atteint ~ 16.200 tok/s à ~ 12.500 de vLLM, un avantage de ~ 29%. Sur les charges de travail RAG lourdes avec préfixe, l'avantage atteint 6,4x. Sur les charges de travail en forme de clonage vocale, le taux de clics a été supprimé de 86%. Déployé sur plus de 400 000 GPU en 2026 sur xAI, LinkedIn, Cursor, Oracle, GCP, Azure, AWS. Le problème est que le nombre 6.4x s'évapore lorsque le préfixe de commande est incohérent.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy radix-tree cache + cache-aware scheduler)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 14 (Agentic RAG)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Diagramme RadixAttention: comment les préfixes sont stockés dans un arbre radix et comment les blocs KV sont partagés entre des séquences enracinées dans la même branche.
- Expliquez pourquoi le système de planification de cache est mal utilisé pour le trafic de préfixes.
- Calculer l'accélération attendue pour une charge de travail en fonction du taux de pré-cache et de la distribution de longueur rapide.
- Nommez la discipline de commande rapide qui rend le nombre 6.4x réel par rapport à un avantage perdu.

## Le problème

Le service classique traite le prompt de chaque requête comme opaque. Même lorsque 5000 requêtes RAG commencent toutes avec le même prompt système de 2 000 jetons plus le même préambule de récupération, vLLM remplit ce préfixe de 2 000 jetons 5 000 fois.

L'observation: les commandes dans les charges de travail agentique et RAG partagent presque toujours de longs préfixes. Les commandes système, les schémas d'outils, quelques exemples de prises de vue, les en-têtes de récupération, l'historique de conversation  toutes se répètent à travers les demandes. Si vous avez stocké le cache KV pour ce préfixe une fois et l'avez réutilisé, vous ne le remplissez pas à nouveau.

RadixAttention fait exactement cela. Les jetons sont indexés dans un arbre radix; chaque nœud possède des blocs KV pour la séquence de jetons sur son chemin de la racine. Une nouvelle demande passe à travers l'arbre: tout nœud dont le jeton correspond réutilise les blocs KV de ce nœud. Le coût de remplissage devient proportionnel au suffixe "nouveau", pas le prompt complet.

Le défi est de planifier. Si deux demandes partagent un préfixe de 2000 jetons et qu'un troisième partage seulement 200 jetons du même préfixe, vous voulez servir les deux demandes partagées ensemble afin que le long préfixe reste dans HBM. FCFS fait l'inverse  il sert celui qui est arrivé le premier, éventuellement évacuant la branche chaude avant que la prochaine demande de long préfixe ne frappe.

## Le concept

### L'arbre radix en tant qu'indice de KV

Un arbre radix (compact trie) stocke des séquences de jetons. Chaque nœud possède une plage de jetons et les blocs KV calculés pour cette plage.

```
root
 |- "You are a helpful assistant..."  (2,000 tokens, 124 KV blocks)
      |- "Context: <doc A>..."        (500 tokens, 31 blocks)
           |- "Question: Alice..."    (80 tokens, 5 blocks)
           |- "Question: Bob..."      (95 tokens, 6 blocks)
      |- "Context: <doc B>..."        (520 tokens, 33 blocks)
```

Une nouvelle demande est envoyée avec le système prompt + "Context: <doc A>" + "Question: Carol". Le planificateur marche: système préfixe correspondant (124 blocs réutilisés), doc-A branche correspondant (31 blocs réutilisés), puis alloue de nouveaux blocs uniquement pour "Question: Carol" (4 blocs). Coût de remplissage: 4 blocs de nouveaux jetons. Sans l'arbre: 160 blocs. ~40x d'économies sur le remplissage préalable.

### Calendrier en cache

La réutilisation de Radix est inutile si le cache se détériore.

1. **Depth-first dispatch**Lorsque vous choisissez la prochaine requête de la file d'attente, préférer les requêtes enracinées dans la même branche que le jeu en cours d'exécution. Cela garde la branche chaude coincée.
2. **LRU at branch level, not block level**. Éliminer les branches entières (à partir des feuilles les plus courtes utilisées) plutôt que des blocs individuels, de sorte que la forme du cache correspond à la forme du radix.

La FCFS viole les deux, une demande de partage de 2000 jetons est derrière une demande de partage de 50, puis la branche de 2000 jetons est expulsée pour admettre celle de 50 jetons.

### Numéros de référence que vous devriez mémoriser

- Llama 3.1 8B, H100, ShareGPT 1K: SGLang ~ 16.200 tok/s contre vLLM ~ 12.500 (~ 29% de bord).
- RAG avec préfixe lourd (même système + même document, question variable): jusqu'à 6,4x sur SGLang.
- Charges de travail de clonage vocale: taux de succès de préfixe-cache de 86,4%.
- Les taux de production de SGLang: 50 à 99% selon la discipline rapide.
- Déployé sur plus de 400 000 GPU en 2026.

### La commande t'a pris .

Le nombre 6.4x repose sur une commande cohérente de modèle de prompt. Si votre client construit des commandes comme `[system, tools, context, history, question]`dans certaines demandes et `[system, context, tools, history, question]`Ce qui ressemble à un préfixe commun à un humain sont deux séquences distinctes à l'arbre radix.

Le levier de l'ingénieur: votre modèle de prompt est une clé cache. Fixer l'ordre. Mettre tout ce qui est immuable (système, outils, schémas) en premier. Mettre le contexte de récupération ensuite. Mettre la question utilisateur en dernier. Ne pas interférer le contenu dynamique dans le préfixe.

Cas réel de la recherche: déplacer le contenu dynamique hors du préfixe cacheable a pris un déploiement de 7% à 74% taux de succès de cache en une seule modification.

### Où RadixAttention gagne et perd

Les gagnants:
- RAG (même préambule de récupération, question différente).
- Agents (les mêmes schémas d'outils, les requêtes variées).
- Chattez avec le système de longue durée.
- Charges de travail vocales/visibles avec préambules répétées.

Perte (retour à la capacité de débit au niveau vLLM):
- Génération à coup unique avec des instructions uniques (complétation du code, chat ouvert sans réponse du système).
- Des instructions dynamiques où chaque demande interpose un contenu unique dans le préfixe.

### Pourquoi c'est un problème de planificateur, pas seulement un problème de noyau

Vous pouvez implémenter la réutilisation de KV comme un truc du noyau. L'idée de SGLang est que la réutilisation ne paie que si le planificateur garde le branch résident chaud. Une politique naïve de "réutilisation si disponible" va faire tourner le cache sous charge mixte. Le planificateur indexé par radix-arbre est ce qui transforme le truc du noyau en un avantage de production de 29%.

### Interaction avec le VLLM

Les deux systèmes ne sont pas des concurrents stricts.`--enable-prefix-caching`Le vide a été fermé mais n'a pas complètement disparu  L'ensemble de la pile de SGLang est radix-first; vLLM l'a greffé. Pour les charges de travail dominées par la réutilisation de préfixes, SGLang reste la norme par défaut. Pour le serveur à usage général sans modèles de préfixes forts, vLLM reste égal ou meilleur.

```figure
roofline
```

## Utilisez-le

`code/main.py`Il implémentera un cache KV de jouet radix-tree plus un planificateur avec deux politiques: FCFS et cache-conscient. Il exécute la même charge de travail à travers les deux, rapporte le taux de cache préfixe et le delta de débit. Puis il exécute une charge de travail "scrambled ordering" pour montrer l'effondrement de 6,4x.

Le [Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?workload=shared&shared=4096)La machine montre le cache radix sur une vraie L4 run. Quatre groupes ont chacun leur propre prompt système de 4.096 jetons. La première demande d'un groupe calcule son prompt. Alors que ce prompt reste dans le cache, les demandes ultérieures du groupe ne calculent que la question de 128 jetons.

## La faire partir

Cette leçon produit `outputs/skill-radix-scheduler-advisor.md`. Compte tenu de la description de la charge de travail (forme de modèle de demande, modèle de récupération, nombre de locataires concurrents), il produit une ordonnance de demande de demande et une recommandation de mise en œuvre de la SGLang.

## Exercices

1. On court .`code/main.py`. Comparer FCFS et cache-conscient sur la même charge de travail.
2. Modifiez la charge de travail afin que les instructions se déplacent aléatoirement `[system, tools, context]`- Pourquoi le taux de coupe ?
3. Calculer le coût de HBM de maintenir un système de prompt de 2000 jetons résident comme une branche radix sur Llama 3.1 8B. Comparez avec le coût d'un lot de 16 séquences sans réutilisation de préfixes.
4. Lisez le document SGLang RadixAttention. Expliquez en trois phrases pourquoi l'expulsion de l'ULR en forme d'arbre est supérieure à celle de bloc sous une charge lourde de préfixe.
5. Un client rapporte seulement 8% de taux de cache. Nommez trois causes probables et le diagnostic que vous exécuterez pour chacune.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| RadixAttention | "the SGLang thing" | KV cache indexed as a radix tree so shared prefixes reuse blocks |
| Radix tree | "compact trie" | Tree where each node owns a token range and its KV blocks |
| Cache-aware scheduler | "hot-branch-first" | Scheduler that prefers requests sharing the resident branch |
| Prefix-cache hit rate | "how much of your prompt was free" | Fraction of prompt tokens served from reused KV blocks |
| FCFS | "first-come first-served" | Default scheduling that breaks prefix locality |
| Branch-level LRU | "evict the leaf" | Eviction policy matched to radix shape |
| Prompt template ordering | "the cache key" | The prompt's component order determines what the tree can share |
| System prompt pinning | "resident prefix" | Keep the immutable system portion pinned to avoid eviction thrash |

## Pour en savoir plus

- [SGLang GitHub](https://github.com/sgl-project/sglang) source et documents.
- [SGLang documentation](https://sgl-project.github.io/) RadixAttention et détails de planification.
- [SGLang paper — Efficiently Programming Large Language Models (arXiv:2312.07104)](https://arxiv.org/abs/2312.07104) la référence de conception.
- [LMSYS blog — SGLang with RadixAttention](https://www.lmsys.org/blog/2024-01-17-sglang/) numéros de référence et raison de l'agrément.
- [vLLM — Prefix Caching](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/) mise en œuvre de la même façon que la radix de vLLM, pour comparaison.
