# Suspirar  Arquitetura e ajuste fino

> Whisper é um transformer de 30 segundos de janela encoder-decoder, treinado em 680k horas de pares de áudio-texto multilíngue deficiente supervisionado.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04 (ASR), Phase 5 · 10 (Attention), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## O problema

O Whisper, lançado pela OpenAI em setembro de 2022, foi o primeiro modelo ASR a ser enviado como um produto: paste áudio, obter texto, 99 idiomas, robusto ao ruído, funciona em um laptop. Em 2024, a OpenAI havia enviado variantes Large-v3 e Turbo; em 2026, o Whisper é a linha de base padrão para tudo, desde transcrição de podcast a assistentes de voz a subtítulos do YouTube.

Mas o Whisper não é um pipeline que você pode tratar como uma caixa negra para sempre.

1. O que é que realmente está lá dentro.
2. Como dar corretamente áudio em pedaços, em streaming ou em formato longo.
3. Quando e como ajustar.

## O conceito

![Whisper encoder-decoder, tasks, chunked inference, fine-tune](../assets/whisper.svg)

**Architecture.**Transformador padrão encoder-decoder.

- Entrada: Espectroograma log-mel de 30 segundos, 80 mels, 10 ms hop → 3000 quadros.
- Encoder: conv-downsample (passo 2) + `N`Para grande V3: 32 camadas, 1280-dim, 20 cabeças.
- Descódigo: `N`Blocos de transformador com auto-atn + cross-attn para saída de codificador.
- Resultado: Tokens BPE sobre um vocabulário de 51.865 tokens.

O Large-v3 tem parâmetros de 1.55B. Turbo usa um decodificador de 4 camadas (a partir de 32), cortando a latência 8x com um hit WER < 1%.

**The prompt format.**Whisper é um modelo de multitarefa dirigido por tokens especiais no prompt do decodificador:

```
<|startoftranscript|><|en|><|transcribe|><|notimestamps|> Hello world.<|endoftext|>
```

- `<|en|>`O Whisper detecta a língua primeiro.
- `<|transcribe|>`ou `<|translate|>`: tag de tarefa; transcrever o discurso em sua língua de origem, ou traduzi-lo para o texto inglês.
- `<|notimestamps|>`: saltar as marcas de tempo de nível de palavra (mais rápido).

O prompt é o que permite que um modelo faça muitas tarefas.`<|en|>`- Não .`<|fr|>`E transcreve em francês.

**30-second window.**Tudo é fixado em 30 segundos. Clips mais longos precisam de troca; clips mais curtos são empolgados. Windows não são transmitidos nativamente  é por isso que existem WhisperX, Whisper-Streaming e faster-whisper.

**Log-mel normalization.** `(log_mel - mean) / std`O que é que é o que é o Whisper?`whisper.audio.log_mel_spectrogram`), não `librosa.feature.melspectrogram`- Não .

### Variantes em 2026

| Variant | Params | Latency (A100) | WER (LibriSpeech-clean) |
|---------|--------|----------------|------------------------|
| Tiny | 39M | 1× realtime | 5.4% |
| Base | 74M | 1× | 4.1% |
| Small | 244M | 1× | 3.0% |
| Medium | 769M | 1× | 2.7% |
| Large-v3 | 1.55B | 2× | 1.8% |
| Large-v3-turbo | 809M | 8× | 1.58% |
| Whisper-Streaming (2024) | 1.55B | streaming | 2.0% |

### Apontação fina

Fluxo de trabalho canônico em 2026:

1. Recolher 10100 horas de áudio do domínio alvo com transcrições alinhadas.
2. Corra .`transformers.Seq2SeqTrainer`com`generate_with_loss`- Voltar a ligar.
3. Eficiência do parâmetro: LoRA em `q_proj`- Não .`k_proj`- Não .`v_proj`de camadas de atenção reduz a memória da GPU 4× com custo de WER < 0,3.
4. Congelhe o codificador se tiver < 10 horas. Apenas sintonize o decodificador.
5. Use o próprio tokenizer e formato de prompt do Whisper; nunca troque de tokenizer.

Resultados comunitários: ajuste fino Medium em 20 horas de ditado médico reduz o WER de 12% para 4,5% no vocabulário médico.

```figure
sp-asr-attention
```

## Construí-lo

### Passo 1: executar Whisper fora da caixa

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe(
    "clip.wav",
    language="en",
    task="transcribe",
    temperature=0.0,
    condition_on_previous_text=False,  # prevents runaway repetition
)
print(result["text"])
for seg in result["segments"]:
    print(f"[{seg['start']:.2f}–{seg['end']:.2f}] {seg['text']}")
