# Sélection de serveur auto-hébergé  Moteur adapté au matériel et à l'échelle

> La sélection du moteur est une fonction du matériel, de l'échelle et de l'écosystème  pas une lecture du classement. Quatre moteurs dominent l'inférence auto-hébergée en 2026: llama.cpp, Ollama, vLLM, SGLang, avec TGI en arrière-plan dans le mode maintenance. **llama.cpp**est le plus rapide sur CPU  le plus large support de modèle, contrôle complet sur la quantification et le fillage. **Ollama**est l'installation à commande unique de l'ordinateur portable de développement, ~15-30% plus lente que llama.cpp (sérialisation Go + CGo + HTTP), 3x débit gap sous charge prod-like. **TGI entered maintenance mode December 11, 2025** seulement des corrections de bugs, ~10% de débit brut plus lent que vLLM mais historiquement de la meilleure observabilité et de l'intégration de l'écosystème HF. Cet état de maintenance en fait un pari à long terme risqué  SGLang ou vLLM sont des défauts plus sûrs pour les nouveaux projets. **vLLM**est la production par défaut à usage général  v0.15.1 (février 2026) ajoute PyTorch 2.10, RTX Blackwell SM120, H200 optimisation. **SGLang**est le spécialiste agentique de la production de plus de 400 000 GPUs en mode multi-tours / préfixes (xAI, LinkedIn, Cursor, Oracle, GCP, Azure, AWS). Réservation du matériel: CPU-first → llama.cpp. AMD / non-NVIDIA → vLLM est le chemin le plus soutenu (TRT-LLM est verrouillé par NVIDIA). Le modèle de pipeline 2026: dev = Ollama, staging = llama.cpp, prod = vLLM ou SGLang. Les moteurs prennent différents formats de poids  GGUF pour la famille llama.cpp, HF safetensors pour les moteurs GPU  de sorte qu'une conversion de format peut être placée entre les étapes.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, engine-decision tree walker)
**Prerequisites:** All Phase 17 lessons covering engines (04, 06, 07, 09, 18)
**Time:** ~45 minutes

## Objectifs d'apprentissage

- Choisissez un moteur donné (CPU / AMD / NVIDIA Hopper / Blackwell), l'échelle (1 utilisateur / 100 / 10,000) et la charge de travail (chat général / agent / long-context).
- Nommez le statut de mode d'entretien TGI 2026 (11 décembre 2025) et pourquoi il fausse les nouveaux projets vers vLLM ou SGLang.
- Décrire le pipeline de développement/étape/production, y compris où une conversion en format GGUF en séfétensors se situe entre les étapes.
- Expliquez pourquoi "CPU-first" pointe vers llama.cpp et "AMD" exclut TRT-LLM.

## Le problème

Votre équipe commence un nouveau projet de LLM auto-hébergé. Un ingénieur dit Ollama, un autre dit vLLM, un troisième dit " TGI ne fonctionne pas juste hors de boîte ? " Les trois sont bons pour différents contextes. Aucun n'est bon pour tous.

En 2026, l'arbre de choix compte: le matériel d'abord, la deuxième dimension, la troisième charge de travail.

## Le concept

### Les cinq moteurs

| Engine | Best for | Notes |
|--------|----------|-------|
| **llama.cpp** | CPU / edge / minimal deps / widest model support | Fastest on CPU, full control |
| **Ollama** | Dev laptops, single user, one-command install | 15-30% slower than llama.cpp; 3x prod throughput gap |
| **TGI** | HF ecosystem, regulated industries | **Maintenance mode Dec 11, 2025** |
| **vLLM** | General-purpose production, 100+ users | Broad production default; v0.15.1 Feb 2026 |
| **SGLang** | Agentic multi-turn, prefix-heavy workloads | 400,000+ GPUs in production |

### Décision de première main sur le matériel

**CPU-first**Il fonctionne aussi mais est plus lent. Aucun autre moteur n'est compétitif sur le processeur.

**AMD GPU**→ vLLM est le chemin le plus soutenu (support ROCm AMD). SGLang fonctionne également. TRT-LLM est verrouillé par NVIDIA, donc il est hors service.

**NVIDIA Hopper (H100 / H200)**→ VLLM ou SGLang ou TRT-LLM. Les trois sont de premier rang.

**NVIDIA Blackwell (B200 / GB200)**→ TRT-LLM est le leader du débit (phase 17 · 07). vLLM et SGLang suivent de près.

**Apple Silicon (M-series)**Il est enveloppé dans le métal.

### Décision de deuxième échelle

**1 user / local dev**Une commande, le premier jeton en quelques secondes.

**10-100 users / small team**→ VLLM à un seul GPU.

**100-10k users / production**→ vLLM production-stack (phase 17 · 18) ou SGLang.

**10k+ users / enterprise**→ vLLM production-stack + décomposé (phase 17 · 17) + LMCache (phase 17 · 18).

