# Clonage et conversion de voix

> La clonage vocale lit votre texte dans la voix d'autrui. La conversion vocale réécrit votre voix dans celle d'autrui tout en préservant ce que vous avez dit. Les deux dépendent de la même décomposition: une identité séparée de l'orateur du contenu.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 07 (TTS)
**Time:** ~75 minutes

## Le problème

En 2026, un clip audio de 5 secondes suffit pour produire un clone de haute qualité de la voix de n'importe qui avec un GPU de consommation. ElevenLabs, F5-TTS, OpenVoice v2, VoiceBox envoient tous un clonage à tir zéro ou à quelques tirages. La technologie est une bénédiction (accessibilité TTS, doublage, voix d'assistance) et une arme (appels frauduleux, faux profonds politiques, vol d'IP).

Deux tâches étroitement liées:

- **Voice cloning (TTS-side):**texte + voix de référence de 5 secondes → audio dans cette voix.
- **Voice conversion (speech-side):**audio source (personne A disant X) + voix de référence de personne B → audio de B disant X.

Les deux facteurs d'une forme d'onde en (contenu, haut-parleur, prosodie) et recombiner le contenu d'une source avec le haut-parleur d'une autre.

La contrainte clé que vous soumettez maintenant en 2026:**watermarking and consent gates are legally required in the EU (AI Act, enforceable August 2026) and in California (AB 2905, effective 2025)**Votre pipeline doit émettre une marque d'eau inaudible et refuser des clones non consensuels.

## Le concept

![Voice cloning vs conversion: factorize, swap speaker, recombine](../assets/voice-cloning.svg)

**Zero-shot cloning.**Passez un clip de 5 secondes à un modèle qui a été formé sur des milliers de haut-parleurs. Le codeur haut-parleur cartographiera le clip à un haut-parleur intégré; le décodeur TTS conditionne cette intégration plus texte.

Utilisé par: F5-TTS (2024), YourTTS (2022), XTTS v2 (2024), OpenVoice v2 (2024).

**Few-shot fine-tuning.**Enregistrer 5 à 30 minutes de la voix cible. LoRA-fin-tune un modèle de base pendant une heure. La qualité passe de "okay" à "indistinguible". Coqui et ElevenLabs soutiennent tous deux ce modèle; la communauté l'utilise avec F5-TTS.

**Voice conversion (VC).**Deux familles:

- **Recognition-synthesis.**Exécutez un modèle ASR pour extraire la représentation du contenu (par exemple, des postérieurs phonémiques doux, PPG), puis la résynthétisez avec l'intégration de haut-parleurs cibles. Robuste pour le langage et l'accent. Utilisé par KNN-VC (2023), Diff-HierVC (2023).
- **Disentanglement.**Exercer un autoencodeur qui sépare le contenu, l'enceinte et la prosodie dans un espace latent à la boucle de fer. Swap le haut-parleur intégrant à l'inférence. Moins de qualité mais plus rapide. Utilisé par AutoVC (2019), VITS-VC variantes.

**Neural codec-based cloning (2024+).**VALL-E, VALL-E 2, NaturalSpeech 3, VoiceBox  traiter l'audio comme des jetons discrets de SoundStream / EnCodec, entraîner un grand modèle autorégressif ou de correspondance de flux sur les jetons codec.

### Le morceau d'éthique, pas un boulon

**Watermarking.**PerTh (Perth) et SilentCipher (2024) incorporent un ID de ~16-32 bits imperceptiblement dans l'audio. Survient à la re-encodage, au streaming et aux éditions courantes.

**Consent gates.**Il faut associer chaque sortie clonée à un enregistrement de consentement vérifiable. "Je, Rohit, le 2026-04-22, autorise cette voix à des fins X".

**Detection.**AASIST, RawNet2 et Wav2Vec2-AASIST sont utilisés comme détecteurs.

### Nombre de personnes

| Model | Zero-shot? | SECS (target sim) | WER (intel.) | Params |
|-------|-----------|--------------------|--------------|--------|
| F5-TTS | Yes | 0.72 | 2.1% | 335M |
| XTTS v2 | Yes | 0.65 | 3.5% | 470M |
| OpenVoice v2 | Yes | 0.70 | 2.8% | 220M |
| VALL-E 2 | Yes | 0.77 | 2.4% | 370M |
| VoiceBox | Yes | 0.78 | 2.1% | 330M |

SECS > 0,70 est généralement indistinguible de la cible pour la plupart des auditeurs.

```figure
sp-voice-factorize
```

## Faites-le

### Étape 1: décomposer avec la synthèse de reconnaissance (démo de code seulement dans main.py)

```python
def clone_pipeline(ref_audio, text, target_embedder, tts_model):
    speaker_emb = target_embedder.encode(ref_audio)
    mel = tts_model(text, speaker=speaker_emb)
    return vocoder(mel)
```

Conceptuellement simple; la masse de mise en œuvre est en `tts_model`et le haut-parleur encodeur.

### Étape 2: clone à tir zéro avec F5-TTS

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="rohit_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please add milk and bread to my list.",
)
```

La transcription de référence doit correspondre exactement à l'audio; l'incohérence rompt l'alignement.

### Étape 3: Conversion vocale avec KNN-VC

```python
import torch
from knnvc import KNNVC  # 2023 model, https://github.com/bshall/knn-vc
vc = KNNVC.load("wavlm-base-plus")
out_wav = vc.convert(source="my_voice.wav", target_pool=["alice_1.wav", "alice_2.wav"])
```

KNN-VC exécute WavLM pour extraire des emblèmes par cadre pour la base de sources et la base de cibles, puis remplace chaque cadre source par son voisin le plus proche dans la base.

### Étape 4: intégrer une marque d'eau

```python
from silentcipher import SilentCipher
sc = SilentCipher(model="2024-06-01")
payload = b"consent_id:abc123;ts:1745353200"
watermarked = sc.embed(wav, sr=24000, message=payload)
detected = sc.detect(watermarked, sr=24000)   # returns payload bytes
```

~ 32 bits de charge utile, détectable après le recodage MP3 et le bruit léger.

### Étape 5: porte de consentement

```python
def cloned_inference(text, ref_audio, consent_record):
    assert verify_signature(consent_record), "Signed consent required"
    assert consent_record["speaker_id"] == hash_speaker(ref_audio)
    wav = tts.infer(ref_file=ref_audio, gen_text=text)
    wav = watermark(wav, payload=consent_record["id"])
    return wav
