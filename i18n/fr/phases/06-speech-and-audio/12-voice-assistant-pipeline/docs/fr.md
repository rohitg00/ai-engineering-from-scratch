# Construire un pipeline d'assistants vocaux  La phase 6 Capstone

> Toutes les leçons du 1er au 11e, cousues ensemble. Construisez un assistant vocal qui écoute, raisonne et parle. En 2026, c'est un problème d'ingénierie résolu, pas un problème de recherche  mais les détails d'intégration décident si cela se produit.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04, 05, 06, 07, 11; Phase 11 · 09 (Function Calling); Phase 14 · 01 (Agent Loop)
**Time:** ~120 minutes

## Le problème

Construire un assistant de bout en bout:

1. Capture de l'entrée de micro (16 kHz mono).
2. Détecte le début et la fin de la parole de l'utilisateur.
3. Il transcrit le streaming.
4. Passe la transcription à un LLM qui peut appeler des outils (timer, météo, calendrier).
5. Il transmet un texte de LLM à un TTS.
6. Reproduit l'audio à l'utilisateur.
7. Arrête si l'utilisateur interrompt la réponse en milieu.

Objectif de latence: premier octet audio TTS dans les 800 ms de l'utilisateur terminant sa déclaration sur un processeur de ordinateur portable. Objectif de qualité: aucun mot manqué, aucun sous-titre halluciné sur le silence, aucune fuite de clonage vocale, aucun succès d'injection rapide.

## Le concept

![Voice assistant pipeline: mic → VAD → STT → LLM+tools → TTS → speaker](../assets/voice-assistant.svg)

### Les sept composantes

1. **Audio capture.**Mic → 16 kHz mono → 20 ms. Généralement `sounddevice`en Python ou en AudioUnit/ALSA/WASAPI natif en production.
2. **VAD (Lesson 11).**Silero VAD @ seuil 0,5, min discours 250 ms, silence pendu 500 ms. Signes "début" et "fin".
3. **Streaming STT (Lesson 4-5).**Whisper-streaming, Parakeet-TDT ou Deepgram Nova-3 (API). Transcriptions partielles + finales.
4. **LLM with tool calling.**GPT-4o / Claude 3.5 / Gemini 2.5 Flash. Schéma JSON pour les outils. Tokens de flux.
5. **Streaming TTS (Lesson 7).**Kokoro-82M (ouverture la plus rapide) ou Cartesia Sonic (commercial).
6. **Playback.**Le haut-parleur est sorti, le code opus pour les réseaux à faible bande passante.
7. **Interruption handler.**Si le VAD prend feu pendant la lecture de TTS, arrêtez la lecture, annulez LLM, redémarrez STT.

### Les trois modes d'échec que vous allez atteindre

1. **First-word clip.**Le VAD commence un rythme trop tard, le "hey" de l'utilisateur manque.
2. **Mid-response interrupt confusion.**LLM continue de générer après l'interruption de l'utilisateur; l'assistant parle à l'utilisateur.
3. **Silence hallucination.**Les sons de "merci de regarder" sur les cadres silencieux.

### 2026 stacks de référence de production

| Stack | Latency | License | Notes |
|-------|---------|---------|-------|
| LiveKit + Deepgram + GPT-4o + Cartesia | 350-500 ms | commercial API | Industry default 2026 |
| Pipecat + Whisper-streaming + GPT-4o + Kokoro | 500-800 ms | mostly open | DIY-friendly |
| Moshi (full-duplex) | 200-300 ms | CC-BY 4.0 | Single-model; different architecture, lesson 15 |
| Vapi / Retell (managed) | 300-500 ms | commercial | Fastest to launch; limited customization |
| Whisper.cpp + llama.cpp + Kokoro-ONNX | offline | open | Privacy / edge |

```figure
v4-voice-latency
```

## Faites-le

### Étape 1: capture de microphone par déchiquetage (pseudocode)

```python
import sounddevice as sd

def mic_stream(chunk_ms=20, sr=16000):
    q = queue.Queue()
    def cb(indata, frames, time, status):
        q.put(indata.copy().flatten())
    with sd.InputStream(channels=1, samplerate=sr, blocksize=int(sr * chunk_ms/1000), callback=cb):
        while True:
            yield q.get()
```

### Étape 2: Capture de tour à travers le VAD

