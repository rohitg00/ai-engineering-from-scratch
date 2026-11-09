# Diffusion en streaming de discours à discours  Moshi, Hibiki et dialogue à double sens

> En 2024, il a redéfini l'IA vocale. Moshi envoie un modèle unique qui écoute et parle simultanément à 200 ms de latence. Hibiki fait la traduction de la parole à la parole pièce par pièce. Les deux abandonnent le pipeline ASR → LLM → TTS pour une architecture unifiée à double double double sur les jetons de codec Mimi.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 13 (Neural Audio Codecs), Phase 6 · 11 (Real-Time Audio), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## Le problème

Chaque agent vocal construit à partir des leçons 11 + 12 a un plancher de latence fondamental autour de 300-500 ms: incendies VAD, processus STT, raisons LLM, générations TTS. Chaque étape a sa propre latence minimale. Vous pouvez régler et paralléliser, mais la forme du pipeline vous coupe.

Moshi (Kyutai, 2024-2026) pose une autre question: et si il n'y a pas de pipeline ?

La réponse est:**full-duplex speech-to-speech**La latence théorique est de 160 ms (80 ms Mimi frame + 80 ms retard acoustique) et la latence pratique de 200 ms sur un seul GPU L4.

## Le concept

![Moshi architecture: two parallel Mimi streams + inner-monologue text](../assets/moshi-hibiki.svg)

### L'architecture de Moshi

**Inputs.**Deux flux de codecs Mimi, tous deux à 12,5 Hz × 8 livres de code:

- Stream 1: audio utilisateur (mimi-encodé, toujours en arrière)
- Stream 2: audio de Moshi (géré par Moshi)

**The transformer.**Un transformateur temporel de paramètre 7B traite les flux et un flux de texte "monologue interne".

1. Consomme les derniers jetons Mimi utilisateur (8 livres de code).
2. Consomme les plus récents jetons de Moshi Mimi (8 livres de code, tel que produit).
3. Génère le prochain jeton de texte Moshi (monologue interne).
4. Génère les prochains jetons de Moshi Mimi (8 livres de code via un petit transformateur de profondeur).

Les trois flux  audio utilisateur, audio Moshi, texte Moshi  fonctionnent en parallèle. Moshi peut entendre l'utilisateur en parlant; peut s'interrompre lorsqu'il interrompt; peut revenir en arrière ("mhm") sans rompre son énoncé principal.

**The depth transformer.**Dans un cadre, les 8 codebooks ne sont pas prédits en parallèle  ils ont des dépendances inter-codebooks. Un petit "transformateur de profondeur" de 2 couches les prédit séquentiellement dans un délai de 80 ms. C'est la facteurisation standard pour les LM codec AR (également utilisée par VALL-E, VibeVoice).

### Pourquoi le texte du monologue interne est utile

Sans texte explicite, le modèle doit implicitement modéliser le langage dans son flux acoustique. L'idée de Moshi: forcer l'émetteur à émettre des jetons de texte à côté de l'audio. Le flux de texte est essentiellement la transcription de ce que Moshi dit. Cela améliore la cohérence sémantique, facilite l'échange d'une tête de modèle de langage et vous donne des transcriptions gratuitement.

### Hibiki: traduction en streaming de la langue à la langue

La même architecture, formée sur des paires de traductions. L'audio source est entré, l'audio de la langue cible est sorti, en continu. Hibiki-Zero (février 2026) élimine le besoin de données de formation alignées au niveau du mot  utilise des données au niveau de la phrase + GRPO renforcement de l'apprentissage pour l'optimisation de la latence.

Quatre paires de langues prises en charge initialement; peut être adapté à une nouvelle langue avec ≈1000 heures.

### La pile de Kyutai plus large (2026)

