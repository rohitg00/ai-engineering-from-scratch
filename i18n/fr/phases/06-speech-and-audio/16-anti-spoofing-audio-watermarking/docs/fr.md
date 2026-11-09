# L'écriture de la voix anti-spoofing et de l'audio Watermarking  ASVspoof 5, AudioSeal, WaveVerify

> Le clonage vocale est livré plus rapidement que les défenses. Les systèmes de voix de production 2026 ont besoin de deux choses: un détecteur (AASIST, RawNet2) qui classe la parole réelle contre fausse, et un marque-eau (AudioSeal) qui survit à la compression et à l'édition.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 08 (Voice Cloning)
**Time:** ~75 minutes

## Le problème

Trois défenses connexes:

1. **Anti-spoofing / deepfake detection.**Compte tenu d'un clip audio, est-il synthétique ou réel ?
2. **Audio watermarking.**Embed un signal imperceptible dans l'audio généré qu'un détecteur peut extraire plus tard.
3. **Authenticated provenance.**Signature cryptographique des fichiers audio + métadonnées.

La détection gère les adversaires qui ne coopèrent pas. Le marquage d'eau gère la conformité  L'audio généré par l'IA devrait être identifiable comme tel. Les deux sont nécessaires en 2026.

## Le concept

![Anti-spoofing vs watermarking vs provenance — three defense layers](../assets/spoofing-watermark.svg)

### ASVspoof 5  le point de référence 2024-2025

Le plus grand changement par rapport aux éditions précédentes:

- **Crowdsourced data**(pas de studio propre)  conditions réalistes.
- **~2000 speakers**(versus ~ 100 avant).
- **32 attack algorithms.**TTS + conversion vocale + perturbation adversitaire.
- **Two tracks.**Contremaçon (CM) détection autonome; ASV (SASV) à contre-pied pour les systèmes biométriques.

Le plus récent sur ASVspoof 5: ~ 7,23% EER. Sur le plus ancien ASVspoof 2019 LA: 0,42% EER. Déploiement dans le monde réel: attendez-vous à 5-10% EER sur les clips en plein air.

### Familles de modèles de détection AASIST et RawNet2 

