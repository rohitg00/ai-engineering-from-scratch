# Modèles audio: le murmure à l'audio Flamingo 3 Arc

> Whisper (Radford et coll., décembre 2022) a réglé la reconnaissance vocale  680 000 heures de discours multilingue mal supervisé, un simple transformateur de codeur-décodeur, une référence qui a fait que chaque version ASR ultérieure le cite. Mais reconnaître n'est pas raisonner. Pour demander "quels instruments sont dans cet enregistrement" ou "quels sentiments l'orateur exprime" ou "qu'est-il arrivé à la 3e minute", il faut comprendre l'audio, pas la transcription. Qwen-Audio, SALMONN, LTU et Audio Flamingo 3 de NVIDIA (AF3, juillet 2025) ont progressivement construit cette pile: garder les encoders de la classe Whisper, boulonner les Q-formateurs, former les données d'instruction audio-textuelle, ajouter le raisonnement de la chaîne de pensée. Cette leçon est à l'honneur.

**Type:** Build
**Languages:** Python (stdlib, log-Mel spectrogram + audio Q-former skeleton), TypeScript
**Prerequisites:** Phase 6 (Speech and Audio), Phase 12 · 03 (Q-Former)
**Time:** ~180 minutes

## Objectifs d'apprentissage

- Comptez un spectrogramme log-Mel à partir d'une forme d'onde: fenêtre, FFT, banques de filtres, transformation de journaux.
- Comparez les options d'encodeur: encodeur à sourciller, BEATs, hybride AF-Whisper.
- Construire un Q-former audio: N requêtes apprenables en répondant aux patchs spectrogrammes.
- Expliquer la formation en cascade (Whisper-then-LLM) par rapport à l'entraînement audio-LLM de bout en bout: pourquoi l'entraînement de bout en bout est mieux adapté au raisonnement.

## Le problème

La reconnaissance de la parole a été résolue par Whisper. OCR-of-audio est une marchandise. Mais "commodity" s'arrête à la transcription. Si le modèle ne peut pas raisonner sur ce qu'il a entendu  timing, haut-parleurs, émotion, structure musicale, sons environnementaux  transcription seule ne peut pas conduire les caractéristiques du produit.

Trois itinéraires évidents:

1. Cascade: Whisper transcrit, LLM raisonne sur la transcription. Fonctionne pour les scénarios de langage pur. Échecs pour la musique, l'audio environnemental, le chevauchement multi-speakers, l'émotion.

2. Audio-LLM de bout en bout: un encodeur audio alimente les jetons audio directement dans un LLM, en évitant la transcription. Préserve les informations acoustiques (émotion, haut-parleur, environnement).

3. Hybride: encodeur audio + décodeur de texte qui peut à la fois transcrire et raisonner.

## Le concept

### Spectrogramme log-mel: la fonction d'entrée

Chaque encodeur audio commence par la même fonctionnalité: un spectrogramme log-Mel.

1. Remplacer à 16 kHz.
2. Transformation Fourier à court terme avec des fenêtres de 25 ms, saut de 10 ms.
3. Prenez l'ampleur du résultat de la FFT.
4. Appliquer des bancs de filtres Mel (habituellement 80 filtres à intervalles logs de 0 à 8000 Hz) pour déformer la fréquence perceptuelle.
5. Compresseur de logs$(\log(1 + x))$pour la portée dynamique.

Résultat: un tableau en 2D de forme (T, 80) où T est le nombre de cadres temporels. Pour un clip de 30 secondes à la fréquence d'image de 100 Hz: (3000, 80).

### Le codeur de Whisper

Le codeur de Whisper est un transformateur de style ViT de 12 couches qui traite le spectrogramme log-Mel comme une séquence de cadres temporels.

Pour ASR, le décodeur de Whisper est un transformateur d'attention croisée qui génère des jetons de texte conditionnés sur la sortie de l'encodeur.

Pour les ALM (audio-LLM), vous voulez que le codeur soit utilisé comme entrée dans un autre LLM. Le modèle: encodeur à sourcillement gelé, Q-former entraîneable, LLM gelé ou réglé.

### Les encoders BEAT et audio spécifiques

Whisper a été formé sur des données dominantes par la parole.

BEATs (Chen et coll., 2022) est un transformateur auto-supervisé formé sur AudioSet. Capture la musique et les sons environnementaux mieux que Whisper au même nombre de paramètres.

