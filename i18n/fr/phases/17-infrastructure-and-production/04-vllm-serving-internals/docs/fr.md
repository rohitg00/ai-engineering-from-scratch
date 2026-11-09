# Servir les moteurs internes  PagedAttention, batchage continu, préchargement en morceaux

> Le débit moderne du moteur de service repose sur trois défauts de composition, pas sur un seul truc. PagedAttention est toujours activée. Le batchage continu injecte de nouvelles demandes dans le batch actif entre les itérations de décode. Des tranches de pré-remplissage en morceaux font des longues instructions, donc les jetons de décode ne meurent jamais de faim. Allumez les trois et un Llama 3.3 70B FP8 sur un H100 SXM5 pousse 2 200 à 2 400 tok/s à 128 simultanément  environ 25% au-dessus de la vLLM et 3-4x une boucle PyTorch naïve. Cette leçon lit le programmeur et le noyau d'attention de vLLM  le moteur de référence pour les trois techniques  à un niveau que vous pouvez diagrammer, et se termine par un batcher continu de jouets en `code/main.py`que les horaires se remplissent et décodent de la même manière que VLLM.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy continuous batching scheduler)
**Prerequisites:** Phase 17 · 01 (Model Serving), Phase 11 (LLM Engineering)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Expliquez PagedAttention comme un allocateur de cache KV: blocs, tables de blocs, et pourquoi la fragmentation reste inférieure à 4% à la charge de production.
- Diagramme de la séquence continue au niveau de l'itération: comment les séquences terminées quittent le lot et les nouvelles se joignent sans se vider.
- Décrire le pré-remplissage en morceaux dans une phrase et nommer la métrique de latence qu'elle protège (indice: il s'agit de la queue ITL des décodes concurrents, pas de la capacité moyenne).
- Vérifiez une combinaison de fonctionnalités vLLM par rapport à la matrice de compatibilité de votre version avant d'activer chaque optimisation à la fois.

## Le problème

Une boucle de service PyTorch naïve exécute une demande à la fois: jetonner, pré-remplir, décoder jusqu'à EOS, retourner. Pour un utilisateur, cela fonctionne. À cent, c'est une file d'attente de patients. La correction évidente  par lots statiques  passe chaque demande à la plus longue demande dans la fenêtre, passe chaque décode à la plus longue sortie attendue et arrête l'ensemble du lot sur la séquence la plus lente. Vous payez pour des rembourrages que vous n'utilisez jamais, et les demandes rapides attendent les plus lentes.

VLLM résout trois problèmes à la fois. PagedAttention empêche la fragmentation du cache KV de consommer 60-80% de la mémoire de la GPU de la manière de l'allocation contigue classique. Le batchage continu permet aux demandes de rejoindre et de laisser le lot entre chaque itération de décode, de sorte que le lot est toujours plein de travail réel. Un pré-remplissage en morceaux casse un token 32k en 512 tokens qui interviennent avec le décode, donc un long prompt ne gelera pas chaque token de décode sur le GPU.

La production par défaut de 2026 est activée, vous devez comprendre ce que chacun fait parce que les modes d'échec sont tous sur le planificateur, pas le modèle.

## Le concept

### PagedAttention en tant que système de mémoire virtuel

Un cache KV est `num_layers × 2 × num_heads × head_dim × seq_len × bytes_per_element`Pour Llama 3.3 70B à 8192 jetons, c'est environ 1,25 Go par séquence dans BF16. Si vous réservez 8192 slots à l'avance pour chaque demande mais que la demande moyenne ne utilise que 1500 jetons, vous gaspillez environ 82% du HBM que vous avez réservé.

PagedAttention emprunte l'idée de la mémoire virtuelle du système d'exploitation. Le cache KV n'est pas contigu à chaque séquence. Il est alloué en blocs de taille fixe (par défaut 16 jetons). Chaque séquence a une table de blocs qui cartographient ses positions logiques de jetons aux identifiants de blocs physiques. Lorsqu'une séquence dépasse ses blocs alloués, un autre bloc est ajouté. Quand elle est terminée, ses blocs retournent dans le pool.

La fragmentation diminue de 60-80% (classique) à moins de 4% (Attention page). Vous ne pouvez pas activer PagedAttention avec un drapeau  c'est le seul allocateur vLLM navires. Le bouton est `--gpu-memory-utilization`(par défaut 0.9), qui indique à vLLM combien de HBM doit réserver pour les blocs KV après le chargement des poids et des activations.