### La troisième décision

**General chat / Q&A**→ vLLM gagne sur le défaut large.

**Agentic multi-turn (tools, planning, memory)**→ L'attention radicale de SGLang (phase 17 · 06) est la principale.

**RAG with heavy prefix reuse**→ SGLang.

**Code generation**→ VLLM bien; SGLang légèrement mieux sur le cache.

**Long context (128K+)**→ VLLM + pré-remplissage en morceaux; SGLang + KV en couches.

### Le piège de maintenance TGI

Hugging Face TGI est entré en mode maintenance le 11 décembre 2025  seulement les corrections de bugs à l'avenir.

Pour les nouveaux projets en 2026: défaut loin de TGI. Les déploiements existants de TGI peuvent se poursuivre mais devraient éventuellement migrer.

### Le modèle du pipeline

Dev (Ollama) → staging (llama.cpp) → prod (vLLM). Les moteurs prennent différents formats de poids  GGUF pour la famille llama.cpp, HF safetensors pour les moteurs GPU  afin qu'une conversion de format puisse être effectuée entre les étapes. Les ingénieurs itérent rapidement sur les ordinateurs portables; la staging reflète la quantification de la production; prod est la cible de service.

### Avertissement d'Olama

Ollama est idéal pour le développement. Il n'est pas idéal pour la production partagée: la sérialisation HTTP Go ajoute des coûts généraux, la gestion de la concurrence est plus simple que vLLM, le support OpenTelemetry est en retard. Utilisez Ollama où il brille  un utilisateur, une commande  et passez à vLLM pour le partage.

### L'hébergement personnel et la gestion sont une décision séparée .

La phase 17 · 01 (hyperscalers gérés), · 02 (plateformes d'inférence) couvre géré. Cette leçon suppose que vous avez déjà décidé d'auto-héberger. Les raisons d'auto-héberger: résidence des données, ajustement personnalisé, propriété totale des coûts à l'échelle, modèle de domaine non disponible sur hébergé.

### Les chiffres que vous devriez vous rappeler

- Mode de maintenance TGI: 11 décembre 2025.
- vLLM v0.15.1: février 2026; PyTorch 2.10; support Blackwell SM120.
- L'empreinte de production de SGLang: plus de 400 000 GPU.
- L'écart de débit d'Ollama par rapport à llama.cpp: 15 à 30% plus lent; 3 fois moins de charge de prod.

```figure
data-parallel
```

## Utilisez-le

`code/main.py`est un marcheur de l'arbre de décision: compte tenu du matériel + de l'échelle + de la charge de travail, il choisit un moteur et explique pourquoi.

## La faire partir

Cette leçon produit `outputs/skill-engine-picker.md`Il choisit un moteur et écrit le plan de migration.

## Exercices

1. On court .`code/main.py`La sortie correspond-elle à votre intuition ?
2. Votre infra est de 12 H100 et 8 MI300X AMD.
3. Une équipe veut utiliser TGI en 2026 parce que "c'est ce que nous savons".
4. Ollama dev à vLLM prod: quels changements dans la quantification, la configuration et l'observabilité ?
5. Produit RAG avec un préfixe P99 de longueur 8K et une réutilisation élevée entre les locataires.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| llama.cpp | "the CPU one" | Widest model support, fastest on CPU |
| Ollama | "the laptop one" | One-command install, dev-grade throughput |
| TGI | "HF's serving" | Maintenance mode since Dec 2025 |
| vLLM | "the default" | Broad production baseline 2026 |
| SGLang | "the agentic one" | Prefix-heavy, RadixAttention |
| TRT-LLM | "NVIDIA-locked" | Blackwell throughput leader, NVIDIA only |
| GGUF | "llama.cpp format" | Bundled K-quant variants |
| Production-stack | "vLLM K8s" | Phase 17 · 18 reference deployment |
| Pipeline pattern | "dev→stage→prod" | Ollama → llama.cpp → vLLM; weight formats differ per engine |

## Pour en savoir plus

- [AI Made Tools — vLLM vs Ollama vs llama.cpp vs TGI 2026](https://www.aimadetools.com/blog/vllm-vs-ollama-vs-llamacpp-vs-tgi/)
- [Morph — llama.cpp vs Ollama 2026](https://www.morphllm.com/comparisons/llama-cpp-vs-ollama)
- [n1n.ai — Comprehensive LLM Inference Engine Comparison](https://explore.n1n.ai/blog/llm-inference-engine-comparison-vllm-tgi-tensorrt-sglang-2026-03-13)
- [PremAI — 10 Best vLLM Alternatives 2026](https://blog.premai.io/10-best-vllm-alternatives-for-llm-inference-in-production-2026/)
- [TGI maintenance announcement](https://github.com/huggingface/text-generation-inference) notes de délivrance.
- [vLLM v0.15.1 release notes](https://github.com/vllm-project/vllm/releases)
