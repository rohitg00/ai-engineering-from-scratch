# Reconnaissance du langage (RAS)  CTC, RNN-T, Attention

> La reconnaissance de la parole est une classification audio à chaque étape, collée par un modèle de séquence qui connaît l'anglais et le silence. CTC, RNN-T et l'attention sont les trois façons de le faire. Choisissez une et comprenez pourquoi.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 08 (CNNs & RNNs for Text), Phase 5 · 10 (Attention)
**Time:** ~45 minutes

## Le problème

Vous avez un clip de 10 secondes à 16 kHz. Vous voulez une chaîne: "allumer les lumières de cuisine". Le défi est structurel: les cadres audio ne s'alignent pas un à un avec les caractères. Le mot "ok" peut prendre 200 ms ou 1200 ms. Le silence ponctue la prononciation. Certains phonèmes sont plus longs que d'autres. Le nombre de jetons de sortie n'est pas connu à l'avance.

Trois formules résolvent ceci:

1. **CTC (Connectionist Temporal Classification).**Émettez des probabilités de jetons par cadre, y compris un *blanc* spécial. Répéter et blanchir à la fois à décoder. Non autorégressif, rapide. Utilisé par wav2vec 2.0, MMS.
2. **RNN-T (Recurrent Neural Network Transducer).**Le réseau commun prédit le prochain jeton donné à un cadre d'encodeur et des jetons précédents.
3. **Attention encoder-decoder.**L'encodeur comprime l'audio dans des états cachés, le décodeur serve à générer des jetons autoregressivement.

En 2026, le SOTA WER sur LibriSpeech est de 1,4% (Parakeet-TDT-1.1B, NVIDIA) et de 1,58% (Whisper-Large-v3-turbo). Les différences sont minuscules; les différences de déploiement sont énormes.

## Le concept

![Three ASR formulations: CTC, RNN-T, attention-encoder-decoder](../assets/asr-formulations.svg)

**CTC intuition.**Laissez le codeur exister `T`répartitions au niveau du cadre sur `V+1`jetons (V caractères + blanc). Pour une chaîne cible `y`de longueur `U < T`, tout alignement de cadre qui s' effondre à `y`Les données de l'analyse de la valeur de l'alignement sont calculées.

Les avantages: non autorégressif, diffusable, point de vue zéro. Défaut: * hypothèse d'indépendance conditionnelle *  chaque prédiction de cadre est indépendante des autres, il n'y a donc pas de modèle de langage interne. Fixer avec un LM externe via recherche de faisceau ou fusion superficielle.

**RNN-T intuition.**Ajout d' un * prédicteur * réseau qui intègre l' histoire des jetons et un * joiner * qui combine l' état prédicteur avec le cadre d' encodeur dans une distribution commune sur `V+1`(le `+1`est un nul / no-emission). Modèle explicitement la dépendance conditionnelle CTC ignoré. diffusable parce que chaque étape conditionne uniquement sur les cadres passés et les jetons passés.

Avantages: streaming + LM interne. Défaut: la formation est plus complexe et manque de mémoire (3D retable de perte); les noyaux de perte RNN-T constituent une catégorie de bibliothèques entière.

**Attention encoder-decoder.**Le décodeur (6-32 couches de transformateur) sur les cadres log-mail. Le décodeur (6-32 couches de transformateur) assiste aux sorties d'encodeur pour générer des jetons autoregressivement. Aucune contrainte d'alignement  L'attention ne peut regarder n'importe où dans l'audio. Non diffusable à moins que vous restreignez l'attention (chunked Whisper-Streaming, 2024).

Avantage: la plus haute qualité sur ASR hors ligne, facile à entraîner avec des outils standard seq2seq.

### WER: le numéro unique

**Word Error Rate**- Je suis là.$(S + D + I) / N$Où ?$S$= les remplacements, $D$= les suppressions, $I$=insert, $N$=conte de mots de référence. Correspond à la distance de modification de Levenshtein au niveau des mots. Plus bas est mieux. Un WER supérieur à 20% est généralement inutilisable; inférieur à 5% est la parité humaine pour le langage de lecture.

| Model | LibriSpeech test-clean | LibriSpeech test-other | Size |
|-------|------------------------|------------------------|------|
| Parakeet-TDT-1.1B | 1.40% | 2.78% | 1.1B params |
| Whisper-Large-v3-turbo | 1.58% | 3.03% | 809M |
| Canary-1B Flash | 1.48% | 2.87% | 1B |
| Seamless M4T v2 | 1.7% | 3.5% | 2.3B |

Tous ces systèmes sont basés sur un encodeur-décodeur ou RNN-T. Les systèmes CTC purs (wav2vec 2.0) sont situés autour de 1,82,1% sur le test-clean.

```figure
ctc-collapse
```

## Faites-le

### Étape 1: décodeur avide de CTC

```python
def ctc_greedy(frame_logits, blank=0, vocab=None):
    # frame_logits: list of per-frame probability vectors
    preds = [max(range(len(p)), key=lambda i: p[i]) for p in frame_logits]
    out = []
    prev = -1
    for p in preds:
        if p != prev and p != blank:
            out.append(p)
        prev = p
    return "".join(vocab[i] for i in out) if vocab else out
```

