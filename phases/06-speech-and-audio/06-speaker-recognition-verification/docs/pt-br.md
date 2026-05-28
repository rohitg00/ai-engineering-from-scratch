# Reconhecimento e Verificação de Falante

> ASR pergunta "o que eles disseram?" Reconhecimento de falante pergunta "quem disse?" A matemática parece a mesma — embeddings + cosseno — mas toda decisão de produção gira em torno de um único número EER.

**Tipo:** Construir
**Idiomas:** Python
**Pré-requisitos:** Fase 6 · 02 (Eespecificaçãotrogramas e Mel), Fase 5 · 22 (Modelos de Embedding)
**Tempo:** ~45 minutos

## O Problema

Um usuário diz uma senha. Você quer saber: é essa pessoa que se diz ser (*verificação*, 1:1), ou é a primeira pessoa no seu banco de cadastro (*identificação*, 1:N)? Ou nenhuma — é um falante desconhecido (*open-set*)?

Antes de 2018: GMM-UBM + i-vectors. EER razoável mas frágil a shift de canal (celular vs laptop) e emoção. 2018–2022: x-vectors (backbone TDNN treinado com margem angular). 2022+: embeddings ECAPA-TDNN e WavLM-large. Em 2026 o campo é dominado por três modelos e uma métrica.

A métrica é **EER** — Equal Error Rate. Ajuste seu limiar de decisão para que False Accept Rate = False Reject Rate. A intersecção é EER. Usado em todo paper, todo leaderboard, toda licitação.

## O Conceito

![Pipeline de cadastro + verificação com embedding + cosseno + EER](../assets/speaker-verification.svg)

**A pipeline.** Cadastro: grave 5–30 segundos do falante-alvo; compute um embedding de dimensão fixa (192-d para ECAPA-TDNN, 256-d para WavLM-large). Verificação: obtenha o embedding da utterance de teste; compute similaridade cosseno; compare com um limiar.

**ECAPA-TDNN (2020, ainda dominante em 2026).** Emphasized Channel Attention, Propagation and Aggregation - Time-Delay Neural Network. Blocos conv 1D com squeeze-excitation, pooling de multi-head attention, seguido de camada linear para 192-d. Treinado no VoxCeleb 1+2 (2.700 falantes, 1,1M utterances) com perda Additive Angular Margin (AAM-softmax).

**WavLM-SV (2022+).** Ajuste fino de um backbone WavLM-large SSL pré-treinado com perda AAM. Maior qualidade mas mais lento — 300+ MB vs 15 MB.

**x-vector (baseline).** TDNN + pooling estatístico. Clássico; ainda útil em CPU / edge.

**AAM-softmax.** Softmax padrão com margem adicionada `m` no espaço angular: `cos(θ + m)` para a classe correta. Força separação angular inter-classes. Típico `m=0,2`, escala `s=30`.

### Pontuação

- **Cosseno** entre embeddings de cadastro e teste. Decisão baseada em limiar.
- **PLDA (Probabilistic LDA).** Projeta embeddings em um espaço latente onde mesmo-falante vs falante-diferente tem uma razão de verossimilhança de forma fechada. Adicionado sobre cosseno para redução de +10–20% EER. Padrão pré-2020; hoje usado apenas em setups closed-set.
- **Normalização de escore.** `S-norm` ou `AS-norm`: normaliza cada escore contra uma coorte de médias e desvios de impostores. Essencial para avaliação cross-domain.

### Números que você deve saber (2026)

| Modelo | VoxCeleb1-O EER | Params | Throughput (A100) |
|--------|-----------------|--------|-------------------|
| x-vector (clássico) | 3,10% | 5 M | 400× RT |
| ECAPA-TDNN | 0,87% | 15 M | 200× RT |
| WavLM-SV large | 0,42% | 316 M | 20× RT |
| Pyannote 3.1 segmentação + embedding | 0,65% | 6 M | 100× RT |
| ReDimNet (2024) | 0,39% | 24 M | 100× RT |

### Diarização

"Quem falou quando" em um clipe multi-falante. Pipeline: VAD → segmentar → embutir cada segmento → agrupar (aglomerativo ou eespecificaçãotral) → suavizar bordas. Pilha moderna: `pyannote.audio` 3.1, que embute segmentação de falante + embedding + clustering atrás de uma chamada. SOTA DER em AMI em 2026 é ~15% (contra 23% em 2022).

## Construa

### Passo 1: embedding toy de estatísticas MFCC

```python
def embed_mfcc_stats(signal, sr):
    frames = featurize_mfcc(signal, sr, n_mfcc=13)
    mean = [sum(f[i] for f in frames) / len(frames) for i in range(13)]
    std = [
        math.sqrt(sum((f[i] - mean[i]) ** 2 for f in frames) / len(frames))
        for i in range(13)
    ]
    return mean + std  # 26-d
```

