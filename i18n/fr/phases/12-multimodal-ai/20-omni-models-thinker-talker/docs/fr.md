# Modèles omni: Qwen2.5 Omni et la séparation de pensée et de discours

> La démo de produit de GPT-4o en mai 2024 a été perturbateur non pas à cause du modèle sous-jacent mais à cause de la forme du produit  une interface vocale où vous parlez, le modèle voit ce que voit la caméra, et il parle en moins de 250 ms. L'écosystème ouvert a passé le reste de 2024 et 2025 à courir pour atteindre cette surface de produit. Qwen2.5 Omni (mars 2025) est la conception ouverte de référence: un Thinker (grand transformateur générateur de texte) plus un Talker (transformateur générateur de parole parallèle), relié par des jetons de parole en streaming. Mini-Omni l'a simplifié, Moshi a correspondu à sa latence, GLM-4-Voice l'a étendu au chinois. Cette leçon explique l'architecture Thinker-Talker et le budget de latence qui permet de diffuser en temps réel le dialogue.

**Type:** Build
**Languages:** Python (stdlib, streaming pipeline latency simulator + VAD loop), TypeScript
**Prerequisites:** Phase 12 · 19 (audio-LLMs), Phase 12 · 16 (any-to-any)
**Time:** ~180 minutes

## Objectifs d'apprentissage

- Divisez le pipeline d'inférence en Thinker (réflexion par texte) et Talker (synthèse de la parole) et expliquez pourquoi le streaming parallèle fonctionne.
- Calculer le budget de temps à premier octet audio (TTFAB) pour une interaction de conversation, composante par composante.
- Décrivez la position alignée dans le temps de TMRoPE en codant à travers la vision, l'audio et le texte dans le Thinker.
- Nombrez les deux modèles de conversation en temps réel, demi-duplex et plein-duplex, et expliquez comment la prise de tour VAD conduit la transmission demi-duplex.

## Le problème

Un assistant vocale en temps réel doit faire beaucoup, rapidement:

1. Écoutez l'utilisateur. Tokenization de la parole en temps réel, détection de l'activité vocale (VAD) pour savoir quand ils ont fini de parler.
2. Optionnellement, l'entrée de la caméra à 2 à 4 FPS, diffusée dans le Thinker avec l'audio.
3. Réfléchissez, composez une réponse conditionnée par l'historique de la conversation.
4. Synthétisez des jetons audio, décodez en forme d'onde, diffusez-les sur les haut-parleurs de l'utilisateur.

Chaque étape ajoute une latence. Le sentiment de conversation nécessite un total de retour et retour < 500ms  en dessous de cela, l'utilisateur arrête de remarquer le retard.

Tout le matériel doit être diffusé en streaming.

## Le concept

### Pensant et parlant

La décomposition de Qwen2.5 Omni:

- Pensateur: un transformateur générateur de texte 7B-80B. Consomme des jetons de texte + image + audio interligés.
- Parleur: un transformateur générateur de voix plus petit (200M-1B). Consomme les jetons de sortie de texte de Thinker ainsi que les jetons de contexte de parole récents.
- Décodeur de parole: un décodeur de forme d'onde en streaming (SNAC, famille MoVQGAN) qui prend des jetons de parole à des échantillons audio en temps réel.

La séparation est importante. Le penseur doit être grand pour un bon raisonnement. Le locuteur peut être petit parce que son travail est local  convertir le texte en jetons de parole. Le plus grand locuteur n'est pas plus expressif; il est plus lent.

- Les deux en parallèle:

1. Le penseur émet un jeton texte .$t_i$- Je suis désolé .
2. Le plus grand consommateur .$t_i$(via streaming) et émet des jetons de parole $s_i, s_{i+1}, \ldots, s_{i+k}$- Je suis désolé .
3. Le décodeur de parole consomme des jetons de parole à leur arrivée et émet des échantillons audio.
4. Quand Thinker sera au code texte .$t_{i+3}$, le talkers a déjà diffusé l' audio pour $t_0, \ldots, t_{i+2}$- Je suis désolé .

### TMRoPE  positions multimodelles alignées dans le temps

Le penseur doit intégrer des images (arrivant à, disons, 4 FPS), des images audio (arrivant à 50 images/seconde) et du texte de l'historique de la conversation.

TMRoPE attribue des timestamps absolus à chaque jeton. jeton de vision à t=2,3s. jeton audio à t=2,32s. jeton de texte de l'utilisateur "arrête" à t=2,35s. RoPE fait tourner l'attention par timestamp; le modèle les voit comme temporairement concurrents.

C'est l'infrastructure pour "il a fait signe de la main en disant bonjour" pour fonctionner  le modèle voit le cadre vidéo et l'audio au même moment conceptuel.

### Synthèse du discours en continu

Les jetons de parole doivent être en flux. Mini-Omni (Xie & Wu, 2024) a introduit "les modèles de langage peuvent entendre, parler tout en pensant en streaming": les jetons de sortie Thinker et les jetons de sortie Talker interviennent dans la même séquence.

