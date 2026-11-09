# MIO et modèles multimodels en streaming

> GPT-4o envoie un produit que la plupart des modèles ouverts ne peuvent pas reproduire: un agent qui entend la voix, voit la vidéo et parle en temps réel. La réponse à l'écosystème ouvert à la fin de 2024 était MIO (Wang et coll., septembre 2024). MIO symbolise le texte, l'image, la parole et la musique, entraîne un transformateur causale sur les séquences interligées et génère toute modalité à toute modalité. AnyGPT (Zhan et coll., février 2024) était la preuve du concept; MIO est l'échelle-up; Unified-IO 2 (Allen AI, décembre 2023) est le cousin avec la vision + action de la terre. Cette leçon est le modèle de tout à tout  quatre tokenizers, un transformateur, décodeur convivial pour le streaming.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, four-modality token allocator + streaming decode loop)
**Prerequisites:** Phase 12 · 11 (Chameleon), Phase 6 (Speech and Audio)
**Time:** ~120 minutes

## Objectifs d'apprentissage

- Conçuez un vocabulaire commun qui héberge des jetons de texte, d'image, de parole et de musique sans collision.
- Comparer SEED-Tokenizer (images) et SpeechTokenizer résiduel-VQ (speech) sur les compromis de compression + reconstruction.
- Expliquez le programme en quatre étapes qui construit une génération à l'autre.
- Nombre des trois recettes ouvertes à tout le monde et de leurs principales compromis: MIO, AnyGPT, Unified-IO 2.

## Le problème

Un modèle multimodal unifié est facile à revendiquer et difficile à construire à l'échelle. La plupart des systèmes "tout à tout" jusqu'en 2024 ont été pipelineés: modèle de vision → représentation de texte → modèle de parole → audio. Chaque saut perd de l'information, ajoute de la latence et complique la formation. La vidéo démo de GPT-4o a montré une alternative à un modèle unique avec une réponse ultérieure; systèmes ouverts suivis de mois.

Les défis de l'ingénierie:

- Les tokenizers doivent exister pour chaque modalité, compresser sans perte - suffisamment pour la reconstruction, et produire des jetons à des taux que le transformateur peut consommer.
- Un seul vocabulaire doit allouer de l'espace pour le texte (32k+), l'image (8k+), la parole (4k+), la musique (8k+).
- Les données de formation doivent couvrir chaque paire d'entrées et de sorties (textes→image, images→speech, speech→image, etc.) ou le modèle doit être composé.
- L'inference doit diffuser des jetons de sortie assez rapidement pour une latence de conversation (<500ms temps à premier octet audio).

## Le concept

### Quatre tokenizers pour quatre modalités

La pile de jetons de MIO:

- Le texte: BPE standard, vocables ~32000.
- Image: SEED-Tokenizer (2023), un jeton d'image discrète avec un codebook 8192 entrés qui émet 32 jetons par image.
- Discours: SpeechTokenizer résiduel-VQ (2023), qui encode une forme d'onde de 16 kHz en 8 livres de code hiérarchiques; le premier niveau est un contenu grossier, les niveaux ultérieurs ajoutent une prosodie et une identité de haut-parleur. MIO conserve le niveau de contenu plus les trois premiers niveaux de timbre, 1024 codes chacun, donc 4096 identifiants de discours.
- Musique: résiduel similaire-VQ (famille de Meta MusicGen / Encodec), 4-8 livres de code. MIO lui-même ne fournit pas de jeton musical (sa quatrième modalité est la vidéo, comme les cadres à travers le jeton image); le jouet de cette leçon ajoute de la musique pour montrer comment une nouvelle modalité revendique une gamme d'identification.

Chaque modalité produit des jetons entiers. Les jetons obtiennent des plages d'identification disjointes dans le vocabulaire partagé:

```
text:   0..31999
image:  32000..40191  (8192 image tokens)
speech: 40192..44287  (4 codebooks x 1024 speech tokens)
music:  44288..52479  (8192 music tokens, the toy's extension)
sep:    52480..52485  (<image>, <speech>, <music>, </...>)
```

Total: 52 000 mots. L'intégration et la projection de sortie s'étendent sur tout.

### Décode de diffusion

La génération de la parole utilise le VQ résiduel. Le transformateur prédit les jetons de parole de base (couche 0); un quantificateur résiduel décodé parallèle prédit les couches suivantes. Chaque jeton de couche 0 est d'environ 50 ms d'audio à 16 kHz.

Le schéma de diffusion:

1. L'utilisateur parle en microphone; le jeton audio en temps réel émet des jetons de parole tous les 50 ms.
2. MIO consomme des jetons à leur arrivée (précomplissement immédiat + avance progressive).
3. Les jetons de sortie sont diffusés comme générés; un décodeur de voix parallèle les convertit en échantillons audio avec une latence de ~50-150 ms.
4. Temps à premier octet audio: le document MIO ne rapporte aucun numéro de latence. Le budget ci-dessous place cette conception à environ 300 ms au mieux, contre ~250 ms de GPT-4o.

Mini-Omni (arXiv:2408.16725), GLM-4-Voice (arXiv:2412.02612), et Moshi (arXiv:2410.00037) sont des conceptions de streaming de la parole-LLM complémentaires.

### Programme de formation en quatre étapes

Le programme de formation du MIO:

1. Étapes 1  alignement. Corps de paire de modalités à grande échelle: image texte, discours texte, musique texte. Chaque paire utilise son propre segment de vocabulaire de jeton.
2. Étapes 2  interligés. Documents interligés multi-modalité (blogs avec images + vidéo, podcasts avec transcriptions, etc.).
3. Étapes 3  amélioré par la parole. Données audio supplémentaires pour améliorer la qualité de la parole sans perdre la capacité du texte.
4. Étapes 4  SFT. L'écoute des instructions dans les différentes modalités: VQA, sous-titres, narration, dialogue de parole à parole.

