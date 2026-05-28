# Modelos de Áudio-Linguagem — Qwen2.5-Omni, Audio Flamingo, GPT-4o Audio

> Modelos de áudio-linguagem de 2026 raciocinam sobre fala + som ambiental + música. Qwen2.5-Omni-7B combina com GPT-4o Audio no MMAU-Pro. Audio Flamingo Next supera Gemini 2.5 Pro no LongAudioBench. O gap entre open e closed essencialmente fechou — exceto em tarefas multi-áudio, onde todos estão perto do aleatório.

**Tipo:** Aprender
**Idiomas:** Python
**Pré-requisitos:** Fase 6 · 04 (ASR), Fase 12 · 03 (Modelos Visão-Linguagem), Fase 7 · 10 (Audio Transformers)
**Tempo:** ~45 minutos

## O Problema

Você tem 5 segundos de áudio: cachorro late, alguém grita "para!", depois silêncio. Perguntas úteis abrangem múltiplos eixos:

- **Transcrição.** "O que foi dito?" — território ASR.
- **Raciocínio semântico.** "A pessoa está em perigo?" — requer compreensão conjunta do latido + grito + silêncio.
- **Raciocínio musical.** "Quais instrumentos tocam a melodia?"
- **Recuperação de áudio longo.** "Onde nessa palestra de 90 minutos o instrutor explicou descida do gradiente?"

Um único modelo que responde tudo isso com um prompt é um **modelo de áudio-linguagem** (LALM / ALM). Diferente de ASR puro: LALMs produzem respostas em linguagem natural, não apenas transcrições.

## O Conceito

![Modelo de áudio-linguagem: encoder de áudio + projetor + decoder LLM](../assets/alm-architecture.svg)

### O template de três componentes

Todo LALM de 2026 tem o mesmo esqueleto:

1. **Encoder de áudio.** Encoder Whisper · BEATs · CLAP · WavLM · ou encoder custom por modelo.
2. **Projetor.** Linear ou MLP que conecta características do encoder de áudio ao espaço de embedding de tokens do LLM.
3. **LLM.** Decoder baseado em Llama / Qwen / Gemma. Recebe tokens intercalados de texto + áudio; gera texto.

Treino:

- **Estágio 1.** Congele encoder + LLM; treine apenas o projetor em dados de ASR/legendas.
- **Estágio 2.** Ajuste fino full / LoRA em tarefas de áudio que seguem instruções (QA, raciocínio, compreensão musical).
- **Estágio 3 (opcional).** Voz-entrada / voz-saída adiciona um decoder de fala. Qwen2.5-Omni e AF3-Chat fazem isso.

### O mapa de modelos de 2026

| Modelo | Backbone | Encoder de áudio | Modalidade de saída | Acesso |
|--------|----------|-----------------|---------------------|--------|
| Qwen2.5-Omni-7B | Qwen2.5-7B | Custom + Whisper | texto + fala | Apache-2.0 |
| Qwen3-Omni | Qwen3 | Custom | texto + fala | Apache-2.0 |
| Audio Flamingo 3 | Qwen2 | AF-CLAP | texto | NVIDIA não-comercial |
| Audio Flamingo Next | Qwen2 | AF-CLAP v2 | texto | NVIDIA não-comercial |
| SALMONN | Vicuna | Whisper + BEATs | texto | Apache-2.0 |
| LTU / LTU-AS | Llama | CAV-MAE | texto | Apache-2.0 |
| GAMA | Llama | AST + Q-Former | texto | Apache-2.0 |
| Gemini 2.5 Flash/Pro (fechado) | Gemini | proprietário | texto + fala | API |
| GPT-4o Audio (fechado) | GPT-4o | proprietário | texto + fala | API |

### Reality check de benchmarks (2026)

**MMAU-Pro.** 1800 pares de QA cobrindo fala / som / música / misto. Subset multi-áudio incluído.

| Modelo | Geral | Fala | Som | Música | Multi-áudio |
|--------|-------|------|-----|--------|-------------|
| Gemini 2.5 Pro | ~60% | 73,4% | 51,9% | 64,9% | ~22% |
| Gemini 2.5 Flash | ~57% | 73,4% | 50,5% | 64,9% | 21,2% |
| GPT-4o Audio | 52,5% | — | — | — | 26,5% |
| Qwen2.5-Omni-7B | 52,2% | 57,4% | 47,6% | 61,5% | ~20% |
| Audio Flamingo 3 | ~54% | — | — | — | — |
| Audio Flamingo Next | SOTA no LongAudioBench | — | — | — | — |

A **coluna multi-áudio é condenatória para todos.** Chance aleatória em múltipla escolha de 4 opções = 25%; a maioria dos modelos pontua por aí. LALMs ainda lutam para comparar dois clips.

### Onde LALMs são úteis em 2026

- **Auditoria de conformidade de gravações de call-center.** "O agente mencionou a divulgação obrigatória?"
- **Acessibilidade.** Descrever eventos sonoros para usuários surdos (não apenas transcrição).
- **Moderação de conteúdo.** Detectar linguagem violenta + tom ameaçador + contexto de fundo.
- **Capítulos de podcast/reunião.** Resumo semântico, não apenas turnos de fala.
- **Análise de catálogo musical.** "Encontre todas as faixas com mudança de tonalidade na seção B."