**AASIST**(en 2021, mis à jour jusqu'en 2026).

**RawNet2.**Convolution de l'avant-dernier sur la forme d'onde brute + L'épine dorsale TDNN.

**NeXt-TDNN + SSL features.**Variante 2025: ECAPA-style + fonctionnalités WavLM + perte de focus. atteint le 0,42% EER sur ASVspoof 2019 LA.

### AudioSeal  le marque-eau 2024 par défaut

Les méta **AudioSeal**(Jan 2024, v0.2 Déc 2024): conception clé:

- **Localized.**Détecte le marque-eau par cadre à 16 kHz (1/16000 s) de résolution de l'échantillon.
- **Generator + detector jointly trained.**Le générateur apprend à intégrer un signal inaudible; le détecteur apprend à le trouver par des augmentations.
- **Robust.**Survient à la compression MP3 / AAC, à l' EQ, à la vitesse de changement ±10%, au mélange bruyant +10 dB SNR.
- **Fast.**Le détecteur fonctionne à 485 fois en temps réel, 1000 fois plus vite que WavMark.
- **Capacity.**Charge utile de 16 bits (peut encoder le modèle ID, le timestamp de génération, l'ID utilisateur) intégrable dans chaque déclaration.

### Le marqueur

Le baseline pré-AudioSeal est ouvert.

- La synchronisation brute force est lente.
- Peut être retiré par bruit gaussien ou par compression MP3.
- Pas amicale en temps réel.

### La révision de la loi sur les droits de l'homme

Résolve les faiblesses d'AudioSeal  spécifiquement les manipulations temporelles (inversion, vitesse). Utilise un générateur basé sur FiLM + détecteur Mixture-of-Experts. Compétitif avec AudioSeal sur les attaques standard; gère les modifications temporelles.

### Les adversaires exploitent les lacunes

De AudioMarkBench: "sous le changement de pitch, tous les marqueurs d'eau montrent une précision de récupération de bits inférieure à 0,6, ce qui indique une suppression presque complète". **Pitch-shift is the universal attack.**Le marquage d'eau n° 2026 est entièrement robuste pour la modification agressive du ton.

### C2PA / Initiative sur l'authenticité du contenu

Il est également possible de modifier le format de la vidéo en utilisant des fichiers audio.

```figure
v4-audio-watermark
```

## Faites-le

### Étape 1: un simple détecteur de caractéristiques spectrales (jouet)

```python
def spectral_rolloff(spec, percentile=0.85):
    cum = 0
    total = sum(spec)
    if total == 0:
        return 0
    threshold = total * percentile
    for k, v in enumerate(spec):
        cum += v
        if cum >= threshold:
            return k
    return len(spec) - 1

def is_suspicious(audio):
    spec = magnitude_spectrum(audio)
    rolloff = spectral_rolloff(spec)
    return rolloff / len(spec) > 0.92
```

La parole synthétique a souvent une énergie à haute fréquence inhabituellement plate.

### Étape 2: Embed audioSeal + détecte

```python
from audioseal import AudioSeal
import torch

generator = AudioSeal.load_generator("audioseal_wm_16bits")
detector = AudioSeal.load_detector("audioseal_detector_16bits")

audio = load_wav("generated.wav", sr=16000)[None, None, :]
payload = torch.tensor([[1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0]])
watermark = generator.get_watermark(audio, sample_rate=16000, message=payload)
watermarked = audio + watermark

result, decoded_payload = detector.detect_watermark(watermarked, sample_rate=16000)
# result: float in [0, 1] — probability of watermark presence
# decoded_payload: 16 bits; match against embedded payload
```

### Étape 3: évaluation  RSE

```python
def eer(real_scores, fake_scores):
    thresholds = sorted(set(real_scores + fake_scores))
    best = (1.0, 0.0)
    for t in thresholds:
        far = sum(1 for s in fake_scores if s >= t) / len(fake_scores)
        frr = sum(1 for s in real_scores if s < t) / len(real_scores)
        if abs(far - frr) < best[0]:
            best = (abs(far - frr), (far + frr) / 2)
    return best[1]
```

### Étape 4: intégration de la production

```python
def safe_tts(text, voice, clone_reference=None):
    if clone_reference is not None:
        verify_consent(user_id, clone_reference)
    audio = tts_model.synthesize(text, voice)
    audio_with_wm = audioseal_embed(audio, payload=build_payload(user_id, model_id))
    manifest = c2pa_sign(audio_with_wm, user_id, timestamp=now())
    return audio_with_wm, manifest
```

Chaque génération de navires: (1) marque d'eau, (2) manifeste signé, (3) journal d'audit conforme à la politique de conservation.

## Utilisez-le

| Use case | Defense |
|----------|---------|
| Shipping TTS / voice cloning | AudioSeal embed on every output (non-negotiable) |
| Biometric voice unlock | AASIST + ECAPA ensemble; liveness challenge |
| Call-center fraud detection | AASIST on 20% sample of incoming calls |
| Podcast authenticity | C2PA signing on upload, AudioSeal if AI-generated |
| Research / training detectors | ASVspoof 5 train/dev/eval sets |

## Les pièges

- **Watermark without detector ever running.**Pas de sens, envoyez le détecteur dans votre informateur.
- **Detection without calibration.**AASIST est formé à des sur-exploits de l'ASV, des baisses de précision dans le monde réel.
- **Pitch-shift gap.**Le changement de pitch agressif supprime la plupart des marqueurs d'eau.
- **Metadata strip-and-rehost.**C2PA est trivialement contourné par le re-encodage. Ajoutez toujours la défense cryptographique + perceptuelle (marque d'eau) ensemble.
- **Liveness as detection.**Demandez à l'utilisateur de dire une phrase aléatoire.

## La faire partir

- Je ne sais pas .`outputs/skill-spoof-defender.md`. Choisir le modèle de détection, le marque-eau, le manifeste de provenance et le manuel de jeu opérationnel pour un déploiement de génération de voix.

## Exercices

1. **Easy.**On court .`code/main.py`- Détecteur de jouets + marque d'eau de jouets intégré/détecté sur audio synthétique.
2. **Medium.**Installez`audioseal`, intégrer une charge utile de 16 bits dans une sortie TTS, redécoder, corrompre l'audio avec le bruit et mesurer la précision de récupération de bits.
3. **Hard.**Télégraphie un RawNet2 ou un AASIST sur ASVspoof 2019 LA. Mesure EER. Testez sur un ensemble de clips générés par F5-TTS  voir comment la détection OOD se dégrade.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| ASVspoof | The benchmark | Biennial challenge; 2024 = ASVspoof 5. |
| CM (countermeasure) | Detector | Classifier: real speech vs synthetic / converted. |
| SASV | Speaker verif + CM | Integrated biometric + spoof detection. |
| AudioSeal | Meta watermark | Localized, 16-bit payload, 485× faster than WavMark. |
| Bit Recovery Accuracy | Watermark survival | Fraction of payload bits recovered after attack. |
| C2PA | Provenance manifest | Cryptographic metadata about creation / authorship. |
| AASIST | Detector family | Graph-attention-based anti-spoofing SOTA. |

## Pour en savoir plus

- [Todisco et al. (2024). ASVspoof 5](https://dl.acm.org/doi/10.1016/j.csl.2025.101825) l'indice de référence actuel.
- [Defossez et al. (2024). AudioSeal](https://arxiv.org/abs/2401.17264) la marque d'eau par défaut.
- [Chen et al. (2025). WaveVerify](https://arxiv.org/abs/2507.21150)Détecteur de détection de température.
- [Jung et al. (2022). AASIST](https://arxiv.org/abs/2110.01200) l'épine dorsale de détection de SOTA.
- [AudioMarkBench (2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/5d9b7775296a641a1913ab6b4425d5e8-Paper-Datasets_and_Benchmarks_Track.pdf) évaluation de la robustesse.
- [C2PA specification](https://spec.c2pa.org/specifications/specifications/2.4/index.html) format du manifeste de provenance.
