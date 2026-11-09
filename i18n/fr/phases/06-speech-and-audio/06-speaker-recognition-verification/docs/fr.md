# Reconnaissance et vérification des haut-parleurs

> L'ASR demande "qu'ont-ils dit?" La reconnaissance du haut-parleur demande "qui l'a dit?" Les mathématiques sont les mêmes  embeddings plus cosine  mais chaque décision de production dépend d'un seul numéro EER.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 22 (Embedding Models)
**Time:** ~45 minutes

## Le problème

Un utilisateur dit un mot de passe. Vous voulez savoir: est-ce la personne qu'il prétend être (* vérification*, 1:1), ou est-ce la première personne dans votre banque d'inscription (* identification*, 1: N)?

Avant 2018: GMM-UBM + i-vecteurs. EER raisonnable mais fragile pour le changement de canal (phone contre ordinateur portable) et l'émotion. 20182022: x-vecteurs (réteau TDNN entraîné avec marge angulaire). 2022+: ECAPA-TDNN et WavLM-grandes emblèmes.

La métrique est **EER** Taux d'erreur égal. Définissez votre seuil de décision de sorte que le taux de faux acceptation = taux de faux rejet. Le crossover est EER. Utilisé dans chaque document, chaque tableau de classement, chaque appel d'achat.

## Le concept

![Enrollment + verification pipeline with embedding + cosine + EER](../assets/speaker-verification.svg)

**The pipeline.**Enregistrement: enregistrer 530 secondes de l'enceinte cible; calculer une intégration en dimension fixe (192-d pour ECAPA-TDNN, 256-d pour WavLM-large).

**ECAPA-TDNN (2020, still dominant 2026).**Accentué l'attention, la propagation et l'agrégation du canal - Réseau neuronal retardé dans le temps. Blocs de convection 1D avec excitation de compresser, pooling d'attention multi-têtes, suivis d'une couche linéaire à 192-d. Formé sur VoxCeleb 1+2 (2 700 haut-parleurs, 1,1M déclarations) avec perte de marge angulaire additive (AAM-softmax).

**WavLM-SV (2022+).**Télécharger une mémoire de base SSL de taille WavLM pré-entrainée avec perte AAM.

**x-vector (baseline).**La mise en commun des statistiques TDNN +. classique; toujours utile sur le bord du processeur.

**AAM-softmax.**Softmax standard avec marge ajoutée `m`dans l'espace angulaire: `cos(θ + m)`Pour la classe correcte, la séparation angulaire entre les classes.`m=0.2`, l' échelle `s=30`- Je suis désolé .

### Score

- **Cosine**Les résultats de l'enquête ont été évalués en fonction des résultats obtenus.
- **PLDA (Probabilistic LDA).**Embedding de projet dans un espace latent où le même haut-parleur vs un haut-parleur différent a un rapport de probabilité de forme fermée. Ajouté en haut du cosine pour une réduction de +1020% de la REE.
- **Score normalization.** `S-norm`ou `AS-norm`Les résultats obtenus par les chercheurs sont essentiels pour une évaluation interdomaine.

### Numéros que vous devriez connaître (2026)

| Model | VoxCeleb1-O EER | Params | Throughput (A100) |
|-------|-----------------|--------|-------------------|
| x-vector (classic) | 3.10% | 5 M | 400× RT |
| ECAPA-TDNN | 0.87% | 15 M | 200× RT |
| WavLM-SV large | 0.42% | 316 M | 20× RT |
| Pyannote 3.1 segmentation + embedding | 0.65% | 6 M | 100× RT |
| ReDimNet (2024) | 0.39% | 24 M | 100× RT |

### Diarrhée

" Qui a parlé quand " dans un clip multi- haut-parleurs. Pipeline: VAD → segment → intégrer chaque segment → cluster (agglomératif ou spectrale) → limites lisses.`pyannote.audio`3.1, qui regroupe la segmentation des haut-parleurs + l'intégration + le regroupement derrière un appel.

```figure
sp-eer-crossover
```

## Faites-le

### Étape 1: intégration de jouets à partir des statistiques de la CFPM

```python
def embed_mfcc_stats(signal, sr):
    frames = featurize_mfcc(signal, sr, n_mfcc=13)
    mean = [sum(f[i] for f in frames) / len(frames) for i in range(13)]
    std = [
        math.sqrt(sum((f[i] - mean[i]) ** 2 for f in frames) / len(frames))
        for i in range(13)
    ]
    return mean + std  # 26-d
```

Pas de SOTA par un mile  pour l'enseignement seulement. `code/main.py`utilise cette méthode comme preuve de concept sur les données des haut-parleurs synthétiques.

### Étape 2: similitude cosine + seuil

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0

def verify(enroll, test, threshold=0.75):
    return cosine(enroll, test) >= threshold