AF-Whisper (encodeur d'Audio Flamingo 3): commencez à partir du codeur Whisper-large-v3 et continuez à l'entraîner sur la parole, le son et la musique ensemble, de sorte qu'un encodeur transporte à la fois le signal linguistique et l'acoustique.

### Le Q-former audio

Le même schéma que le Q-former visuel de BLIP-2. un nombre fixe de requêtes apprenables (souvent 32 ou 64) se croisent sur les cadres de sortie de l'encodeur audio.

Étapes d'alignement de formation: Q-former seul, perte de contraste + sous-titres sur les paires audio-textuelles (AudioCaps, Clotho).

### Le arc  SALMONN, Qwen-Audio, AF3

SALMONN (Tang et coll., 2023): Whisper + BEATs + Q-former + LLaMA. Le premier audio-LLM ouvert avec une capacité de raisonnement sérieuse.

Qwen-Audio (Chu et coll., 2023): architecture similaire, formée sur un ensemble de données plus riche, réglée pour le dialogue multi-tours. MMAU ~ 0,60.

LTU  Écoutez, pensez, comprenez (Gong et coll., 2023): données explicites de raisonnement, se concentrent sur la chaîne de pensée sur les clips audio.

Audio Flamingo 3 (Goel et coll., juillet 2025): le SOTA ouvert actuel. 7B LLM backbone (Qwen2.5-7B), un encodeur audio AF-Whisper construit à partir de Whisper-large-v3, de petites couches d'adaptateur dans le LLM, de formation sur 1M + paires d'instructions audio-texte. MMAU 0.72, correspond à la frontière propriétaire sur certaines sous-tasques.

AF3 introduit également une chaîne de pensée sur demande pour l'audio: le modèle peut émettre optionnellement des jetons de pensée ("laissez-moi d'abord identifier les instruments: ...") avant la réponse finale.

### Cascade contre bout à bout

L'équipement de transport en cascade:

1. Whisper transcrit le texte audio → texte.
2. Les raisons de la maîtrise de la loi sur le texte.

Il fonctionne parfaitement pour "récapituler ce podcast".
- "Quelle est l'humeur de cette chanson?"  L'humeur est dans le son, pas les mots.
- "Qui parle, Alice ou Bob?"  nécessite l'identification de l'orateur.
- "A quelle seconde l'explosion se produit-elle ?"
- "Est-ce que c'est réel ou une source audio?"  La détection de faux profonds a besoin de fonctionnalités acoustiques.

Le Qwen-Audio et l'AF3 gèrent la musique, l'environnement et les émotions de manière native.

### Récipes de production 2026

Pour un nouveau produit audio-compréhensible:

- Cascade si: la transcription est le but, pas de musique, pas d'inférence émotionnelle.
- AF3 / Qwen-Audio-famille si: musique, émotion, haut-parleur, ou raisonnement audio complexe.

Le cascade est moins cher et plus simple.

### MMAU  le critère de référence de la raisonnement audio

MMAU (Massive Multimodal Audio Understanding) est le critère de référence pour le raisonnement audio de 2024 à 2025:

- 10 000 couples de QA audio-textuels à travers la parole, la musique, les sons environnementaux.
- Il couvre la classification, le raisonnement temporel, le raisonnement causale, l'AQ à durée indéterminée.
- Tests de ce que les pipelines en cascade manquent systématiquement.

L'écart est plus petit que le delta ouvert versus fermé de VideoMME, ce qui indique que les LLM audio sont en train de mûrir.

```figure
audio-text-ctc
```

## Utilisez-le

`code/main.py`- Le numéro de la liste:

- Implémentation de calcul de spectrogramme log-Mel dans stdlib: fenêtre, DFT naïf, filtre-banque Mel.
- Audio Q-ancien squelette: donné encodeur cadres de sortie, calculer Q, K, V, attention, et émettre N jetons.
- Comparaison cascade contre bout à bout sur une tâche de jouet.

## La faire partir

Cette leçon produit `outputs/skill-audio-llm-pipeline-picker.md`. En raison d'une tâche audio (transcription, marquage de musique, inférence des émotions, diarisation multi-enceintes, classification de l'environnement), il choisit en cascade, AF3 de bout en bout ou un hybride.

## Exercices

1. Comptez la dimension du spectrogramme log-Mel pour un clip de 30 secondes à 16 kHz, une fenêtre de 25 ms, un saut de 10 ms, 80 bins Mel. Comment cela change-t-il à 48 kHz?

2. Pourquoi Whisper ne joue pas bien dans la musique ?

3. Audio Q-former avec 64 requêtes contre 32: à quelle complexité de tâche 64 paie ? 32 sauvegarder la computation pour quoi ?

4. Lisez la section 4 de l'AF3 sur la pensée sur demande.

5. Mettez en œuvre un pipeline de diarisation minimal en utilisant la sortie de l'AF3.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Log-Mel spectrogram | "Mel features" | 2D (time, frequency) array of log-magnitude values after Mel filter banks |
| Audio Q-former | "Audio Perceiver" | Cross-attention bottleneck from audio encoder output to fixed-length queries feeding the LLM |
| Cascaded | "ASR-then-LLM" | Pipeline where Whisper transcribes and a text LLM reasons; loses acoustic information |
| End-to-end | "Audio-LLM" | Audio features enter the LLM directly via Q-former; preserves acoustic signal |
| BEATs | "Audio AudioSet encoder" | SSL transformer trained on AudioSet; strong on music + environmental sounds |
| MMAU | "Audio reasoning bench" | 10k QA pairs across speech, music, environment; 2024 eval standard |
| On-demand thinking | "Audio CoT" | Model can optionally emit reasoning tokens before final answer, lifts accuracy 3-5 pts |

## Pour en savoir plus

- [Radford et al. — Whisper (arXiv:2212.04356)](https://arxiv.org/abs/2212.04356)
- [Chu et al. — Qwen-Audio (arXiv:2311.07919)](https://arxiv.org/abs/2311.07919)
- [Goel et al. — Audio Flamingo 3 (arXiv:2507.08128)](https://arxiv.org/abs/2507.08128)
- [Tang et al. — SALMONN (arXiv:2310.13289)](https://arxiv.org/abs/2310.13289)
- [Gong et al. — LTU (arXiv:2305.10790)](https://arxiv.org/abs/2305.10790)
