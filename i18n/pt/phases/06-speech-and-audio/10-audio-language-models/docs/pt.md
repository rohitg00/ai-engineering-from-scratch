# Modelos de áudio-língua  Qwen2.5-Omni, Áudio Flamingo, GPT-4o Áudio

> 2026 modelos de áudio-língua raciocinam sobre fala + som ambiental + música. Qwen2.5-Omni-7B combina GPT-4o Audio no MMAU-Pro. Audio Flamingo Next bate Gemini 2.5 Pro no LongAudioBench. A diferença entre aberta e fechada é essencialmente fechada  exceto em tarefas de áudio múltipla, onde todos são quase aleatórios.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04 (ASR), Phase 12 · 03 (Vision-Language Models), Phase 7 · 10 (Audio Transformers)
**Time:** ~45 minutes

## O problema

Você tem 5 segundos de áudio: ladrões de cães, alguém grita "para!", depois silêncio.

- **Transcription.**"O que foi dito?"  Território da ASR.
- **Semantic reasoning.**"A pessoa está em perigo?"  requer compreensão conjunta do ladrão + grito + silêncio.
- **Music reasoning.**"Que instrumentos tocam a melodia?"
- **Long-audio retrieval.**"Em que lugar nesta palestra de 90 minutos o instrutor explicou a descida de gradientes?"

Um único modelo que responde a todos estes com um único pedido é um **audio-language model**(LALM / ALM). Separado da ASR pura: LALM produz respostas em forma livre em língua natural, não apenas transcrições.

## O conceito

![Audio-language model: audio encoder + projector + LLM decoder](../assets/alm-architecture.svg)

### O modelo de três componentes

Cada 2026 LALM tem o mesmo esqueleto:

1. **Audio encoder.**Encoder de sussurros · BEATs · CLAP · WavLM · ou um encoder personalizado por modelo.
2. **Projector.**O áudio-encoder de ponte linear ou MLP funciona no espaço de incorporação de tokens do LLM.
3. **LLM.**Llama / Qwen / Gemma baseado em decodificador. Toma texto entrelaçado + tokens de áudio; gera texto.

Formação:

- **Stage 1.**Encoder de congelação + LLM; projétor de trem apenas em dados de ASR / legendas.
- **Stage 2.**A sintonia completa / LoRA para as tarefas de áudio que seguem instruções (QA, raciocínio, compreensão musical).
- **Stage 3 (optional).**A voz-in / voz-out adiciona um decodificador de voz. Qwen2.5-Omni e AF3-Chat fazem isso.

### Mapa modelo de 2026

| Model | Backbone | Audio encoder | Output modality | Access |
|-------|----------|---------------|-----------------|--------|
| Qwen2.5-Omni-7B | Qwen2.5-7B | Custom + Whisper | text + speech | Apache-2.0 |
| Qwen3-Omni | Qwen3 | Custom | text + speech | Apache-2.0 |
| Audio Flamingo 3 | Qwen2 | AF-CLAP | text | NVIDIA non-commercial |
| Audio Flamingo Next | Qwen2 | AF-CLAP v2 | text | NVIDIA non-commercial |
| SALMONN | Vicuna | Whisper + BEATs | text | Apache-2.0 |
| LTU / LTU-AS | Llama | CAV-MAE | text | Apache-2.0 |
| GAMA | Llama | AST + Q-Former | text | Apache-2.0 |
| Gemini 2.5 Flash/Pro (closed) | Gemini | proprietary | text + speech | API |
| GPT-4o Audio (closed) | GPT-4o | proprietary | text + speech | API |

### Verificação de realidade de referência (2026)

**MMAU-Pro.**1800 pares de QA que cobrem fala / som / música / mixado.

| Model | Overall | Speech | Sound | Music | Multi-audio |
|-------|---------|--------|-------|-------|-------------|
| Gemini 2.5 Pro | ~60% | 73.4% | 51.9% | 64.9% | ~22% |
| Gemini 2.5 Flash | ~57% | 73.4% | 50.5% | 64.9% | 21.2% |
| GPT-4o Audio | 52.5% | — | — | — | 26.5% |
| Qwen2.5-Omni-7B | 52.2% | 57.4% | 47.6% | 61.5% | ~20% |
| Audio Flamingo 3 | ~54% | — | — | — | — |
| Audio Flamingo Next | SOTA on LongAudioBench | — | — | — | — |

O **multi-audio column is damning for everyone.**A chance aleatória em 4 opções múltiplas = 25%; a maioria dos modelos pontua em torno disso.

### Onde os LALM são úteis em 2026

- **Compliance audit of call-center recordings.**"O agente mencionou a divulgação necessária?"
- **Accessibility.**Descreva eventos sonoros para usuários surdos (não apenas transcrição).
- **Content moderation.**Detectar linguagem violenta + tom ameaçador + contexto de fundo.
- **Podcast / meeting chaptering.**Resumo semântico, não apenas as viradas do orador.
- **Music catalog analysis.**"Encontre todas as faixas com uma mudança de chave da secção B".

### Quando não são (ainda) úteis

- Teoria da música de grãos finos (abaixo do nível de acordes).
- Raciocínio atribuído pelo orador em longas conversas (grados passados 10 minutos).
- Comparar com áudio múltipla (22-26% é apenas acima do aleatório).
- Raciocínio de streaming em tempo real (a maioria são inferências de lote offline).

```figure
v4-alm-tokens
```

## Construí-lo

### Passo 1: consulta Qwen2.5-Omni