Nem de perto SOTA — apenas para ensino. `code/main.py` usa isso como prova de conceito em dados sintéticos de falante.

### Passo 2: similaridade cosseno + limiar

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0

def verify(enroll, test, threshold=0.75):
    return cosine(enroll, test) >= threshold
```

### Passo 3: EER a partir de pares de similaridade

```python
def eer(same_scores, diff_scores):
    thresholds = sorted(set(same_scores + diff_scores))
    best = (1.0, 1.0, 0.0)
    for t in thresholds:
        fr = sum(1 for s in same_scores if s < t) / len(same_scores)
        fa = sum(1 for s in diff_scores if s >= t) / len(diff_scores)
        if abs(fa - fr) < abs(best[0] - best[1]):
            best = (fa, fr, t)
    return (best[0] + best[1]) / 2, best[2]
```

Retorna (eer, threshold_at_eer). Reporte os dois.

### Passo 4: produção com SpeechBrain

```python
from speechbrain.pretrained import EncoderClassifier

clf = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")

enroll = torch.stack([clf.encode_batch(load(x)) for x in enrollment_clips]).mean(0)
score = clf.similarity(enroll, clf.encode_batch(load("test.wav"))).item()
verdict = score > 0.25
```

### Passo 5: diarize com pyannote

```python
from pyannote.audio import Pipeline

pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
diarization = pipe("meeting.wav", num_speakers=None)
for turn, _, speaker in diarization.itertracks(yield_label=True):
    print(f"{turn.start:.1f}–{turn.end:.1f}  {speaker}")
```

## Use

A pilha de 2026:

| Situação | Escolha |
|----------|---------|
| Verificação 1:1 closed-set, edge | ECAPA-TDNN + limiar de cosseno |
| Verificação open-set, cloud | WavLM-SV + AS-norm |
| Diarização (reuniões, podcasts) | `pyannote/speaker-diarization-3.1` |
| Anti-spoofing (replay / detecção de deepfake) | AASIST ou RawNet2 |
| Embutido minúsculo (KWS + cadastro) | Titanet-Small (NeMo) |

## Armadilhas

- **Incompatibilidade de canal.** Modelo treinado em VoxCeleb (vídeo web) ≠ áudio de chamada. Sempre avalie no canal alvo.
- **Utterances curtas.** EER degrada severamente abaixo de 3 segundos de áudio de teste.
- **Cadastro com ruído.** Um cadastro ruidoso contamina a âncora. Use ≥3 amostras limpas e faça média.
- **Limiar fixo entre condições.** Sempre ajuste o limiar em um conjunto de validação do domínio alvo.
- **Cosseno em embeddings não-normalizados.** Normalize L2 primeiro; caso contrário a magnitude domina.

## Entregue

Salve como `outputs/skill-speaker-verifier.md`. Escolha modelo, protocolo de cadastro, plano de ajuste de limiar e salvaguardas contra fraude.

## Exercícios

1. **Fácil.** Execute `code/main.py`. Constrói "falantes" sintéticos (perfis de tom diferentes), cadastra, computa EER em uma lista de 100 pares de teste.
2. **Médio.** Use SpeechBrain ECAPA em 30 utterances do VoxCeleb1 (5 falantes × 6 cada). Compute EER com cosseno vs PLDA.
3. **Difícil.** Construa a pipeline completa cadastrar → diarizar → verificar com `pyannote.audio`. Avalie DER no conjunto de validação AMI.

## Termos Chave

| Termo | O que a gente diz | O que significa de verdade |
|-------|-------------------|---------------------------|
| EER | Métrica principal | Limiar onde False Accept = False Reject. |
| Verificação | 1:1 | "É a Alice?" |
| Identificação | 1:N | "Quem está falando?" |
| Open-set | Possível desconhecido | Conjunto de teste pode conter falantes não-cadastrados. |
| Cadastro | Registrando | Computando embedding de referência do falante. |
| AAM-softmax | A perda | Softmax com margem angular aditiva; força separação de clusters. |
| PLDA | Pontuação clássica | LDA probabilístico; pontuação por razão de verossimilhança sobre embeddings. |
| DER | Métrica de diarização | Diarization Error Rate — erro + falso alarme + confusão. |

## Leitura Adicional

- [Snyder et al. (2018). X-Vectors: Robust DNN Embeddings for Speaker Recognition](https://www.danielpovey.com/files/2018_icassp_xvectors.pdf) — o paper clássico de deep embedding.
- [Desplanques et al. (2020). ECAPA-TDNN](https://arxiv.org/abs/2005.07143) — arquitetura dominante 2020–2026.
- [Chen et al. (2022). WavLM: Large-Scale Self-Supervised Pre-Training for Full Stack Speech Processing](https://arxiv.org/abs/2110.13900) — backbone SSL para SV e diarização.
- [Bredin et al. (2023). pyannote.audio 3.1](https://github.com/pyannote/pyannote-audio) — pilha de diarização + embedding em produção.
- [VoxCel