```

## Utilisez-le

La pile de 2026:

| Situation | Pick |
|-----------|------|
| 5-sec zero-shot clone, open-source | F5-TTS or OpenVoice v2 |
| Commercial production cloning | ElevenLabs Instant Voice Clone v2.5 |
| Voice conversion (rewriting) | KNN-VC or Diff-HierVC |
| Many-speaker fine-tune | StyleTTS 2 + speaker adapter |
| Cross-lingual cloning | XTTS v2 or VALL-E X |
| Deepfake detection | Wav2Vec2-AASIST |

## Les pièges

- **Misaligned reference transcript.**F5-TTS et autres éléments similaires exigent que le texte de référence correspond exactement à l'audio de référence, la ponctuation comprise.
- **Reverberant reference.**Echo tue le clone, disque sec, microphone proche.
- **Emotional mismatch.**La référence d'entraînement "joyeux" produit des clones joyeux de tout.
- **Language leakage.**Le clonage d'un anglophone puis la demande au modèle de parler français porte souvent l'accent de toute façon; utilisez des modèles multilingues (XTTS, VALL-E X).
- **No watermark.**Il est légalement impérissable dans l'UE à partir d'août 2026.

## La faire partir

- Je ne sais pas .`outputs/skill-voice-cloner.md`. Conception d'un pipeline de clonage ou de conversion avec passerelle de consentement + marque d'eau + cible de qualité.

## Exercices

1. **Easy.**On court .`code/main.py`. Démontre le swap intégrant le haut-parleur en calculant le cosine entre deux " haut-parleurs " avant et après le swap.
2. **Medium.**Utilisez OpenVoice v2 pour cloner votre propre voix. Mesurez SECS entre référence et clone. Mesurez CER via Whisper.
3. **Hard.**Appliquez le symbole d'eau SilentCipher à 20 clones, exécutez-les à travers le code MP3 + décode de 128 kbps, détectez la charge utile.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Zero-shot clone | 5 seconds is enough | Pretrained model + speaker embedding; no training. |
| PPG | Phonetic posteriorgram | Per-frame ASR posteriors used as language-agnostic content rep. |
| KNN-VC | Nearest-neighbor conversion | Replace each source frame with nearest target-pool frame. |
| Neural codec TTS | VALL-E style | AR model over EnCodec/SoundStream tokens. |
| Watermark | Inaudible signature | Bits embedded in audio, survive re-encode. |
| SECS | Cloning fidelity | Cosine between target and clone speaker embeddings. |
| AASIST | Deepfake detector | Anti-spoof model; detects synthesized speech. |

## Pour en savoir plus

- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) clonage de SOTA à source ouverte.
- [Baevski et al. / Microsoft (2023). VALL-E](https://arxiv.org/abs/2301.02111)et [VALL-E 2 (2024)](https://arxiv.org/abs/2406.05370) TTS de codec neuronal.
- [Qian et al. (2019). AutoVC](https://arxiv.org/abs/1905.05879) conversion vocale basée sur la décomposition.
- [Baas, Waubert de Puiseau, Kamper (2023). KNN-VC](https://arxiv.org/abs/2305.18975) VC basé sur la récupération.
- [SilentCipher (2024) — Audio Watermarking](https://github.com/sony/silentcipher) Marque-eau audio 32 bits prête à la production.
- [ASVspoof 2025 results](https://www.asvspoof.org/) course aux armements détecteur contre synthétiseur, mise à jour en 2026.
