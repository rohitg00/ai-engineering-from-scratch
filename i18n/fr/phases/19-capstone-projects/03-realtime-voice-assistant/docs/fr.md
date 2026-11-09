# Capstone 03  Assistant vocal en temps réel (ASR à LLM à TTS)

> Un agent vocal qui se sent bien a une latence de bout en bout inférieure à 800 ms, sait quand vous avez arrêté de parler, gère le barge-in et peut appeler un outil sans ralentir. Retell, Vapi, LiveKit Agents et Pipecat sont tous arrivés dans ce bar en 2026. Ils le font avec la même forme: un ASR en streaming, un détecteur de tour, un LLM en streaming et un TTS en streaming, tous câblés via WebRTC avec des budgets de latence agressifs à chaque saut. Construisez un, mesurez le WER et le MOS et le taux de faux coupures, et mettez-le en fonction de la perte de paquets.

**Type:** Capstone
**Languages:** Python (agent + pipeline), TypeScript (web client, scheduler scaffold)
**Prerequisites:** Phase 6 (speech and audio), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 17 (infrastructure)
**Phases exercised:**P6 · P7 · P11 · P13 · P14 · P17
**Time:** 30 hours

## Problème

La voix a été la catégorie d'IA UX la plus rapide de 2025-2026. Le plafond technique a chuté à chaque trimestre. OpenAI Realtime API, Gemini 2.5 Live, Cartesia Sonic-2, ElevenLabs Flash v3, LiveKit Agents 1.0, et Pipecat 0.0.70 mettent tous sous 800 ms de première sortie audio à portée de main. Le bar n'est pas le seul. C'est la sensation d'interaction: ne pas couper l'utilisateur, ne pas se faire couper, se remettre d'une interruption au milieu de la phrase, appeler un outil au milieu de la conversation sans arrêter l'audio, survivre aux réseaux mobiles nerveux.

Vous ne pouvez pas y arriver en cousant trois appels REST. L'architecture est en tuyauterie de streaming de bout en bout. Construisez-le et les modes d'échec deviennent visibles: un VAD réglé pour l'enregistrement audio du téléphone sur le téléviseur d'arrière-plan, un détecteur de tour en attente de ponctuation qui ne vient jamais, un TTS qui tamponne 400 ms avant d'émettre.

## Concept

Le pipeline a cinq étapes de streaming: **audio in**(WebRTC depuis le navigateur ou le réseau public de téléphonie mobile), **ASR**(en diffusant des transcriptions partielles de Deepgram Nova-3 ou plus rapidement), **turn detection**(VAD plus un petit modèle de détecteur de tour qui lit des transcriptions partielles pour obtenir des indices de finalisation), **LLM**(transmission de jetons dès que le tour est jugé complet), **TTS**(en streaming audio dans les ~ 200 ms du premier jeton LLM).

Trois préoccupations interdisciplinaires. **Barge-in**: lorsque l'utilisateur commence à parler pendant que l'agent parle, le TTS annule et l'ASR reprend immédiatement. **Tool use**: les appels à la fonction de conversation (température, calendrier) doivent être exécutés sur un canal latéral sans retard de l'audio; l'agent remplit un jeton de reconnaissance ("une seconde...") si la latence dépasse 300 ms. **Backpressure**: en cas de perte de paquets, des transcriptions partielles sont conservées, le VAD augmente le seuil de la porte de parole et l'agent évite de parler sur un message non reconnu.

La barre de mesure est quantitative. WER inférieure à 8% sur le Hamming VAD à 15 dB SNR. Première sortie audio p50 inférieure à 800 ms sur 100 appels mesurés. taux de faux coupe inférieur à 3%. MOS supérieur à 4,2 sur TTS. 50 appels concurrents sur un seul g5.xlarge. Ces chiffres sont les livrables.

## Architecture