Deux règles: répétition de l'effondrement consécutive, déposez des espaces vides.`a a _ _ a b b _ c`- Je suis là.`a a b c`- Je suis désolé .

### Étape 2: CTC de recherche par faisceau

```python
def ctc_beam(frame_logits, beam=8, blank=0):
    import math
    beams = [([], 0.0)]  # (tokens, log_prob)
    for p in frame_logits:
        log_p = [math.log(max(pi, 1e-10)) for pi in p]
        candidates = []
        for seq, lp in beams:
            for t, lpt in enumerate(log_p):
                new = seq[:] if t == blank else (seq + [t] if not seq or seq[-1] != t else seq)
                candidates.append((new, lp + lpt))
        candidates.sort(key=lambda x: -x[1])
        beams = candidates[:beam]
    return beams[0][0]
```

La production utilise la recherche de faisceaux d'arbres préfixes avec fusion LM; c'est le squelette conceptuel.

### Étape 3: REM

```python
def wer(ref, hyp):
    r, h = ref.split(), hyp.split()
    dp = [[0] * (len(h) + 1) for _ in range(len(r) + 1)]
    for i in range(len(r) + 1):
        dp[i][0] = i
    for j in range(len(h) + 1):
        dp[0][j] = j
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            cost = 0 if r[i - 1] == h[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )
    return dp[len(r)][len(h)] / max(1, len(r))
```

### Étape 4: inférence contre le murmure

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("clip.wav")
print(result["text"])
```

Un liner pour le plus fort ASR général en 2026.

### Étape 5: streaming avec Parakeet ou wav2vec 2.0

```python
from transformers import pipeline
asr = pipeline("automatic-speech-recognition", model="nvidia/parakeet-tdt-1.1b")
for chunk in streaming_audio():
    print(asr(chunk, return_timestamps=True))
```

La diffusion en continu d'ASR nécessite une attention et un état de transport par codeur en morceaux; utilisez une bibliothèque qui la supporte (NeMo pour Parakeet, `transformers`pipeline avec `chunk_length_s`)

## Utilisez-le

La pile de 2026:

| Situation | Pick |
|-----------|------|
| English, offline, max quality | Whisper-large-v3-turbo |
| Multilingual, robust | SeamlessM4T v2 |
| Streaming, low latency | Parakeet-TDT-1.1B or Riva |
| Edge, mobile, <500 ms latency | Whisper-Tiny quantized or Moonshine (2024) |
| Long-form | Whisper with VAD-based chunking (WhisperX) |
| Domain-specific (medical, legal) | Fine-tune wav2vec 2.0 + domain LM fusion |

## Des pièges qui vont encore arriver en 2026

- **No VAD.**Le silence provoque des hallucinations ("Merci de vous avoir regardé!").
- **Character vs word vs subword WER.**Rapporte la réaction de réaction de niveau mot *après* normalisation (minuscule, ponctuation dépourvue).
- **Language ID drift.**L'ID automatique de Whisper dérote les clips bruyants vers le japonais ou le gallois; force `language="en"`Quand tu le sais.
- **Long clips without chunking.**Whisper a une fenêtre de 30 secondes.`chunk_length_s=30, stride=5`Pour tout ce qui reste.

## La faire partir

- Je ne sais pas .`outputs/skill-asr-picker.md`- Choisir un modèle, décoder une stratégie, déchiffrer et fusionner des LM pour une cible de déploiement donnée.

## Exercices

1. **Easy.**On court .`code/main.py`Il décode avidement une sortie CTC fabriquée à la main et calcula WER par rapport à une référence.
2. **Medium.**Appliquez correctement la recherche de faisceau de préfixe dans l'étape 2 (compte pour la règle de fusion en blanc).
3. **Hard.**Utilisation `whisper-large-v3-turbo`sur[LibriSpeech test-clean](https://www.openslr.org/12)- Comparer les chiffres publiés avec les 100 premiers discours.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| CTC | The blank-token loss | Marginal over all frame-to-token alignments; non-AR. |
| RNN-T | The streaming loss | CTC + next-token predictor; handles word-order. |
| Attention enc-dec | Whisper-style | Encoder + cross-attending decoder; best offline quality. |
| WER | The number you report | `(S+D+I)/N` at word level. |
| Blank | The emptiness | Special token in CTC signalling "no emission this frame". |
| LM fusion | External language model | Add weighted LM log-probs during beam search. |
| VAD | The silence gate | Voice activity detector; trims non-speech. |

## Pour en savoir plus

- [Graves et al. (2006). Connectionist Temporal Classification](https://www.cs.toronto.edu/~graves/icml_2006.pdf) le papier du CTC.
- [Graves (2012). Sequence Transduction with RNNs](https://arxiv.org/abs/1211.3711) le papier RNN-T.
- [Radford et al. / OpenAI (2022). Whisper: Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) le papier canonique de 2022; extension v3-turbo en 2024.
- [NVIDIA NeMo — Parakeet-TDT card](https://huggingface.co/nvidia/parakeet-tdt-1.1b) Leader du tableau des priorités des RSA ouverts de 2026.
- [Hugging Face — Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) référence en direct sur plus de 25 modèles.
