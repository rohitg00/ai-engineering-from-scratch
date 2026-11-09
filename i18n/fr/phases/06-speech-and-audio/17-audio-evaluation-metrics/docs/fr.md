# Évaluation audio  WER, MOS, UTMOS, MMAU, FAD et les tableaux de classement ouverts

> Vous ne pouvez pas envoyer ce que vous ne pouvez pas mesurer. Cette leçon nomme les mesures 2026 pour chaque tâche audio: ASR (WER, CER, RTFx), TTS (MOS, UTMOS, SECS, WER-on-ASR-round-trip), audio-langue (MMAU, LongAudioBench), musique (FAD, CLAP), et haut-parleur (EER).

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04, 06, 07, 09, 10; Phase 2 · 09 (Model Evaluation)
**Time:** ~60 minutes

## Le problème

Chaque tâche audio a plusieurs mesures, chacune mesurant un axe différent. En utilisant la mauvaise mesure, vous envoyez un modèle qui a l'air superbe sur votre tableau de bord et terrible en production.

| Task | Primary | Secondary |
|------|---------|-----------|
| ASR | WER | CER · RTFx · first-token latency |
| TTS | MOS / UTMOS | SECS · WER-on-ASR-round-trip · CER · TTFA |
| Voice cloning | SECS (ECAPA cosine) | MOS · CER |
| Speaker verification | EER | minDCF · FAR / FRR at operating point |
| Diarization | DER | JER · speaker confusion |
| Audio classification | top-1 · mAP | macro F1 · per-class recall |
| Music generation | FAD | CLAP · listening panel MOS |
| Audio language model | MMAU-Pro | LongAudioBench · AudioCaps FENSE |
| Streaming S2S | latency P50/P95 | WER · MOS |

## Le concept

![Audio evaluation matrix — metrics vs tasks vs 2026 leaderboards](../assets/eval-landscape.svg)

### Les mesures ASR

**WER (Word Error Rate).** `(S + D + I) / N`- Les minuscules, la ponctuation, la normalisation des chiffres avant de marquer.`jiwer`ou de OpenAI `whisper_normalizer`. &lt; 5% = lecture du discours parité humaine.

**CER (Character Error Rate).**La même formule, au niveau des caractères. Utilisé pour les langues de ton (mandarin, cantonais) où la segmentation des mots est ambiguë.

**RTFx (inverse real-time factor).**Les secondes audio sont traitées par seconde de l'horloge murale.

**First-token latency.**Le mur de l'horloge de l'entrée audio au premier jeton de transcription.

### Les mesures TTS

**MOS (Mean Opinion Score).**1 à 5 pour les humains, standard d'or mais lent, plus de 20 auditeurs par échantillon, plus de 100 échantillons par modèle.

**UTMOS (2022-2026).**Prédicteur de MOS appris. Corrélate avec ~ 0,9 avec MOS humain sur des critères de référence standard. F5-TTS: UTMOS 3,95; vérité de base: 4,08.

**SECS (Speaker Encoder Cosine Similarity).**Pour le clonage vocal. ECAPA intégrant cosine entre référence et sortie clonée. &gt; 0,75 = clone reconnaissable.

**WER-on-ASR-round-trip.**Exécutez Whisper sur la sortie TTS, calculer WER contre le texte d'entrée. Capture des régressions d'intelligibilité. 2026 SOTA: &lt; 2% WER sur les ensembles de test anglais (les ensembles mandarin rapportent le CER à la place).

**TTFA (time-to-first-audio).**La latence de l'horloge murale Kokoro-82M: ~100 ms; F5-TTS: ~1 seconde.

### Clonage de la voix spécifique

**SECS + MOS + CER**Le clonage qui a un SECS élevé mais un MOS bas signifie timbre-bon mais-non-naturel; le contraire signifie voix naturelle mais mauvais haut-parleur.

### Vérification des haut-parleurs

**EER (Equal Error Rate).**Le seuil où le taux de faux acceptation est égal au taux de faux rejet.

**minDCF (min Detection Cost).**Coût pondéré à un point d'exploitation choisi (souvent FAR = 0,01).

### Diarrhée

