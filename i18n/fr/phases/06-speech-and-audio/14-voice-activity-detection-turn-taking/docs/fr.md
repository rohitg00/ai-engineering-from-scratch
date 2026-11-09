# Détection et prise de vue de l'activité vocale  Silero, Cobra et le flush

> Chaque agent vocal vit ou meurt sur deux décisions: l'utilisateur parle maintenant, et sont-ils terminés? VAD répond au premier. Détection de virage (VAD + silence-hangover + modèle de point d'extrémité sémantique) répond au second.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 11 (Real-Time Audio), Phase 6 · 12 (Voice Assistant)
**Time:** ~45 minutes

## Le problème

Trois décisions distinctes qu' un agent de voix prend sur chaque pièce de 20 ms:

1. **Is this frame speech?**- Le VAD, binaire, par cadre.
2. **Has the user started a new utterance?** détection de l'apparition.
3. **Has the user finished?** point de fin (tour de fin).

La réponse naïve (troisième limite d'énergie) échoue sur tout bruit  trafic, claviers, babbling de foule. La réponse 2026: Silero VAD (ouverte, profondément apprise) + un modèle de détection de tour (section de bout sémantique) + une gueule de bois de silence calibrée par VAD.

## Le concept

![VAD cascade: energy → Silero → turn-detector → flush trick](../assets/vad-turn-taking.svg)

### La cascade de trois niveaux de VAD

**Tier 1: energy gate.**Le plus bon marché, le seuil RMS à -40 dBFS, filtre le silence évident mais tire sur tout bruit au-dessus du seuil.

**Tier 2: Silero VAD**Paramètres 1M. Formé sur 6000 langues. Runs en ~1 ms par 30 ms de pièce sur un seul fil de CPU. 87,7% TPR à 5% FPR.

**Tier 3: semantic turn detector.**Le modèle de détection de tour de LiveKit (2024-2026) ou votre propre petit classifiateur.

### Paramètres clés et leurs défauts

- **Threshold.**Silero produit une probabilité; classer le discours à &gt; 0,5 (par défaut) ou &gt; 0,3 (sensitif).
- **Minimum speech duration.**Rejeter le discours plus court que 250 ms  généralement la toux ou le bruit de la chaise.
- **Silence hangover (end-pointing).**Après que le VAD soit revenu à 0, attendez 500 à 800 ms avant de déclarer la fin du tour. Trop court → interrompre l'utilisateur. Trop longtemps → semble lent.
- **Pre-roll buffer.**Gardez 300 à 500 ms d'audio avant que le VAD ne tire.

### Le truc du flush (Kyutai 2025)

Les modèles STT en streaming ont un retard de vision (500 ms pour Kyutai STT-1B, 2,5 s pour STT-2.6B). Normalement, vous attendez aussi longtemps après la fin de la parole pour la transcription.**send a flush signal to the STT**Le processus STT est effectué en temps réel, donc le tampon de 500 ms se termine en 125 ms.

Fin à fin: 125 ms VAD + flush STT = latence de conversation.

### Comparaison du VAD 2026

| VAD | TPR @ 5% FPR | Latency | License |
|-----|--------------|---------|---------|
| WebRTC VAD (Google, 2013) | 50.0% | 30 ms | BSD |
| Silero VAD (2020-2026) | 87.7% | ~1 ms | MIT |
| Cobra VAD (Picovoice) | 98.9% | ~1 ms | commercial |
| pyannote segmentation | 95% | ~10 ms | MIT-ish |

Silero est la bonne option par défaut. Cobra est la mise à niveau de conformité / précision.

```figure
sp-vad-cascade
```

## Faites-le

### Étape 1: la porte d'énergie

```python
def energy_vad(chunk, threshold_dbfs=-40.0):
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    dbfs = 20.0 * math.log10(max(rms, 1e-10))
    return dbfs > threshold_dbfs
```

### Étape 2: Silero VAD en Python

```python
from silero_vad import load_silero_vad, get_speech_timestamps

vad = load_silero_vad()
audio = torch.tensor(waveform_16k, dtype=torch.float32)
segments = get_speech_timestamps(
    audio, vad, sampling_rate=16000,
    threshold=0.5,
    min_speech_duration_ms=250,
    min_silence_duration_ms=500,
    speech_pad_ms=300,
)
for s in segments:
    print(f"{s['start']/16000:.2f}s - {s['end']/16000:.2f}s")
```

### Étape 3: machine d'état de tournage

```python
class TurnDetector:
    def __init__(self, silence_hangover_ms=500, min_speech_ms=250):
        self.state = "idle"
        self.speech_ms = 0
        self.silence_ms = 0
        self.silence_hangover_ms = silence_hangover_ms
        self.min_speech_ms = min_speech_ms

    def update(self, is_speech, chunk_ms=20):
        if is_speech:
            self.speech_ms += chunk_ms
            self.silence_ms = 0
            if self.state == "idle" and self.speech_ms >= self.min_speech_ms:
                self.state = "speaking"
                return "START"
        else:
            self.silence_ms += chunk_ms
            if self.state == "speaking" and self.silence_ms >= self.silence_hangover_ms:
                self.state = "idle"
                self.speech_ms = 0
                return "END"
        return None
```

### Étape 4: le squelette de la ruse

```python
def flush_on_end(stt_client, audio_buffer):
    stt_client.send_audio(audio_buffer)
    stt_client.send_flush()
    return stt_client.recv_transcript(timeout_ms=150)
```

STT (Kyutai, Deepgram, AssemblyAI) doit prendre en charge le flush pour que cela fonctionne.

## Utilisez-le

| Situation | VAD choice |
|-----------|-----------|
| Open, fast, general | Silero VAD |
| Commercial call center | Cobra VAD |
| On-device (phone) | Silero VAD ONNX |
| Research / diarization | pyannote segmentation |
| Zero-dependency fallback | WebRTC VAD (legacy) |
| Need turn-ending quality | Silero + LiveKit turn-detector layered |

Règle générale: ne jamais expédier de VAD à usage énergétique uniquement à moins que vous n'ayez vraiment pas d'autre option.

## Les pièges

- **Fixed threshold.**Il fonctionne en silence, il échoue en bruit.
- **Too-short silence hangover.**L'agent interrompt la moitié de la phrase. 500 à 800 ms est le bon point pour le discours de conversation.
- **Too-long hangover.**C'est un test A/B avec des utilisateurs cibles.
- **No pre-roll buffer.**Les 200 à 300 ms d'audio perdus par l'utilisateur.
- **Ignoring semantic endpointing.**"Hmm, laisse-moi penser"... contient de longues pauses. Les utilisateurs détestent être coupés au milieu de la pensée. Utilisez le détecteur de tour de LiveKit ou quelque chose comme ça.

## La faire partir

- Je ne sais pas .`outputs/skill-vad-tuner.md`Choisissez le modèle VAD, le seuil, la gueule de bois, la stratégie de pré-rolling et de détection de tour pour une charge de travail.

## Exercices

1. **Easy.**On court .`code/main.py`Il simule une séquence de discours + silence + discours + toux et teste trois niveaux de VAD.
2. **Medium.**Installez`silero-vad`, traiter une enregistrement de 5 minutes, régler le seuil pour minimiser les clips de premier mot et les faux déclencheurs.
3. **Hard.**Construisez un mini détecteur de virage: Silero VAD + un MLP à 3 couches sur les emblèmes des 10 derniers mots (utilisez des transformateurs de phrases).

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| VAD | Voice detector | Binary per-frame: is this speech? |
| Turn detection | End-pointing | VAD + silence-hangover + semantic endpoint. |
| Silence hangover | Wait-after-speech | Time to wait before declaring turn end; 500-800 ms. |
| Pre-roll | Pre-speech buffer | Keep 300-500 ms audio before VAD fires. |
| Flush trick | Kyutai hack | VAD → flush-STT → 125 ms instead of 500 ms delay. |
| Semantic endpoint | "Did they mean to stop?" | ML classifier that looks at words, not just silence. |
| TPR @ FPR 5% | ROC point | Standard VAD benchmark; 87.7% for Silero, 50% WebRTC. |

## Pour en savoir plus

- [Silero VAD](https://github.com/snakers4/silero-vad) l'ouverture de référence du VAD.
- [Picovoice Cobra VAD](https://picovoice.ai/products/voice/voice-activity-detection/) leader de la précision commerciale.
- [Kyutai — Unmute + flush trick](https://kyutai.org/stt)- Le truc de l'ingénierie sous 200 ms.
- [LiveKit — turn detection](https://docs.livekit.io/agents/logic/turns/) définition sémantique de la production.
- [WebRTC VAD](https://webrtc.googlesource.com/src/) la ligne de base héritée.
- [pyannote segmentation](https://github.com/pyannote/pyannote-audio) Segmentation au niveau de la diarisation.