```
browser / Twilio PSTN
        |
        v
   WebRTC / SIP edge
        |
        v
  LiveKit Agents 1.0  (or Pipecat 0.0.70)
        |
   +----+--------------+--------------+-----------------+
   |                   |              |                 |
   v                   v              v                 v
  ASR              VAD v5         turn-detector     side-channel
(Deepgram         (Silero)          (LiveKit)        tools
 Nova-3 /         speech-gate    completion score    (weather,
 Whisper-v3)      per 20ms        on partials        calendar)
   |                   |              |
   +--------+----------+--------------+
            v
        LLM (streaming)
     GPT-4o-realtime / Gemini 2.5 Flash /
     cascaded Claude Haiku 4.5
            |
            v
        TTS streaming
     Cartesia Sonic-2 / ElevenLabs Flash v3
            |
            v
     audio back to caller
            |
            v
   OpenTelemetry voice traces -> Langfuse
```

## La pile

- Transport: LiveKit Agents 1.0 (WebRTC) plus Twilio PSTN gateway; Pipecat 0.0.70 comme cadre alternatif
- ASR: Deepgram Nova-3 (en streaming, sous 300ms d'abord partiel) ou plus rapide à chuchotement Whisper-v3-turbo auto-hébergé
- VAD: Silero VAD v5 plus le détecteur de tour LiveKit (petit transformateur qui lit des transcriptions partielles)
- LLM: OpenAI GPT-4o en temps réel pour une intégration étroite, Gemini 2.5 Flash Live ou Claude Haiku 4.5 en cascade (achèvements de streaming, parcours audio séparé)
- TTS: Cartesia Sonic-2 (le plus bas de premier octet), ElevenLabs Flash v3, ou Orpheus open source pour l'hébergeur autonome
- Outils: canal latéral FastMCP pour la météo/calendrier/réservation; agent pré-émet remplissage si l'outil prend > 300ms
- Observabilité: portée vocale OpenTelemetry, traces vocales Langfuse avec lecture audio
- Déploiement: g5.xlarge unique (24 Go de RAM VRAM) pour l'hébergement autonome Whisper + Orpheus; API hébergées pour la latence la plus faible

```figure
ce-voice-latency
```

## Faites-le

1. **WebRTC session.**Mettez une salle LiveKit et un client Web qui diffuse l'audio du microphone. Sur le serveur, attachez un agent qui rejoint la salle.

2. **ASR streaming.**Fournir des images PCM de 20 ms à Deepgram Nova-3 (ou plus rapide sur GPU).

3. **VAD and turn detector.**Exécutez Silero VAD v5 sur le flux de cadre. Lors de l'événement de fin de discours, activez le détecteur de tours LiveKit contre la dernière transcription partielle. Commettez-vous à "compléter" uniquement lorsque VAD dit silence pendant 500 ms et que le détecteur de tours marque la fin > 0,6.

4. **LLM stream.**Au tour complet, commencez l'appel LLM avec la conversation en cours de cours plus la transcription finale.

5. **TTS stream.**Cartesia Sonic-2 renvoie les morceaux audio. La première pièce doit quitter le serveur dans les 200 ms du premier jeton LLM. Émettez les morceaux dans la salle LiveKit; le client joue à travers le tampon jitter WebRTC.

6. **Barge-in.**Lorsque le VAD détecte une nouvelle parole utilisateur pendant que TTS joue, annulez immédiatement le flux TTS, laissez tomber la sortie de LLM restante et remettez à jour l'ASR. Publiez un `tts_canceled`- Il est en train de se déchaîner.

7. **Tool side channel.**Enregistrer la météo et le calendrier comme outils d'appel de fonction. Lorsque l'appel est invoqué, activez l'appel simultanément; si il ne se résolve pas dans les 300 ms, que le LLM émette "une seconde, laissez-moi vérifier" comme un remplissage; reprendre une fois l'outil retourné.

8. **Eval harness.**Enregistrer 100 appels. Comptez le WER (contre une transcription retardée), le taux de faux coups (TTS annulé alors que l'utilisateur était au milieu de la phrase), le premier audio-out p50, TTS MOS (humain ou NISQA) et un test de perte de nervosité (décompresser 3% des paquets).

9. **Load test.**Exécuter 50 appels simultanés sur un seul g5.xlarge avec un appelant synthétique.

## Utilisez-le

```
caller: "what is the weather in tokyo tomorrow"
[asr  ] partial @280ms: "what is the"
[asr  ] partial @540ms: "what is the weather"
[turn ] completion score 0.82 at @820ms; commit
[llm  ] tool call emitted @880ms
[tool ] weather.tokyo tomorrow -> 68/52 partly cloudy @940ms
[llm  ] first token @990ms
[tts  ] first audio-out @1040ms: "Tokyo tomorrow will be partly cloudy..."
turn latency: 1040ms user-stop -> audio-out
```

## La faire partir

`outputs/skill-voice-agent.md`est le livrable. étant donné un domaine (assistance client, planification ou kiosque), il se présente comme un agent LiveKit avec le pipeline ASR/VAD/LLM/TTS ajusté à la barre de mesure.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | End-to-end latency | p50 first-audio-out under 800ms across 100 recorded calls |
| 20 | Turn-taking quality | False-cutoff rate under 3% on the Hamming VAD benchmark |
| 20 | Tool-use correctness | Mid-conversation tool calls that return the right data without stalling audio |
| 20 | Reliability under packet loss | WER and turn-taking stability with 3% packet drop injected |
| 15 | Eval harness completeness | Reproducible measurements with public config |
| **100** | | |

## Exercices

1. Swap Deepgram Nova-3 pour un turbo v3 plus rapide sur un g5.xlarge. Mesurer la latence et WER gap. Identifier où les décisions CPU-versus GPU comptent.

2. Ajouter une politique d'interruption-arbitrage: que fait l'agent lorsque l'utilisateur entre en ligne lors d'un appel à l'outil?

3. Exécuter un test de détecteur de virage adversitaire: donner à l'utilisateur de longues pauses au milieu de la phrase.

4. Déployer le même agent sur le PSTN via Twilio. Comparer le PSTN audio-out à WebRTC. Expliquer les différences entre le buffer jitter et le codec.

5. Ajoutez la détection de l'activité vocale pour les langues non anglaises (japonaise, espagnole). Mesurez le taux de fausse déclenchement de Silero VAD v5 par rapport aux tons fins spécifiques à la langue.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Turn detection | "End of utterance" | Classifier that, given VAD silence and a partial transcript, decides the user is done speaking |
| Barge-in | "Interruption handling" | Canceling TTS mid-playback when VAD detects new user speech |
| First-audio-out | "Latency" | Time from user stops speaking to the first audio packet leaving the server |
| VAD | "Speech gate" | Model classifying audio frames as speech vs silence; Silero VAD v5 is the 2026 default |
| Jitter buffer | "Audio smoothing" | Client-side buffer that holds packets briefly to absorb network variance |
| Filler | "Acknowledgment token" | Short phrase the agent emits to avoid silence when a tool is slow |
| MOS | "Mean opinion score" | Perceptual speech quality rating; NISQA is the automated proxy |

## Pour en savoir plus

- [LiveKit Agents 1.0](https://github.com/livekit/agents) cadre d'agents WebRTC de référence
- [Pipecat](https://github.com/pipecat-ai/pipecat) cadre d'agents de streaming Python-first
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) référence pour les modèles intégrés de la parole
- [Deepgram Nova-3 documentation](https://developers.deepgram.com/docs) référence de flux ASR
- [Silero VAD v5](https://github.com/snakers4/silero-vad) Modèle de référence du VAD
- [Cartesia Sonic-2](https://docs.cartesia.ai) référence TTS à faible latence
- [Retell AI architecture](https://docs.retellai.com) architecture de l'agent vocal de production
- [Vapi.ai production stack](https://docs.vapi.ai) référence de production alternative