```

### Étape 3: EER à partir de paires de similitudes

```python
def eer(same_scores, diff_scores):
    thresholds = sorted(set(same_scores + diff_scores))
    best = (1.0, 1.0, 0.0)  # (fa, fr, threshold)
    for t in thresholds:
        fr = sum(1 for s in same_scores if s < t) / len(same_scores)
        fa = sum(1 for s in diff_scores if s >= t) / len(diff_scores)
        if abs(fa - fr) < abs(best[0] - best[1]):
            best = (fa, fr, t)
    return (best[0] + best[1]) / 2, best[2]
```

Retour (eer, threshold_at_eer).

### Étape 4: production avec SpeechBrain

```python
from speechbrain.pretrained import EncoderClassifier

clf = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")

# enroll: average the embeddings of 3-5 clean samples
enroll = torch.stack([clf.encode_batch(load(x)) for x in enrollment_clips]).mean(0)
# verify
score = clf.similarity(enroll, clf.encode_batch(load("test.wav"))).item()
verdict = score > 0.25   # ECAPA typical threshold; tune on your data
```

### Étape 5: Diary avec note de piane

```python
from pyannote.audio import Pipeline

pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
diarization = pipe("meeting.wav", num_speakers=None)
for turn, _, speaker in diarization.itertracks(yield_label=True):
    print(f"{turn.start:.1f}–{turn.end:.1f}  {speaker}")
```

## Utilisez-le

La pile de 2026:

| Situation | Pick |
|-----------|------|
| Closed-set 1:1 verification, edge | ECAPA-TDNN + cosine threshold |
| Open-set verification, cloud | WavLM-SV + AS-norm |
| Diarization (meetings, podcasts) | `pyannote/speaker-diarization-3.1` |
| Anti-spoofing (replay / deepfake detection) | AASIST or RawNet2 |
| Tiny embedded (KWS + enrollment) | Titanet-Small (NeMo) |

## Les pièges

- **Channel mismatch.**Modèle formé sur VoxCeleb (vidéo web) ≠ audio d'appel téléphonique.
- **Short utterances.**L'EER se dégrade nettement en dessous de 3 secondes d'audio de test.
- **Enrollment with noise.**Une inscription bruyante empoisonne l'ancre.
- **Fixed threshold across conditions.**Toujours régler le seuil sur un ensemble de développement détenu depuis le domaine cible.
- **Cosine on non-normalized embeddings.**L2 normaliser d'abord; sinon la magnitude domine.

## La faire partir

- Je ne sais pas .`outputs/skill-speaker-verifier.md`- Le modèle de sélection, le protocole d'inscription, le plan de réglage des seuils et les garanties contre la fraude.

## Exercices

1. **Easy.**On court .`code/main.py`- Construit des " haut-parleurs " synthétiques (profiles de tonalité différents), inscrit, calcula EER sur une liste d'essai de 100 paires.
2. **Medium.**Utilisez SpeechBrain ECAPA sur 30 déclarations VoxCeleb1 (5 haut-parleurs × 6 chacun).
3. **Hard.**Construire l' inscription complète → diary → vérifier le pipeline avec `pyannote.audio`- Évaluer le DER sur le set de développement AMI.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| EER | The headline metric | Threshold where False Accept = False Reject. |
| Verification | 1:1 | "Is this Alice?" |
| Identification | 1:N | "Who is speaking?" |
| Open-set | Unknown possible | Test set can contain unenrolled speakers. |
| Enrollment | Registering | Computing a speaker's reference embedding. |
| AAM-softmax | The loss | Softmax with additive angular margin; forces cluster separation. |
| PLDA | Classic scoring | Probabilistic LDA; likelihood-ratio scoring on top of embeddings. |
| DER | Diarization metric | Diarization Error Rate — miss + false alarm + confusion. |

## Pour en savoir plus

- [Snyder et al. (2018). X-Vectors: Robust DNN Embeddings for Speaker Recognition](https://www.danielpovey.com/files/2018_icassp_xvectors.pdf) le papier classique à plomb profond.
- [Desplanques et al. (2020). ECAPA-TDNN](https://arxiv.org/abs/2005.07143) architecture dominante 20202026.
- [Chen et al. (2022). WavLM: Large-Scale Self-Supervised Pre-Training for Full Stack Speech Processing](https://arxiv.org/abs/2110.13900) L'épine dorsale SSL pour SV et la diarisation.
- [Bredin et al. (2023). pyannote.audio 3.1](https://github.com/pyannote/pyannote-audio) Diarilisation de la production + pile d'intégration.
- [VoxCeleb leaderboard (updated 2026)](https://www.robots.ox.ac.uk/~vgg/data/voxceleb/) classement actuel des EER sur les différents modèles.