```

As principais falhas que deve sempre ser ignorada: `temperature=0.0`(exemplos de defeitos para 0,0 → 0,2 → 0,4 ... cadeia de retorno), `condition_on_previous_text=False`(preventa o problema da alucinação em cascata), e `no_speech_threshold=0.6`(Detecção do silêncio).

### Passo 2: forma longa em pedaços

```python
# whisperx is the 2026 reference for long-form with word-level timestamps
import whisperx
model = whisperx.load_model("large-v3-turbo", device="cuda", compute_type="float16")
segments = model.transcribe("1hour.mp3", batch_size=16, chunk_size=30)
```

O WhisperX adiciona (1) Silero VAD gating, (2) alinhamento de nível de palavras através de wav2vec 2.0, (3) diarização através de `pyannote.audio`O cavalo de trabalho de 2026 para transcrição de produção.

### Passo 3: sintonização com LoRA

```python
from transformers import WhisperForConditionalGeneration, WhisperProcessor
from peft import LoraConfig, get_peft_model

model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-large-v3-turbo")
lora = LoraConfig(
    r=16, lora_alpha=32, target_modules=["q_proj", "v_proj"],
    lora_dropout=0.1, bias="none", task_type="SEQ_2_SEQ_LM",
)
model = get_peft_model(model, lora)
# model.print_trainable_parameters()  -> ~3M trainable / 809M total
```

Depois, o ciclo padrão do treinador, um ponto de controlo a cada 1000 passos, e uma avaliação com WER.

### Passo 4: inspecionar o que cada camada aprende

```python
# Grab cross-attention weights during decode to see what the decoder attends to.
with torch.inference_mode():
    out = model.generate(
        input_features=features,
        return_dict_in_generate=True,
        output_attentions=True,
    )
# out.cross_attentions: layer × head × step × src_len
```

Visualize com um heatmap  você verá alinhamento diagonal como os passos do decodificador escanear através de quadros de codificador.

## Usá-lo

A pilha de 2026:

| Situation | Pick |
|-----------|------|
| General English, offline | Large-v3-turbo via `whisperx` |
| Mobile / edge | Whisper-Tiny quantized (int8) or Moonshine |
| Multilingual long-form | Large-v3 via `whisperx` + diarization |
| Low-resource language | Fine-tune Medium or Turbo with LoRA |
| Streaming (2 s latency) | Whisper-Streaming or Parakeet-TDT |
| Word-level timestamps | WhisperX (forced alignment via wav2vec 2.0) |

`faster-whisper`(CTranslate2 backend) é o tempo de execução de inferência CPU+GPU mais rápido em 2026  4x mais rápido do que a baunilha com saída idêntica.

## Encurralagens que ainda se lançam em 2026

- **Hallucinated text on silence.**O sussurro treinado em legendas inclui "Obrigado por assistir!", "Subscreva!", letras de canções.
- **`condition_on_previous_text` cascade.**Uma alucinação contamina as janelas subsequentes.`False`A menos que precise de fluência em pedaços.
- **Short-clip padding.**Um clip de 2 segundos com 30 segundos pode alucinar no silêncio.`pad=False`ou VAD-gate.
- **Wrong mel stats.**Usar os mels da librosa em vez do Whisper produz uma saída quase aleatória.`whisper.audio.log_mel_spectrogram`- Não .

## Envia-o

Salva como`outputs/skill-whisper-tuner.md`Desenhar um fluxo de sintonia ou inferência Whisper para um determinado domínio.

## Exercícios

1. **Easy.**Corra .`code/main.py`Ele tokeniza um pedido de estilo Whisper, calcula os orçamentos de forma decodificada e imprime o cronograma de pedaços para um clipe de 10 minutos.
2. **Medium.**Instalação`faster-whisper`, transcrever um podcast de 10 minutos, comparar WER com uma transcrição humana.`language="auto"`contra forçado`language="en"`- Não .
3. **Hard.**Usando HF `datasets`, escolher uma língua que o Whisper luta com (por exemplo, Urdu), sintonizar o Médio com o LoRA por 2 épocas em 2 horas, e relatar o delta WER.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| 30-sec window | Whisper's limit | Hard input cap; chunk longer audio. |
| SOT | Start-of-transcript | `<\|startoftranscript\|>` kicks off the decoder prompt. |
| Timestamps token | Temporal alignment | Every 0.02 s offset is a special token in the 51k vocab. |
| Turbo | The fast variant | 4-decoder layers, 8× faster, <1% WER regression. |
| WhisperX | The long-form wrapper | VAD + Whisper + wav2vec alignment + diarization. |
| LoRA fine-tune | Efficient tuning | Add low-rank adapters to attention; train ~0.3% of params. |
| Hallucination | The silent failure | Whisper produces fluent English from noise/silence. |

## Mais leitura

- [Radford et al. (2022). Whisper paper](https://arxiv.org/abs/2212.04356) a arquitetura original e a receita de formação.
- [OpenAI (2024). Whisper Large-v3-turbo release](https://github.com/openai/whisper/discussions/2363)- Decodificador de 4 camadas, aceleração 8x.
- [Bain et al. (2023). WhisperX](https://arxiv.org/abs/2303.00747)- Forma longa, alinhada com as palavras, diária.
- [Systran — faster-whisper repo](https://github.com/SYSTRAN/faster-whisper) CTranslate2-supportado, 4x mais rápido.
- [HuggingFace — Whisper fine-tune tutorial](https://huggingface.co/blog/fine-tune-whisper) LoRA canônico / caminhada completa de FT.