- **Moshi** dialogue à double sens (d'abord en français, bien accompagné en anglais)
- **Hibiki / Hibiki-Zero** traduction simultanée du langage
- **Kyutai STT** RAS de streaming (500 ms ou 2,5 s regardant vers l'avant)
- **Kyutai Pocket TTS** TTS de 100 M param fonctionne sur CPU (janvier 2026)
- **Unmute** un pipeline complet combinant ces services sur des serveurs publics

Débit sur un GPU L40S: 64 sessions simultanées en temps réel 3x.

### Le CSM de sésame  le cousin

Sesame CSM (2025) utilise une idée similaire  une colonne vertébrale Llama-3 avec une tête de codec Mimi. Mais CSM est unidirectionnel (prend le contexte + texte, produit la parole) plutôt que du double. C'est le meilleur TTS "présence vocale" sur le marché; pas tout à fait le même que la capacité du double complet de Moshi.

### Numéros de performance 2026

| Model | Latency | Use case | License |
|-------|---------|----------|---------|
| Moshi | 200 ms (L4) | full-duplex English / French dialogue | CC-BY 4.0 |
| Hibiki | 12.5 Hz framerate | French ↔ English streaming translation | CC-BY 4.0 |
| Hibiki-Zero | same | 5 language-pairs, no aligned data | CC-BY 4.0 |
| Sesame CSM-1B | 200 ms TTFA | context-conditioned TTS | Apache-2.0 |
| GPT-4o Realtime | ~300 ms | closed, OpenAI API | commercial |
| Gemini 2.5 Live | ~350 ms | closed, Google API | commercial |

```figure
sp-fullduplex
```

## Faites-le

### Étape 1: l'interface

Moshi expose un serveur WebSocket qui prend 80 ms de musique codée par Mimi et renvoie 80 ms de musique codée par Mimi.

```python
import asyncio
import websockets
from moshi.client_utils import encode_audio_mimi, decode_audio_mimi

async def moshi_chat():
    async with websockets.connect("ws://localhost:8998/api/chat") as ws:
        mic_task = asyncio.create_task(stream_mic_to(ws))
        spk_task = asyncio.create_task(stream_from_to_speaker(ws))
        await asyncio.gather(mic_task, spk_task)
```

### Étape 2: boucle à double double

```python
async def stream_mic_to(ws):
    async for chunk_80ms in mic_stream_at_12_5_hz():
        mimi_tokens = encode_audio_mimi(chunk_80ms)
        await ws.send(serialize(mimi_tokens))

async def stream_from_to_speaker(ws):
    async for msg in ws:
        mimi_tokens, text_token = deserialize(msg)
        audio = decode_audio_mimi(mimi_tokens)
        await play(audio)
```

Les deux directions fonctionnent simultanément. Python asyncio ou Rust futures sont le transport standard.

### Étape 3: objectif de formation (conceptuel)

Pour chaque image de 80 ms `t`- Le numéro de la liste:

- Enregistrement: `user_mimi[0..t]`- Je suis là .`moshi_mimi[0..t-1]`- Je suis là .`moshi_text[0..t-1]`
- Prédit: `moshi_text[t]`Alors ...`moshi_mimi[t, codebook_0..7]`

Le texte est prédit avant l'audio (monologue interne); l'audio est prédit séquentiel en codebook dans le transformateur de profondeur.

### Étape 4: où Moshi gagne et où il ne gagne pas

Moshi gagne:

- Sub-250 ms de bout en bout sur du matériel bon marché.
- Des retrovisons naturelles et des interruptions.
- Pas de code de colle pour pipeline.

Moshi ne gagne pas:

- Appel à l'outil (pas formé pour cela; vous avez besoin d'un parcours de LLM séparé).
- Le raisonnement long (Moshi est un modèle de dialogue 8B, pas Claude/GPT-4).
- Accuracité factuelle sur des sujets de niche.
- La plupart des cas d'utilisation dans les entreprises de production (les pipelines sont toujours utilisées en 2026).

## Utilisez-le

| Situation | Pick |
|-----------|------|
| Lowest-latency voice companion | Moshi |
| Live translation call | Hibiki |
| Voice demo / research | Moshi, CSM |
| Enterprise agent with tools | Pipeline (Lesson 12), not Moshi |
| Custom-voice TTS in context | Sesame CSM |
| Speech-to-speech, any languages | GPT-4o Realtime or Gemini 2.5 Live (commercial) |

## Les pièges

- **Limited tool calling.**Moshi est un modèle de dialogue, pas un cadre d'agent.
- **Specific-voice conditioning.**Moshi utilise un seul personnage formé; le clonage est une sélection d'entraînement séparée.
- **Language coverage.**Le français + l'anglais est excellent, d'autres sont limités. Hibiki-Zero aide, mais vous avez toujours besoin de données de formation.
- **Resource cost.**Une session Moshi complète contient une fente GPU; pas un modèle de déploiement partagé par les locataires bon marché.

## La faire partir

- Je ne sais pas .`outputs/skill-duplex-pipeline.md`Choisissez pipeline versus architecture double pour une charge de travail d'agent vocal, avec raison.

## Exercices

1. **Easy.**On court .`code/main.py`Il simule symboliquement l'architecture à deux courants + monologue interne.
2. **Medium.**Tirez Moshi de HuggingFace, exécutez le serveur, testez une conversation, mesurez la latence de l'horloge murale de la fin de la conversation à la réponse de Moshi.
3. **Hard.**Prenez votre agent de pipeline de leçon 12 et comparez la latence P50 vs Moshi sur 20 déclarations de test correspondantes.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Full-duplex | Hear-and-speak at once | Two audio streams active simultaneously on the same model. |
| Inner monologue | Model's text stream | Moshi emits text tokens alongside its audio output. |
| Depth transformer | Inter-codebook predictor | Small transformer that predicts 8 codebooks within one 80 ms frame. |
| Mimi | Kyutai's codec | 12.5 Hz × 8 codebooks; semantic+acoustic; powers Moshi. |
| Streaming S2S | Audio → audio live | Chunk-by-chunk translation/dialogue, no pipeline stages. |
| Back-channeling | "Mhm" reactions | Moshi can emit small acknowledgments without breaking its turn. |

## Pour en savoir plus

- [Défossez et al. (2024). Moshi — speech-text foundation model](https://arxiv.org/html/2410.00037v2)- Le journal.
- [Kyutai Labs (2026). Hibiki-Zero](https://arxiv.org/abs/2602.12345) Translation en streaming sans données alignées.
- [Sesame (2025). Crossing the uncanny valley of voice](https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice) Spécifications du MCS.
- [Kyutai — Moshi repo](https://github.com/kyutai-labs/moshi) installer + serveur.
- [OpenAI — Realtime API](https://platform.openai.com/docs/guides/realtime) parité commerciale fermée.
- [Kyutai — Delayed Streams Modeling](https://github.com/kyutai-labs/delayed-streams-modeling) le cadre STT/TTS sous le capot.