**DER (Diarization Error Rate).** `(FA + Miss + Confusion) / total_speaker_time`. Discours manqué + discours d'alarme fausse + confusion des haut-parleurs, chacun en fraction. Rencontre AMI: DER ~10-20% est réaliste. note 3.1 + précision-2 commercial: &lt;10% DER sur audio bien enregistré.

**JER (Jaccard Error Rate).**Alternative à la DER, robuste à la partialité de segment court.

### Classification audio

- Le produit est à l' étiquette: **mAP (mean Average Precision)**Pour les classes BEAT-iter3, le MAP est de 0,548 mAP.

Exclusifs pour plusieurs classes: **top-1, top-5 accuracy**- Commande de parole v2: 99,0% top-1 (Audio-MAE).

- Il est déséquilibré .**macro F1**+ **per-class recall**. Rapport par classe  la précision globale cache les classes qui échouent.

### Génération de musique

**FAD (Fréchet Audio Distance).**Distance entre les distributions intégrées VGGish d'audio réel et généré.

**CLAP Score.**Score d'alignement texte-audio en utilisant des emblèmes CLAP. &gt; 0,3 = alignement raisonnable.

**Listening panel MOS.**Le dernier mot pour la musique de consommation. Suno v5 a obtenu un score ELO 1293 sur le propre benchmark de préférence parée de Suno. C'est un numéro de fournisseur; TTS Arena classe la parole, pas la musique.

### Indices de référence pour le langage audio

**MMAU (Massive Multi-Audio Understanding).**10 000 paires de QA audio.

**MMAU-Pro.**1800 objets durs, quatre catégories: parole / son / musique / multi-audio. Chance aléatoire 25% sur quatre voies. Gémeaux 2.5 Pro globalement ~ 60%; multi-audio ~ 22% sur tous les modèles.

**LongAudioBench.**Des clips de plusieurs minutes avec des requêtes sémantiques.

**AudioCaps / Clotho.**Les indicateurs de référence sont sous-titrés: SPICE, CIDER, FENSE.

### Diffusion de discours en direct

**Latency P50 / P95 / P99.**Montres murales de la fin de l'interface utilisateur à la première réponse audible.

**WER / MOS**sur la sortie.

**Barge-in responsiveness.**Temps de l'interruption de l'utilisateur à l'assistant muet.

### Les classements de 2026

| Leaderboard | Tracks | URL |
|------------|--------|-----|
| Open ASR Leaderboard (HF) | English + multilingual + long-form | `huggingface.co/spaces/hf-audio/open_asr_leaderboard` |
| TTS Arena (HF) | English TTS | `huggingface.co/spaces/TTS-AGI/TTS-Arena` |
| Artificial Analysis Speech | TTS + STT, ELO from paired votes | `artificialanalysis.ai/speech` |
| MMAU-Pro | LALM reasoning | `sonalkum.github.io/mmau-pro` |
| SpeakerBench / VoxSRC | Speaker recognition | `voxsrc.github.io` |
| MMAU music subset | Music LALM | (within MMAU) |
| HEAR benchmark | Self-supervised audio | `hearbenchmark.com` |

```figure
sp-wer-align
```

## Faites-le

### Étape 1: REM avec normalisation

```python
from jiwer import wer, Compose, ToLowerCase, RemovePunctuation, Strip

transform = Compose([ToLowerCase(), RemovePunctuation(), Strip()])
score = wer(
    truth="Please turn on the lights.",
    hypothesis="please turn on the light",
    truth_transform=transform,
    hypothesis_transform=transform,
)
# ~0.17
```

### Étape 2: REM de retour et retour de TTS

```python
def ttr_wer(tts_model, asr_model, texts):
    errors = []
    for txt in texts:
        audio = tts_model.synthesize(txt)
        recog = asr_model.transcribe(audio)
        errors.append(wer(truth=txt, hypothesis=recog))
    return sum(errors) / len(errors)
```

### Étape 3: SECS pour le clonage vocale

```python
from speechbrain.inference.speaker import EncoderClassifier
sv = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb")

emb_ref = sv.encode_batch(load_wav("reference.wav"))
emb_clone = sv.encode_batch(load_wav("cloned.wav"))
secs = torch.nn.functional.cosine_similarity(emb_ref, emb_clone, dim=-1).item()
```

