# Construindo uma Pipeline de Assistente de Voz — O Capstone da Fase 6

> Tudo das lições 01-11, costurado junto. Construa um assistente de voz que ouve, raciocina e fala de volta. Em 2026 isso é um problema de engenharia resolvido, não de pesquisa — mas os detalhes de integração decidem se faz deploy.

**Tipo:** Construir
**Idiomas:** Python
**Pré-requisitos:** Fase 6 · 04, 05, 06, 07, 11; Fase 11 · 09 (Chamada de Função); Fase 14 · 01 (Agent Loop)
**Tempo:** ~120 minutos

## O Problema

Construa um assistente de ponta a ponta que:

1. Captura entrada do microfone (16 kHz mono).
2. Detecta início/fim da fala do usuário.
3. Transcreve em streaming.
4. Passa a transcrição para um LLM que pode chamar ferramentas (timer, clima, calendário).
5. Transmite texto do LLM para um TTS.
6. Toca áudio de volta para o usuário.
7. Para se o usuário interromper no meio da resposta.

Alvo de latência: primeiro byte de TTS dentro de 800 ms do usuário terminar sua utterance em CPU de laptop. Alvo de qualidade: sem palavras perdidas, sem legendas alucinadas em silêncio, sem vazamento de clonagem de voz, sem sucesso de prompt injection.

## O Conceito

![Pipeline de assistente de voz: microfone → VAD → STT → LLM+ferramentas → TTS → alto-falante](../assets/voice-assistant.svg)

### Os sete componentes

1. **Captura de áudio.** Microfone → 16 kHz mono → chunks de 20 ms. Geralmente `sounddevice` em Python ou AudioUnit/ALSA/WASAPI nativo em produção.
2. **VAD (Lição 11).** Silero VAD @ threshold 0,5, fala mínima 250 ms, hang-over de silêncio 500 ms. Sinaliza "início" e "fim."
3. **STT streaming (Lição 4-5).** Whisper-streaming, Parakeet-TDT, ou Deepgram Nova-3 (API). Transcrições parciais + finais.
4. **LLM com chamada de ferramenta.** GPT-4o / Claude 3.5 / Gemini 2.5 Flash. JSON schema para ferramentas. Stream de tokens.
5. **TTS streaming (Lição 7).** Kokoro-82M (open mais rápido) ou Cartesia Sonic (comercial). Inicie TTS após 20 tokens do LLM.
6. **Playback.** Alto-falante saída; encode opus para redes de baixa largura de banda.
7. **Handler de interrupção.** Se VAD dispara durante playback do TTS, pare playback, cancele LLM, reinicie STT.

### Os três modos de falha que você vai encontrar

1. **Clip da primeira palavra.** VAD começa um batimento tarde demais. O "ei" do usuário some. Threshold de início em 0,3, não 0,5.
2. **Confusão de interrupção no meio da resposta.** LLM continua gerando após o usuário interromper; assistente fala sobre o usuário. Conecte VAD → cancelar-LLM.
3. **Alucinação de silêncio.** Whisper produz "Thanks for watching" nos frames de aquecimento silenciosos. Sempre use VAD como gate.

### Pilhas de referência de produção 2026

| Pilha | Latência | Licença | Notas |
|-------|----------|---------|-------|
| LiveKit + Deepgram + GPT-4o + Cartesia | 350-500 ms | API comercial | Padrão da indústria 2026 |
| Pipecat + Whisper-streaming + GPT-4o + Kokoro | 500-800 ms | majoritariamente open | Amigável ao DIY |
| Moshi (full-duplex) | 200-300 ms | CC-BY 4.0 | Modelo único; arquitetura diferente, lição 15 |
| Vapi / Retell (gerenciado) | 300-500 ms | comercial | Mais rápido para lançar; customização limitada |
| Whisper.cpp + llama.cpp + Kokoro-ONNX | offline | open | Privacidade / edge |

## Construa

### Passo 1: captura de microfone com chunking (pseudocódigo)

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