### Partage continu au niveau de l'itération

L'ancien " batchage dynamique " attendait une fenêtre (disons 10 ms) pour remplir un lot, puis exécutait le préfill + décode + décode + décode jusqu'à ce que chaque séquence soit terminée.

Le batchage continu fonctionne entre chaque étape de décode.`RUNNING`à chaque itération:

1. Toute séquence dans `RUNNING`qui vient de frapper EOS ou max_tokens est supprimé.
2. Le planificateur regarde la file d'attente. S'il y a des blocs KV gratuits, il admettra de nouvelles séquences (pré-remplir ou reprendre).
3. Le passe avant passe sur tout ce qui est maintenant en .`RUNNING`, émettant un nouveau jeton par séquence.

Les séquences à différentes positions dans leur sortie partagent une fusion vers l'avant.`V1 scheduler`. L'invariable de clé: le planificateur fonctionne une fois par itération de décode, pas une fois par requête.

### Le préchargement en morceaux protège la queue de l'ITL

Le préfill est lié au calcul. Une demande de 32k-token sur Llama 3.3 70B prend ~ 800 ms de préfill pur sur un H100. Pendant que le préfill fonctionne, décodez les jetons pour chaque autre séquence dans la séquence d'attente. Dans une boucle de service, la latence de premier jeton (TTFT) d'un long demande devient la latence inter-token (ITL) blip pour des dizaines d'autres utilisateurs.

Le pré-remplissage par morceaux divise le pré-remplissage en morceaux de taille fixe (par défaut 512 jetons) et planifie chaque morceau en unité. Entre les morceaux, le planificateur peut avancer les séquences de décode par un jeton. Vous échangez un petit hit de latence de pré-remplissage absolu (quelques ms par morceau) pour un jitter de décode beaucoup plus faible. P99 ITL sous charge mixte tombe de ~ 50 ms à ~ 15 ms dans les benchmarks publiés.

### Les trois défauts interagissent

Les trois caractéristiques se prennent l'une l'autre. PagedAttention donne au planificateur une ressource KV à grains fins à négocier.`RUNNING`L'établissement de la liste  est une politique de planification supplémentaire, et non un système séparé.

Vous n'avez pas besoin de connaître chaque drapeau, vous devez savoir ce que le planificateur optimise: un bon produit en fonction du budget du bloc KV, soumis à la découpe de pré-remplissage en morceaux.

### Vérifiez la matrice de compatibilité

Vérifiez chaque combinaison de fonctionnalités contre la matrice de compatibilité pour votre version exacte de vLLM avant de les activer toutes à la fois, car ce qui compose les modifications entre les versions. Dans la version 0.18.0, la matrice de fonctionnalités marque le décoding spéculatif comme compatible avec le pré-remplissage et le préfixe en détail en morceaux, et la page de décoding spéculatif énumère deux incompatibilités connues: le parallélisme du pipeline à travers la version 0.15.0, et la spéculation du modèle de projet à travers la version 0.10.0. Pour le projet de méthode lui-même, la méthode par défaut de 2026 est souvent EAGLE-3 (`"method": "eagle3"`), couverte par la phase 17 · 05.

### Les chiffres que vous devriez vous rappeler

- Llama 3.3 70B FP8, H100 SXM5, 128 simultanément, tous les trois en: 2 200-2 400 tok/s.
- Le même modèle, VLLM par défaut (pas de pré-remplissage en morceaux): ~ 1800 tok/s.
- Le même modèle, PyTorch avant naïf boucle: ~600 tok/s.
- Déchets de fragmentation de KV sous PagedAttention à charge de production: < 4%.
- P99 ITL sous charge mixte: ~15 ms avec pré-remplissage en morceaux, ~50 ms sans.

### À quoi ressemble le programmeur

```
while True:
    finished = [s for s in RUNNING if s.is_done()]
    for s in finished: release_blocks(s); RUNNING.remove(s)

    while WAITING and have_free_blocks_for(WAITING[0]):
        s = WAITING.pop(0)
        allocate_initial_blocks(s)
        RUNNING.append(s)

    # schedule prefill chunks + decode in one batch
    batch = []
    for s in RUNNING:
        if s.in_prefill:
            batch.append(next_prefill_chunk(s))   # e.g. 512 tokens
        else:
            batch.append(decode_one_token(s))     # 1 token

    run_forward(batch)                            # one fused GPU call
```