Moshi (Défossez et al., octobre 2024) est la mise en œuvre ouverte la plus rapide. 160 ms TTFAB sur un seul A100. Architecture: un transformateur 7B unique qui émet des jetons de texte et de parole sur des positions alternatives, avec un "monologue interne" qui sépare le flux de pensée du flux de parole.

### VAD et tournée

La détection de l'activité vocale est effectuée sur le côté d'entrée.

- demi-duplex: l'utilisateur parle, le modèle écoute. le modèle parle, l'utilisateur écoute. transfert clair via la détection du silence VAD (~ 200 ms).
- Le modèle peut revenir en arrière ou interrompre. Beaucoup plus difficile. Moshi prend en charge cela.

Qwen2.5 Omni prend en charge la moitié du duplex par défaut, avec la prise de tour via un seuil de silence.

### Qwen3-Omni (novembre 2025)

Le successeur. Qwen3-80B Thinker, plus grand Talker, amélioré TMRoPE-v2. La latence proche de 250ms de GPT-4o. Poids ouverts.

### Budget de la latence de production

Pour une interaction de streaming typique:

- Mic -> jetons audio: 40-80 ms.
- Préchargement (immédiat + historique): 100-200 ms à 7B, beaucoup plus à 70B.
- Le premier jeton de texte de Thinker: 40 ms.
- Le premier jeton texte est traité par le locuteur: 20 ms.
- Premiers jetons de parole engagés: 40 ms.
- Décodeur résiduel-VQ: 30 ms.
- Décode de forme d'onde de parole: 50-80 ms.

TTFAB total: 320-490 ms à 7B, 600-900 ms à 70B. La qualité frontalière signifie généralement 70B+; d'où l'écart de latence frontalière.

### Mathématiques du taux de jetons

À 16 kHz de la parole avec des jetons de parole de base de 50 Hz, vous avez besoin de 50 jetons de parole par seconde de sortie. Le locuteur doit émettre ≥ 50 tok/s pour suivre le rythme.

C'est pourquoi de petits modèles Talker dédiés existent plutôt que "utiliser simplement le modèle principal".

```figure
l5-thinker-talker
```

## Utilisez-le

`code/main.py`- Le numéro de la liste:

- Simule un pipeline Thinker-Talker avec des taux d'émission de jetons simulés.
- Compute TTFAB pour les tailles de modèle configurables et les taux d'échantillonnage du micro.
- Il montre une demi-duplex avec un seuil de silence VAD.

## La faire partir

Cette leçon produit `outputs/skill-omni-streaming-budget.md`. Compte tenu du TTFAB cible et du jeu de fonctionnalités (vision-in, bilingue, double-ensemble) d'un produit vocal en temps réel, il choisit Qwen2.5-Omni, Qwen3-Omni, Moshi ou Mini-Omni et taille le Thinker/Talker.

## Exercices

1. Sur un 7B Thinker et un 300M Talker, écrivez la latence de chaque composant.

2. Qwen2.5 Omni utilise TMRoPE. Décrivez ce que le modèle voit pour une requête où l'utilisateur commence à parler à t=1s et la caméra capture un geste à t=1.2s.

3. Le support du duplex complet exige que le modèle émette de l'audio en écoutant.

4. Lisez l'article de Moshi, section 4. Décrivez la séparation "monologue interne" et pourquoi elle évite la séparation "pensateur-parleur".

5. Comptez le budget de débit: à quelle vitesse un Talker doit-il émettre des jetons pour suivre le rythme de la parole de 16 kHz à 50 jetons de couche de base par seconde?

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Thinker | "Reasoning brain" | Large text-generating transformer producing what to say |
| Talker | "Speech-generating mouth" | Small transformer producing discrete speech tokens from Thinker's text |
| TTFAB | "Latency budget" | Time-to-first-audio-byte: from user speech end to first audio sample out |
| TMRoPE | "Time-aligned RoPE" | Position encoding using absolute timestamps across vision, audio, text |
| Half-duplex | "Turn-taking" | User and model alternate; VAD silence detects user-done |
| Full-duplex | "Simultaneous" | Model can speak and listen at the same time; backchannel capable |
| Inner monologue | "Moshi separation" | Single-model design where thinking-stream and speaking-stream interleave |

## Pour en savoir plus

- [Xu et al. — Qwen2.5-Omni (arXiv:2503.20215)](https://arxiv.org/abs/2503.20215)
- [Qwen Team — Qwen3-Omni (arXiv:2509.17765)](https://arxiv.org/html/2509.17765v1)
- [Xie & Wu — Mini-Omni (arXiv:2408.16725)](https://arxiv.org/abs/2408.16725)
- [Défossez et al. — Moshi (arXiv:2410.00037)](https://arxiv.org/abs/2410.00037)
- [Zeng et al. — GLM-4-Voice (arXiv:2412.02612)](https://arxiv.org/abs/2412.02612)