```python
from transformers import AutoModelForCausalLM, AutoProcessor

processor = AutoProcessor.from_pretrained("Qwen/Qwen2.5-Omni-7B")
model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-Omni-7B", torch_dtype="auto")

audio, sr = load_wav("clip.wav", sr=16000)
messages = [{
    "role": "user",
    "content": [
        {"type": "audio", "audio": audio},
        {"type": "text", "text": "What sounds do you hear, and what's happening?"},
    ],
}]
inputs = processor.apply_chat_template(messages, tokenize=True, return_tensors="pt")
output = model.generate(**inputs, max_new_tokens=200)
print(processor.decode(output[0], skip_special_tokens=True))
```

### Passo 2: padrão do projetor

```python
import torch.nn as nn

class AudioProjector(nn.Module):
    def __init__(self, audio_dim=1280, llm_dim=4096):
        super().__init__()
        self.down = nn.Linear(audio_dim, llm_dim)
        self.act = nn.GELU()
        self.up = nn.Linear(llm_dim, llm_dim)

    def forward(self, audio_features):
        return self.up(self.act(self.down(audio_features)))
```

É isso. O projetor é geralmente de 1-3 camadas lineares. Treinar-o em pares ASR (audio → transcrição) é a tarefa de pretexto de estágio 1.

### Passo 3: análise comparativa MMAU / LongAudioBench

```python
from datasets import load_dataset
mmau = load_dataset("gamma-lab-umd/MMAU-Pro", split="test")
mcq = mmau.filter(lambda item: len(item["choices"] or []) > 1)

correct = 0
for item in mcq:
    answer = call_model(item["audio_path"], item["question"], item["choices"])
    if answer == item["answer"]:
        correct += 1
print(f"Accuracy: {correct / len(mcq):.3f}")
```

`audio_path`Pontos para os repo do conjunto de dados `data.zip`(cerca de 47 GB), então baixe e desligue antes de marcar. Este ciclo de correspondência exacta é um teste de sanidade, não o marcador de referência, por isso o seu número não é comparável aos resultados publicados do MMAU-Pro. O avaliador oficial corresponde às respostas de escolha múltipla incorporando semelhança (NV-Embed-v2), classifica respostas de prazo aberto com um juiz de LLM e verifica as respostas que seguem instruções com regras regex: escrever previsões para um `model_output`coluna e execução `evaluate_mmau_pro_comprehensive.py`do [MMAU-Pro repo](https://github.com/sonalkum/MMAUPro)- Reportai cada um .`category`Os números agregados escondem-se onde o modelo falha.

## Usá-lo

| Task | 2026 pick |
|------|-----------|
| Free-form audio QA (open) | Qwen2.5-Omni-7B |
| Best open on long audio | Audio Flamingo Next |
| Best closed | Gemini 2.5 Pro |
| Voice-in / voice-out agent | Qwen2.5-Omni or GPT-4o Audio |
| Music reasoning | Audio Flamingo 3 or 2 (music-specialized AF-CLAP) |
| Call-center audit | Gemini 2.5 Pro via API, with RAG over your policy docs |

## Encurralagens

- **Over-trust on multi-audio.**Se a sua tarefa precisa de "qual clip tem X", o desempenho aleatório é real.
- **Long-audio degradation.**Após 10 minutos, a atribuição de alto-falantes da maioria dos modelos se rompe.
- **Hallucinations on silence.**O mesmo problema do Whisper herdado pelos LALM que usam o codificador Whisper.
- **Benchmark cherry-picking.**Postes de blog de vendedores destacam categorias de melhor caso.

## Envia-o

Salva como`outputs/skill-alm-picker.md`. Selecione LALM + subconjunto de referência + modalidade de saída (texto vs fala) para uma determinada tarefa de compreensão de áudio.

## Exercícios

1. **Easy.**Corra .`code/main.py`para ver um padrão de projetor de brinquedo + roteamento LALM falso de (audio-embed, tokens de texto) → tokens de saída.
2. **Medium.**Ponha o Qwen2.5 Omni-7B em 100 pontos de fala do MMAU-Pro.
3. **Hard.**Construa uma linha de base de captura de áudio mínima: BEATs encoder + projétor de 2 camadas + congelado Llama-3.2-1B. Ajuste perfeitamente apenas o projétor em AudioCaps. Compare com SALMONN em Clotho-AQA.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| LALM | Audio ChatGPT | Audio encoder + projector + LLM decoder. |
| Projector | Adapter | Small MLP mapping audio features into LLM embedding space. |
| MMAU | The benchmark | 10k audio-QA pairs across speech, sound, music. |
| MMAU-Pro | Harder MMAU | 1800 multi-audio / reasoning-heavy questions. |
| LongAudioBench | Long-form eval | Multi-minute clips with semantic queries. |
| Voice-in / voice-out | Speech-native | Model ingests speech and emits speech without text detour. |

## Mais leitura

- [Chu et al. (2024). Qwen2-Audio](https://arxiv.org/abs/2407.10759)Arquitetura de referência.
- [Alibaba (2025). Qwen2.5-Omni](https://huggingface.co/Qwen/Qwen2.5-Omni-7B)- O discurso-em-discurso.
- [NVIDIA (2025). Audio Flamingo 3](https://arxiv.org/abs/2507.08128)O líder de áudio aberto.
- [NVIDIA (2026). Audio Flamingo Next](https://arxiv.org/abs/2604.10905) LongAudioBench SOTA.
- [Tang et al. (2023). SALMONN](https://arxiv.org/abs/2310.13289)Pioneiro de duplo codificador.
- [MMAU-Pro leaderboard](https://sonalkum.github.io/mmau-pro/) classificação ao vivo de 2026.