```python
def capture_turn(stream, vad, pre_roll_ms=300, silence_ms=500):
    buf, pre, triggered = [], collections.deque(maxlen=pre_roll_ms // 20), False
    silent = 0
    for chunk in stream:
        pre.append(chunk)
        if vad(chunk):
            if not triggered:
                buf = list(pre)
                triggered = True
            buf.append(chunk)
            silent = 0
        elif triggered:
            silent += 20
            buf.append(chunk)
            if silent >= silence_ms:
                return b"".join(buf)
```

### Étape 3: diffusion en streaming STT → LLM → TTS

```python
async def turn(audio_bytes):
    transcript = await stt.transcribe(audio_bytes)
    async for token in llm.stream(transcript):
        async for audio in tts.stream(token):
            await speaker.play(audio)
```

### Étape 4: appel à l'outil à l'intérieur de la boucle de LLM

```python
tools = [
    {"name": "get_weather", "parameters": {"location": "string"}},
    {"name": "set_timer", "parameters": {"seconds": "int"}},
]

async for chunk in llm.stream(user_text, tools=tools):
    if chunk.type == "tool_call":
        result = dispatch(chunk.name, chunk.args)
        continue_streaming(result)
    if chunk.type == "text":
        await tts.stream(chunk.text)
```

### Étape 5: manipulation des interruptions

```python
tts_task = asyncio.create_task(tts_loop())
while True:
    chunk = await mic.get()
    if vad(chunk):
        tts_task.cancel()
        await speaker.stop()
        await new_turn()
        break
```

## Utilisez-le

Regardez !`code/main.py`pour une simulation exécutable qui câble les sept composants avec des modèles de bâton, de sorte que vous pouvez voir la forme du pipeline même sans matériel.

- `silero-vad`(le secteur de l'énergie)`pip install silero-vad`)
- `deepgram-sdk`ou `openai-whisper`
- `openai`(le secteur de l'énergie)`gpt-4o`) ou `anthropic`
- `kokoro`ou `cartesia`
- `sounddevice`pour le dépôt/dépôt

## Les pièges

- **Logging PII forever.**L'audio à tour complet est une information personnelle dans la plupart des juridictions.
- **No barge-in.**Les utilisateurs vont interrompre, votre assistante doit arrêter de parler.
- **TTS that blocks.**TTS synchrone bloque la boucle d'événement. Utilisez asynchrony ou un fil séparé.
- **No tool-call error handling.**Les outils échouent. LLM doit récupérer l'erreur + réessayer une fois, puis dégrader graceusement.
- **Overzealous hallucination filters.**Le filtre trop long et l'assistant répète "je ne peux pas m'y prendre".
- **No wake-word option.**L'écoute est une responsabilité de la vie privée.

## La faire partir

- Je ne sais pas .`outputs/skill-voice-assistant-architect.md`. Compte tenu des contraintes budgétaires + d'échelle + de langue + de conformité, produire une spécification complète de la pile.

## Exercices

1. **Easy.**On court .`code/main.py`Il simule un tour complet de bout en bout avec des modules de bout et des empreintes par étape de latence.
2. **Medium.**Remplacez le bâton de la STT par un vrai modèle Whisper sur une préenregistrée `.wav`- Mesurer le WER et la latence de bout en bout.
3. **Hard.**Ajouter des appels à outils: mettre en œuvre `get_weather`(toute API) et `set_timer`.Conduire le LLM à travers les outils et vérifier que lorsque l'utilisateur dit "configure un temporiseur de 5 minutes", la bonne fonction s'allume et la réponse orale le confirme.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Turn | A user + assistant round-trip | One VAD-bounded user speech + one LLM-TTS response. |
| Barge-in | Interruption | User speaks while assistant talks; assistant stops. |
| Wake word | "Hey assistant" | Short keyword detector; Porcupine, Snowboy, openWakeWord. |
| End-pointing | Turn ending | VAD + min-silence decision that user has finished. |
| Pre-roll | Pre-speech buffer | Keep 200-400 ms of audio before VAD fires to avoid first-word clip. |
| Tool call | Function invocation | LLM emits JSON; runtime dispatches; result feeds back in-loop. |

## Pour en savoir plus

- [LiveKit — voice agent quickstart](https://docs.livekit.io/agents/) référence au niveau de production.
- [Pipecat — voice agent examples](https://github.com/pipecat-ai/pipecat) Cadre adapté aux bricolages.
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) le chemin de la voix native géré.
- [Kyutai Moshi](https://github.com/kyutai-labs/moshi) référence à double double (leçon 15).
- [Porcupine wake-word](https://picovoice.ai/products/porcupine/)- Le réveil.
- [Anthropic — tool use guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) Appel à la fonction de LLM.
