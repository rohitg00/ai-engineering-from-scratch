# Construir um Pipeline de Assistente de Voz  A Capstone da Fase 6

> Tudo das lições 01-11, coçadas juntas. Construir um assistente de voz que ouça, razona e fala. Em 2026 isso é um problema de engenharia resolvido, não um problema de pesquisa  mas os detalhes de integração decidem se ele vai enviar.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04, 05, 06, 07, 11; Phase 11 · 09 (Function Calling); Phase 14 · 01 (Agent Loop)
**Time:** ~120 minutes

## O problema

Construa um assistente de ponta a ponta:

1. Captura entrada de microfone (16 kHz mono).
2. Detecta o início/final da fala do utilizador.
3. Transcreve o streaming.
4. Passa a transcrição para um LLM que pode chamar ferramentas (timer, tempo, calendário).
5. Transmitir texto de LLM para um TTS.
6. Reproduza áudio para o usuário.
7. Parará se o utilizador interromper a resposta média.

Meta de latência: primeiro byte de áudio TTS dentro de 800 ms do usuário terminando sua declaração em uma CPU de computador portátil. Meta de qualidade: nenhuma palavra perdida, nenhum subtítulo alucinado no silêncio, nenhum vazamento de clonagem de voz, nenhum sucesso de injeção rápida.

## O conceito

![Voice assistant pipeline: mic → VAD → STT → LLM+tools → TTS → speaker](../assets/voice-assistant.svg)

### Os sete componentes

1. **Audio capture.**Mic → 16 kHz mono → 20 ms. Geralmente `sounddevice`em Python ou em AudioUnit/ALSA/WASAPI nativo em produção.
2. **VAD (Lesson 11).**Silero VAD @ limiar 0,5, min fala 250 ms, silêncio pendurado 500 ms. Sinais "começo" e "fim".
3. **Streaming STT (Lesson 4-5).**Whisper-streaming, Parakeet-TDT, ou Deepgram Nova-3 (API). Transcrições parciais + finais.
4. **LLM with tool calling.**GPT-4o / Claude 3.5 / Gemini 2.5 Flash. JSON esquema para ferramentas. Tokens de streaming.
5. **Streaming TTS (Lesson 7).**Kokoro-82M (aberto mais rápido) ou Cartesia Sonic (comercial).
6. **Playback.**- O que é isso? - O que é isso?
7. **Interruption handler.**Se o VAD disparar durante a reprodução do TTS, parar a reprodução, cancelar o LLM, reiniciar o STT.

### Os três modos de falha que você vai acertar

1. **First-word clip.**O VAD começa a bater tarde demais, o "hei" do usuário está faltando.
2. **Mid-response interrupt confusion.**LLM continua a gerar após interrupções do usuário; assistente conversa sobre o usuário.
3. **Silence hallucination.**O sussurro diz "Obrigado por assistir" nos quadros silenciosos.

### 2026 Estacas de referência de produção

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

## Construí-lo

### Passo 1: captura de microfone com fragmentação (pseudocód)

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

### Passo 2: Captura de viradas com porta VAD

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

### Passo 3: streaming STT → LLM → TTS

```python
async def turn(audio_bytes):
    transcript = await stt.transcribe(audio_bytes)
    async for token in llm.stream(transcript):
        async for audio in tts.stream(token):
            await speaker.play(audio)
```

### Passo 4: chamada de ferramenta dentro do ciclo de LLM

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

### Passo 5: Manutenção de interrupção

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

## Usá-lo

Veja .`code/main.py`Para uma simulação executável que conecta todos os sete componentes com modelos de estúdio, para que você possa ver a forma do pipeline mesmo sem hardware.

- `silero-vad`(`pip install silero-vad`)
- `deepgram-sdk`ou `openai-whisper`
- `openai`(`gpt-4o`) ou `anthropic`
- `kokoro`ou `cartesia`
- `sounddevice`para I/O

## Encurralagens

- **Logging PII forever.**O áudio de rotação completa é PII na maioria das jurisdições. 30 dias de retenção, criptografado em repouso.
- **No barge-in.**Os usuários interromperão, o seu assistente deve parar de falar.
- **TTS that blocks.**TTS sincrônico bloqueia o ciclo de eventos. Use async ou um fio separado.
- **No tool-call error handling.**As ferramentas falham. LLM deve recuperar o erro + tentar novamente uma vez, e depois graciosamente degradar.
- **Overzealous hallucination filters.**O assistente repete "Não posso ajudar com isso". O subfiltro diz qualquer coisa.
- **No wake-word option.**Sempre ouvir é uma responsabilidade de privacidade. Adicione um portal de despertar (Porcupine ou openWakeWord).

## Envia-o

Salva como`outputs/skill-voice-assistant-architect.md`. Tendo em conta as limitações orçamentais + de escala + de língua + de conformidade, produzir uma especificação completa da pilha.

## Exercícios

1. **Easy.**Corra .`code/main.py`Simula uma rotação completa de ponta a ponta com módulos de estúdio e impressões por estágio de latência.
2. **Medium.**Substitua o estúdio STT por um modelo real de Whisper num pré-registado `.wav`- Meter o WER e a latência de ponta a ponta.
3. **Hard.**Adicionar chamada de ferramenta: implementar `get_weather`(qualquer API) e `set_timer`. Enviar o Mestrado em Direito através das ferramentas e verificar que quando o utilizador diz "configurar um temporizador de 5 minutos", a função correta dispara e a resposta falada confirma isso.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Turn | A user + assistant round-trip | One VAD-bounded user speech + one LLM-TTS response. |
| Barge-in | Interruption | User speaks while assistant talks; assistant stops. |
| Wake word | "Hey assistant" | Short keyword detector; Porcupine, Snowboy, openWakeWord. |
| End-pointing | Turn ending | VAD + min-silence decision that user has finished. |
| Pre-roll | Pre-speech buffer | Keep 200-400 ms of audio before VAD fires to avoid first-word clip. |
| Tool call | Function invocation | LLM emits JSON; runtime dispatches; result feeds back in-loop. |

## Mais leitura

- [LiveKit — voice agent quickstart](https://docs.livekit.io/agents/)Referência de nível de produção.
- [Pipecat — voice agent examples](https://github.com/pipecat-ai/pipecat) Framework amigável para o DIY.
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) o caminho de voz nativa gerenciado.
- [Kyutai Moshi](https://github.com/kyutai-labs/moshi) Referência duplex completa (Lessão 15).
- [Porcupine wake-word](https://picovoice.ai/products/porcupine/)- O gating de palavras de despertar.
- [Anthropic — tool use guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) Chamando a função de LLM.