### Onde NÃO são (ainda) úteis

- Teoria musical refinada (abaixo do nível de acorde).
- Raciocínio atribuído a falante sobre conversas longas (degrada passa de 10 minutos).
- Comparação multi-áudio (22-26% é quase aleatório).
- Raciocínio streaming em tempo real (a maioria é inferência batch offline).

## Construa

### Passo 1: consulte o Qwen2.5-Omni

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
print(processor.decode(output[0], skip_especificaçãoial_tokens=True))
```

### Passo 2: o padrão do projetor

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

É isso. O projetor geralmente tem 1-3 camadas lineares. Treiná-lo em pares ASR (áudio → transcrição) é a tarefa pretext do Estágio 1.

### Passo 3: benchmarking MMAU / LongAudioBench

```python
from datasets import load_dataset
mmau = load_dataset("MMAU/MMAU-Pro")

correct = 0
for item in mmau["test"]:
    answer = call_model(item["audio"], item["question"], item["choices"])
    if answer == item["correct_choice"]:
        correct += 1
print(f"Accuracy: {correct / len(mmau['test']):.3f}")
```

Reporte por categoria (fala / som / música / multi-áudio) separadamente. Números agregados escondem onde o modelo falha.

## Use

| Tarefa | Escolha de 2026 |
|--------|-----------------|
| QA de áudio livre (open) | Qwen2.5-Omni-7B |
| Melhor open em áudio longo | Audio Flamingo Next |
| Melhor closed | Gemini 2.5 Pro |
| Agente voz-entrada / voz-saída | Qwen2.5-Omni ou GPT-4o Audio |
| Raciocínio musical | Audio Flamingo 3 ou 2 (AF-CLAP eespecificaçãoializado em música) |
| Auditoria de call-center | Gemini 2.5 Pro via API, com RAG sobre seus docs de política |

## Armadilhas

- **Confiabilidade excessiva em multi-áudio.** Se sua tarefa precisa de "qual clip tem X", performance no nível de chance aleatória é real.
- **Degradação em áudio longo.** Passa de 10 minutos, a maioria dos modelos quebra a atribuição de falante. Diarize primeiro (Lição 6), depois resuma.
- **Alucinações em silêncio.** Mesmo problema do Whisper herdado por LALMs que usam encoder Whisper. Use VAD como gate.
- **Cherry-picking de benchmarks.** Posts de blogs de vendors destacam categorias de melhor caso. Rode o subset multi-áudio do MMAU-Pro você mesmo.

## Entregue

Salve como `outputs/skill-alm-picker.md`. Escolha LALM + subset de benchmark + modalidade de saída (texto vs fala) para uma tarefa de compreensão de áudio.

## Exercícios

1. **Fácil.** Execute `code/main.py` para ver um padrão projetor toy + roteamento falso de LALM de (embedding de áudio, tokens de texto) → tokens de saída.
2. **Médio.** Pontue o Qwen2.5-Omni-7B em 100 itens de fala do MMAU-Pro. Compare com o número reportado no paper.
3. **Difícil.** Construa um baseline mínimo de legendas de áudio: encoder BEATs + projetor de 2 camadas + Llama-3.2-1B congelado. Ajuste fino apenas o projetor no AudioCaps. Compare com SALMONN no Clotho-AQA.

## Termos Chave

| Termo | O que a gente diz | O que significa de verdade |
|-------|-------------------|---------------------------|
| LALM | ChatGPT de áudio | Encoder de áudio + projetor + decoder LLM. |
| Projetor | Adaptador | MLP pequeno que mapeia características de áudio para o espaço de embedding do LLM. |
| MMAU | O benchmark | 10k pares de áudio-QA em fala, som, música. |
| MMAU-Pro | MMAU mais difícil | 1800 questões multi-áudio / pesadas em raciocínio. |
| LongAudioBench | Avaliação de formato longo | Clips de vários minutos com consultas semânticas. |
| Voz-entrada / voz-saída | Nativo de fala | Modelo ingere fala e emite fala sem desvio por texto. |

## Leitura Adicional

- [Chu et al. (2024). Qwen2-Audio](https://arxiv.org/abs/2407.10759) — arquitetura de referência.
- [Alibaba (2025). Qwen2.5-Omni](https://huggingface.co/Qwen/Qwen2.5-Omni-7B) — fala-entrada-fala-saída.
- [NVIDIA (2025). Audio Flamingo 3](https://arxiv.org/abs/2507.08128) — o líder open de áudio longo.
- [NVIDIA (2026). Audio Flamingo Next](https://arxiv.org/abs/2604.10905) — SOTA no LongAudioBench.
- [Tang et al. (2023). SALMONN](https://arxiv.org/abs/2310.13289) — pioneiro de encoder duplo.
- [Leaderboard MMAU-Pro](https://mmaubenchmark.github.io/) — rankings ao vivo de 2026.
