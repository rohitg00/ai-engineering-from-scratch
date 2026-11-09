# Agents de voix: Pipecat et LiveKit

> Les agents vocaux sont une catégorie de production de première classe en 2026. Pipecat vous offre un pipeline basé sur le cadre Python (VAD → STT → LLM → TTS → transport). LiveKit Agents renvoie les modèles d'IA aux utilisateurs via WebRTC.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Décrivez le pipeline basé sur le cadre de Pipecat: DOWNSTREAM (source→sink) et UPSTREAM (contrôle).
- Nombre des étapes du pipeline vocal canonique et qui transportent les supports Pipecat.
- Expliquez les deux classes d'agents vocaux de LiveKit Agents (MultimodalAgent, VoicePipelineAgent) et quand chacune s'adapte.
- Résumez les attentes de latence de production en 2026 et comment elles influencent les choix d'architecture.

## Le problème

Les agents vocaux ne sont pas une boucle de texte avec TTS connecté. Les budgets de latence sont brutaux (~ 600 ms), l'audio partiel est par défaut, la détection de virage est un modèle, et les transports vont de la téléphonie SIP à WebRTC.

## Le concept

### Le piquet (piquet-ai/piquet)

- Cadre de pipeline basé sur le cadre Python.
- `Frame`- Je suis là.`FrameProcessor`une chaîne.
- Deux directions de débit:
  - **DOWNSTREAM** source → évier (audio en, TTS hors).
  - **UPSTREAM** rétroaction et contrôle (annulation, métriques, barge-in).
- `PipelineTask`gère le cycle de vie avec des événements (`on_pipeline_started`- Je suis là .`on_pipeline_finished`- Je suis là .`on_idle_timeout`) et des observateurs pour les mesures/traçage/RTVI.

L'équipement de transport typique:

```
VAD (Silero) → STT → LLM (context alternates user/assistant) → TTS → transport
```

Les transports: quotidien, LiveKit, SmallWebRTCTransport, FastAPI WebSocket, WhatsApp.

Pipecat Flow ajoute des conversations structurées (machines d'état).

### Les agents de LiveKit (livekit/agents)

- Il permet de passer des modèles d'IA aux utilisateurs via WebRTC.
- Concepts clés: `Agent`- Je suis là .`AgentSession`- Je suis là .`entrypoint`- Je suis là .`AgentServer`- Je suis désolé .
- Deux cours d'agents vocales:
  - **MultimodalAgent** audio direct via OpenAI en temps réel ou équivalent.
  - **VoicePipelineAgent** STT → LLM → TTS cascade; donne un contrôle au niveau du texte.
- Détection sémantique du tour par un modèle transformateur.
- Intégration de MCP natifs.
- Téléphonie par SIP.
- 50+ modèles sans API-clés via LiveKit Inference; 200+ plus via des plugins.

### Plateformes commerciales

Vapi (~ 450600ms sur une pile premium optimisée) et Retell (~ 600ms de bout en bout sur 180 appels de test) s'ajoutent à ces deux.

### Où ce modèle va mal

- **No barge-in handling.**L'utilisateur interrompt, l'agent continue de parler. Require UPSTREAM d'annuler des images dans Pipecat, équivalent dans LiveKit.
- **STT confidence ignored.**Des transcriptions de faible confiance sont envoyées à la maîtrise comme un évangile.
- **TTS mid-sentence cutoff.**Lorsque le pipeline annule le milieu de l'utterance, TTS doit savoir ou couper l'audio.
- **Latency budget ignored.**Chaque composant ajoute 50 à 200 ms. Résumez votre chaîne avant expédition.

### La latence typique en 2026

- VAD: 20 à 60 ms
- TTS partiel: 100 à 250 ms
- Le premier jeton LLM: 150400ms
- TTS première voix: 100 à 200 ms
- RTT de transport: 3080ms

Le temps de transmission de 450 à 600 ms est très élevé. 800 à 1200 ms est courant. Tout ce qui est supérieur à 1500 ms semble cassé.

```figure
voice-pipeline
```

## Faites-le

`code/main.py`est un pipeline de jouets à base de cadres avec:

- `Frame`types (audio, transcription, texte, tts_audio, contrôle).
- `Processor`interface avec `process(frame)`- Je suis désolé .
- Un pipeline en cinq étapes (VAD → STT → LLM → TTS → transport) en tant que processeurs scriptés.
- Un cadre UPSTREAM pour démontrer le barge-in.

- Je vais le faire.

```
python3 code/main.py
npx tsx code/main.ts
```

La trace montre un débit normal et une annulation de barge qui arrête le TTS à mi-écoute.

## Utilisez-le

- **Pipecat**pour un contrôle complet  processeurs personnalisés, fournisseurs de services Python-first, enregistreurs.
- **LiveKit Agents**pour les déploiements WebRTC et la téléphonie.
- **Vapi / Retell**pour les agents de voix hébergés sans équipe WebRTC.
- **OpenAI Realtime / Gemini Live**pour l'audio-en/audio-sortie directe (MultimodalAgent).

## La faire partir

`outputs/skill-voice-pipeline.md`Il est équipé d'un pipeline vocal en forme de Pipecat avec VAD + STT + LLM + TTS + transport plus maniabilité à la barge.

## Exercices

1. Ajoutez un observateur de métriques à votre pipeline de jouets: comptez les cadres par étape par seconde.
2. Mettre en œuvre une TST avec un dégagement de confiance: en dessous du seuil, demander "peut-on le répéter?"
3. Ajouter la détection sémantique du tour: règle simple  si la transcription se termine par "?", fin du tour.
4. Lisez les documents de transport de Pipecat.
5. Mesurer une cascade OpenAI en temps réel par rapport à STT+LLM+TTS sur la même requête. Quel coût de latence le contrôle au niveau du texte implique-t-il ?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Frame | "Event" | Typed unit of data in the pipeline (audio, transcript, text, control) |
| Processor | "Pipeline stage" | Handler with process(frame) |
| DOWNSTREAM | "Forward flow" | Source to sink: audio in, speech out |
| UPSTREAM | "Feedback flow" | Control: cancel, metrics, barge-in |
| VAD | "Voice activity detection" | Detects when user is speaking |
| Semantic turn detection | "Smart end-of-turn" | Model-based decision that the user is done |
| MultimodalAgent | "Direct audio agent" | Audio in, audio out; no text in the middle |
| VoicePipelineAgent | "Cascade agent" | STT + LLM + TTS; text-level control |

## Pour en savoir plus

- [Pipecat docs](https://docs.pipecat.ai/getting-started/introduction) pipeline à base de cadres, transformateurs, transports
- [LiveKit Agents docs](https://docs.livekit.io/agents/) WebRTC + voix primitives
- [Vapi](https://vapi.ai/) plateforme vocale gérée
- [Retell AI](https://www.retellai.com/) voix gérée, marquée par la latence