### Passo 2: captura de turno com gate VAD

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

### Passo 3: STT streaming → LLM → TTS

```python
async def turn(audio_bytes):
    transcript = await stt.transcribe(audio_bytes)
    async for token in llm.stream(transcript):
        async for audio in tts.stream(token):
            await speaker.play(audio)
```

### Passo 4: chamada de ferramenta dentro do loop do LLM

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

### Passo 5: tratamento de interrupção

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

## Use

Veja `code/main.py` para uma simulação funcional que conecta os sete componentes com modelos fictícios, para que você veja o formato da pipeline mesmo sem hardware. Para implementação real, substitua os stubs por:

- `silero-vad` (`pip install silero-vad`)
- `deepgram-sdk` ou `openai-whisper`
- `openai` (`gpt-4o`) ou `anthropic`
- `kokoro` ou `cartesia`
- `sounddevice` para I/O

## Armadilhas

- **Logging de PII para sempre.** Áudio de turno completo é PII na maioria das jurisdições. Retenção de 30 dias, criptografado em repouso.
- **Sem barge-in.** Usuários vão interromper. Seu assistente precisa parar de falar.
- **TTS bloqueante.** TTS síncrono bloqueia o event loop. Use async ou uma thread separada.
- **Sem tratamento de erro em tool-call.** Ferramentas falham. LLM precisa receber o erro + tentar uma vez, depois degradar graciosamente.
- **Filtros de alucinação excessivos.** Filtra demais e o assistente repete "Não posso ajudar com isso." Filtra de menos e fala qualquer coisa. Calibre em um conjunto de validação.
- **Sem opção de wake-word.** Sempre-escutando é uma vulnerabilidade de privacidade. Adicione um gate de wake-word (Porcupine ou openWakeWord).

## Entregue

Salve como `outputs/skill-voice-assistant-architect.md`. Dado orçamento + escala + idioma + restrições de conformidade, produza uma eespecificaçãoificação completa de pilha.

## Exercícios

1. **Fácil.** Execute `code/main.py`. Simula um turno completo de ponta a ponta com módulos stub e imprime latência por estágio.
2. **Médio.** Substitua o stub STT por um modelo Whisper real em um `.wav` pré-gravado. Meça WER e latência de ponta a ponta.
3. **Difícil.** Adicione chamada de ferramenta: implemente `get_weather` (qualquer API) e `set_timer`. Roteie o LLM pelas ferramentas e verifique que quando o usuário diz "defina um timer de 5 minutos" a função correta dispara e a resposta falada confirma.

## Termos Chave

| Termo | O que a gente diz | O que significa de verdade |
|-------|-------------------|---------------------------|
| Turn | Rodada usuário + assistente | Uma fala delimitada por VAD + uma resposta LLM-TTS. |
| Barge-in | Interrupção | Usuário fala enquanto assistente fala; assistente para. |
| Wake word | "Ei assistente" | Detector de palavra-chave curta; Porcupine, Snowboy, openWakeWord. |
| End-pointing | Fim de turno | Decisão VAD + silêncio-mínimo de que o usuário terminou. |
| Pre-roll | Buffer pré-fala | Manter 200-400 ms de áudio antes do VAD disparar para evitar clip da primeira palavra. |
| Tool call | Invocação de função | LLM emite JSON; runtime despacha; resultado alimenta o loop de volta. |

## Leitura Adicional

- [LiveKit — voice agente quickstart](https://docs.livekit.io/agents/) — referência de produção.
- [Pipecat — voice agente examples](https://github.com/pipecat-ai/pipecat) — framework amigável ao DIY.
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) — caminho gerenciado nativo de voz.
- [Kyutai Moshi](https://github.com/kyutai-labs/moshi) — referência full-duplex (Lição 15).
- [Porcupine wake-word](https://picovoice.ai/products/porcupine/) — gate de wake-word.
- [Anthropic — ferramenta use guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) — chamada de função LLM.