`code/main.py`C'est exactement cette boucle dans stdlib Python avec de faux nombres de jetons et de faux latences avant.

```figure
tensor-parallel
```

## Utilisez-le

`code/main.py`Simule un planificateur de style vLLM avec des fonctionnalités commutables.

- `NAIVE`mode: une demande à la fois, aucune mise en lots.
- `STATIC`mode: plaquette et attente, batchage classique.
- `CONTINUOUS`mode: admission et libération au niveau d'itération.
- `CONTINUOUS + CHUNKED`mode: pré-remplir les tranches interdites avec décode.

La sortie montre le débit total (tokens par seconde virtuelle), la moyenne TTFT et P99 ITL.`CONTINUOUS + CHUNKED`la ligne doit être la principale dans le trafic mixte.

## La faire partir

Cette leçon produit `outputs/skill-vllm-scheduler-reader.md`. Compte tenu de la configuration de service (dimension de lot, utilisation de la mémoire KV, taille de pré-remplissage par morceaux, configuration spéculative), il produit un diagnostic de planificateur qui indique lequel des trois défauts est le cou de bouteille et ce qu'il faut régler.

## Exercices

1. On court .`code/main.py`- Comparer`STATIC`à `CONTINUOUS`En ce qui concerne les besoins de la production, la différence entre les besoins de production et les besoins de production est la différence entre les besoins de production et les besoins de production.
2. Modifier le programmeur de jouets pour ajouter `--max-num-batched-tokens`. Quelle est la valeur correcte pour un H100 exécutant Llama 3.3 70B FP8 ? (indice: il s'agit d'une fonction de la taille des blocs KV et du nombre de blocs libres, pas de HBM brut.)
3. Retournez les notes de sortie de vLLM v0.18.0. Quelles combinaisons de drapeaux sont mutuellement exclusives ?
4. Compute le gaspillage de fragmentation du cache KV pour une trace de 1000 requêtes avec une moyenne de 1500 jetons de sortie, std 600 jetons, sous (a) allouement contigu par requête à 8192 max, (b) PagedAttention avec 16 blocs de jetons.
5. Expliquez dans un paragraphe pourquoi le préchargement en morceaux aide le P99 ITL mais pas le débit en isolement.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| PagedAttention | "the KV trick" | Fixed-size block allocator for KV cache; fragmentation <4% |
| Block table | "the page table" | Per-sequence map from logical token position to physical KV block |
| Continuous batching | "dynamic batching, but right" | Admit/release decisions made every decode iteration |
| Chunked prefill | "prefill splitting" | Break long prefill into 512-token slices interleaved with decode |
| TTFT | "first token time" | Prefill + queue + network; dominated by prefill at long prompts |
| ITL | "inter-token latency" | Time between consecutive decode tokens; dominated by batch size |
| Goodput | "throughput that meets SLO" | Requests/sec that still hit TTFT and ITL targets (Phase 17 · 08 reports it as the share of requests) |
| V1 scheduler | "the new scheduler" | vLLM's 2026 scheduler; runs continuous batching with chunked prefill |
| `--gpu-memory-utilization` | "the memory knob" | Fraction of HBM reserved for KV blocks after weights and activations |

## Pour en savoir plus

- [vLLM documentation — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode/) source officielle sur la compatibilité des pré-remplissages en morceaux et des décodages spéculatifs.
- [vLLM Release Notes (NVIDIA)](https://docs.nvidia.com/deeplearning/frameworks/vllm-release-notes/index.html) 2026 libérer la cadence et le comportement spécifique à la version.
- [vLLM Blog — PagedAttention](https://blog.vllm.ai/2023/06/20/vllm.html) l'écriture originale qui définit encore comment penser à l'allocateur.
- [PagedAttention paper (arXiv:2309.06180)](https://arxiv.org/abs/2309.06180) analyse de fragmentation et conception de calendrier.
- [Aleksa Gordic — Inside vLLM](https://www.aleksagordic.com/blog/vllm) V1 détaillé planificateur de marche avec des graphiques de flammes.