### Étape 4: FAD pour la génération de musique

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()
score = fad.get_fad_score("generated_folder/", "reference_folder/")
```

### Étape 5: RÉE pour la vérification des haut-parleurs (même code que leçon 6)

```python
def eer(same_scores, diff_scores):
    thresholds = sorted(set(same_scores + diff_scores))
    best = (1.0, 0.0)
    for t in thresholds:
        far = sum(1 for s in diff_scores if s >= t) / len(diff_scores)
        frr = sum(1 for s in same_scores if s < t) / len(same_scores)
        if abs(far - frr) < best[0]:
            best = (abs(far - frr), (far + frr) / 2)
    return best[1]
```

## Utilisez-le

Parler chaque déploiement avec un harnais d'évaluation fixe qui fonctionne sur chaque mise à jour de modèle.

1. **Normalize before scoring.**La minuscule, la bande de ponctuation, le nombre, rapportez la règle de normalisation.
2. **Report distributions, not averages.**P50/P95/P99 pour la latence. Rappel par classe pour la classification. Par catégorie pour MMAU.
3. **Run one canonical public benchmark.**Même si vos données de production diffèrent, les rapports sur Open ASR / TTS Arena / MMAU permettent aux critiques de comparer les pommes aux pommes.

## Les pièges

- **UTMOS extrapolation.**Formé à la parole propre au style VCTK; score faible en audio bruyant / cloné / émotionnel.
- **MOS panel bias.**20 employés d'Amazon Mechanical Turk ≠ 20 utilisateurs cibles.
- **FAD depends on reference set.**Comparer avec la même répartition de référence entre les modèles.
- **Aggregate WER.**Un REM global de 5% peut cacher 30% du REM sur le discours accentué.
- **Public benchmark saturation.**La plupart des modèles frontaliers sont proches du plafond sur des critères de référence standard.

## La faire partir

- Je ne sais pas .`outputs/skill-audio-evaluator.md`Choisissez des métriques, des critères de référence et le format de rapport pour toute version de modèle audio.

## Exercices

1. **Easy.**On court .`code/main.py`. Comptez le WER / CER / EER / SECS / FAD-ish / MMAU-ish sur les entrées de jouets.
2. **Medium.**Construisez un harnais WER aller-retour TTS. Exécutez votre sortie Kokoro ou F5-TTS via Whisper. Computez WER sur 50 demandes.
3. **Hard.**Résumez votre choix de LALM de leçon 10 sur le discours MMAU-Pro + plusieurs sous-ensembles audio (50 éléments chacun).

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| WER | ASR score | `(S+D+I)/N` at word level after normalization. |
| CER | Character WER | For tone languages or char-level systems. |
| MOS | Human opinion | 1-5 rating; 20+ listeners × 100 samples. |
| UTMOS | ML MOS predictor | Learned model; correlates ~0.9 with human MOS. |
| SECS | Voice-clone similarity | ECAPA cosine between reference and clone. |
| EER | Speaker verif score | Threshold where FAR = FRR. |
| DER | Diarization score | (FA + Miss + Confusion) / total. |
| FAD | Music-gen quality | Fréchet distance on VGGish embeddings. |
| RTFx | Throughput | Audio seconds per wall-clock second. |

## Pour en savoir plus

- [jiwer](https://github.com/jitsi/jiwer) Bibliothèque WER/CER avec des utilitaires de normalisation.
- [UTMOS (Saeki et al. 2022)](https://arxiv.org/abs/2204.02152) apprend le prédicteur de MOS.
- [Fréchet Audio Distance (Kilgour et al. 2019)](https://arxiv.org/abs/1812.08466) la norme de la génération musicale.
- [Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) 2026 classement en direct.
- [TTS Arena](https://huggingface.co/spaces/TTS-AGI/TTS-Arena) Le classement des TTS par vote humain.
- [MMAU-Pro benchmark](https://sonalkum.github.io/mmau-pro/) Tableau de classement de raisonnement LALM.
- [HEAR benchmark](https://hearbenchmark.com/) les références SSL audio.