Le manque d'une étape dégrade les capacités spécifiques: sauter la phase 2 et le modèle perd le contexte de la modalité croisée; sauter la phase 3 et la parole est mauvaise.

### Chaîne de pensée visuelle

MIO introduit la chaîne de pensée visuelle: le modèle émet des jetons d'image intermédiaires comme une étape de raisonnement.

1. Émissions `<image>`les jetons qui rendent la scène (à partir de l'image d'entrée ou d'un schéma).
2. Il émet un texte analysant le dessin.
3. Il émet la réponse finale.

L'image intermédiaire rendue sert de scratchpad. Les repères améliorent les tâches de raisonnement spatial. L'idée reflète la chaîne de pensée pour le raisonnement du texte.

### Les concurrents dans n'importe quel

- AnyGPT (arXiv:2402.12226): 4 modalités (texte, image, discours, musique), conception similaire.
- Unified-IO 2 (arXiv:2312.17172): ajoute des sorties d'action de vision, de profondeur, de normes. Plus de diversité de tâches, plus petite échelle.
- NExT-GPT (arXiv:2309.05519): décodeurs de diffusion LLM + modalité spécifique. Pas une approche de modèle unique.
- CoDi (arXiv:2305.11846): diffusion composable; tout à tout via latente partagée.

MIO est le plus proche de pure-token à tout. AnyGPT est son ancêtre conceptuel.

### Budget de la latence

Pour un produit conversationnel, la latence de chaque composant compte:

- Mic à jetons audio: ~ 50 ms.
- Préchargement (tokens audio + historique): ~ 100 ms sur un modèle 8B.
- Le premier jeton de sortie: ~50ms.
- Décodeur de parole parallèle résiduel-VQ +: ~100-150 ms.

Le temps total de la première octet audio: ~ 300 ms minimum. GPT-4o revendique ~ 250 ms. Moshi revendique ~ 160 ms. Ni MIO ni AnyGPT ne publient un chiffre mesuré, alors traitez ce budget comme une estimation, pas une référence.

### Pourquoi tout le monde reste dur

Même en 2026, les modèles ouverts à n'importe qui suivront ceux fermés sur deux axes:

- La qualité de la parole. Le jeton VQ résiduel est déficient; la parole de conversation sonne robotique par rapport aux voix de classe ElevenLabs.
- Le raisonnement à travers les modalités: demander au modèle " chanter sur ce que vous voyez " échoue encore plus souvent que les tâches de vision pure.

Ce sont des problèmes de recherche ouverts. Qwen3-Omni (leçon 12.20) est la tentative ouverte la plus avancée en 2025.

```figure
any-to-any-stream
```

## Utilisez-le

`code/main.py`- Le numéro de la liste:

- Définit l'allocation du vocabulaire à quatre modalités et l'imprime.
- Route une liste d'entrées multimodal (texte, image, clipe audio, musique) via le routeur du tokenizer.
- Simule le décode en streaming pour une réponse texte-à-speech avec le comptage de la latence.
- Compute le temps attendu de la première octet audio donné de l'encodeur, de la pré-remplissage et des latences du décodeur.

## La faire partir

Cette leçon produit `outputs/skill-any-to-any-pipeline-auditor.md`. Compte tenu d'une spécification de produit de conversation (modalités d'entrée, modalités de sortie, cible de latence), il vérifie les choix de conception de la famille MIO et calcule le budget de latence.

## Exercices

1. Votre produit accepte l'entrée de la parole et renvoie la sortie de la parole. Quelle est la cible budgétaire de la latence de bout en bout?

2. Le SpeechTokenizer residual-VQ utilise 8 codebooks. Proposez pourquoi le décoding parallèle des niveaux résiduels est nécessaire (versus séquentiel) et quelles économies de latence cela apporte.

3. Votre vocabulaire a 32k de texte + 8k d'image + 4k de parole. Ajoutez 8k de musique et ~10 séparateurs. Quel est le coût du paramètre d'intégration-matrice à dim 4096 caché?

4. La chaîne de pensée visuelle émet une image intermédiaire.

5. Décrivez sa technique de " monologue interne " et comparez-la à la pensée de la chaîne visuelle de MIO.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Any-to-any | "Multimodal in/out" | A single model that accepts and emits text, image, speech, and music in any direction |
| Residual-VQ | "Speech tokenizer stack" | Multi-codebook tokenization where each layer adds information; base layer is content, later layers are prosody |
| SEED-Tokenizer | "Image codes" | Discrete image tokenizer with an 8192-entry codebook and 32 tokens per image, used by MIO |
| Chain-of-visual-thought | "Visual scratchpad" | The model generates an intermediate image as a reasoning step before its final answer |
| Time-to-first-audio-byte | "TTFAB" | Latency from user voice to first audio output; <500ms for conversational feel |
| Four-stage curriculum | "Training recipe" | Alignment -> interleaved -> speech-enhanced -> SFT, in that order |

## Pour en savoir plus

- [Wang et al. — MIO (arXiv:2409.17692)](https://arxiv.org/abs/2409.17692)
- [Zhan et al. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Lu et al. — Unified-IO 2 (arXiv:2312.17172)](https://arxiv.org/abs/2312.17172)
- [Wu et al. — NExT-GPT (arXiv:2309.05519)](https://arxiv.org/abs/2309.05519)
- [Tang et al. — CoDi (arXiv:2305.11846)](https://arxiv.org/abs/2305.11846)
