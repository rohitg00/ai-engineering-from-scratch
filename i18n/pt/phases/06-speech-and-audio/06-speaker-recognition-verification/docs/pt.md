# Reconhecimento e verificação dos oradores

> A ASR pergunta "o que eles disseram?" O reconhecimento do orador pergunta "quem disse isso?" A matemática parece a mesma  embebimentos mais cosino  mas cada decisão de produção depende de um único número EER.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 22 (Embedding Models)
**Time:** ~45 minutes

## O problema

Um usuário diz uma senha. Você quer saber: é essa a pessoa que eles afirmam ser (*verificação*, 1:1), ou é a primeira pessoa no seu banco de inscrição (*identificação*, 1:N)?

Pre-2018: GMM-UBM + i-vectores. EER razoável, mas frágil para mudança de canal (telefone vs laptop) e emoção. 20182022: x-vectores (backbone TDNN treinado com margem angular). 2022+: ECAPA-TDNN e WavLM-embeddings grandes. Em 2026 o campo é dominado por três modelos e uma métrica.

A métrica é**EER** Taxa de erro igual. Defina o seu limite de decisão para que a taxa de aceitação falsa = taxa de rejeição falsa. O crossover é EER.

## O conceito

![Enrollment + verification pipeline with embedding + cosine + EER](../assets/speaker-verification.svg)

**The pipeline.**Inscrição: registar 530 segundos do alto-falante alvo; calcular uma incorporação de dimensão fixa (192-d para ECAPA-TDNN, 256-d para WavLM-large). Verificação: obter a incorporação da expressão do teste; calcular a semelhança cosínica; comparar com um limiar.

**ECAPA-TDNN (2020, still dominant 2026).**Emfatizada Atenção ao Canal, Propagação e Agregação - Rede Neural de Atraso no Tempo. Blocos de convos 1D com excitação de compressão, concentração de atenção em várias cabeças, seguido por uma camada linear de 192-d. Treinado em VoxCeleb 1+2 (2,700 alto-falantes, 1,1M pronunciamentos) com perda de margem angular aditiva (AAM-softmax).

**WavLM-SV (2022+).**Ajuste a espinha dorsal de SSL grande WavLM pré-entrenada com perda de AAM. Qualidade mais alta, mas mais lenta  300+ MB vs 15 MB.

**x-vector (baseline).**TDNN + compartilhamento de estatísticas. Clássico; ainda útil em CPU / borda.

**AAM-softmax.**Softmax padrão com margem adicionada `m`no espaço angular: `cos(θ + m)`Forças de separação angular inter-classe.`m=0.2`, escala `s=30`- Não .

### Ponto de pontuação

- **Cosine**A decisão baseada em limiares.
- **PLDA (Probabilistic LDA).**Embedings de projeto em um espaço latente onde o mesmo alto-falante vs. alto-falante diferente tem uma relação de probabilidade de forma fechada. Adicionado em cima do cosino para uma redução de +1020% de EER. padrão pré-2020; agora usado apenas em configurações fechadas.
- **Score normalization.** `S-norm`ou `AS-norm`A normalização de cada pontuação em relação a uma coorte de meios impostores e etc.

### Números que você deve saber (2026)

| Model | VoxCeleb1-O EER | Params | Throughput (A100) |
|-------|-----------------|--------|-------------------|
| x-vector (classic) | 3.10% | 5 M | 400× RT |
| ECAPA-TDNN | 0.87% | 15 M | 200× RT |
| WavLM-SV large | 0.42% | 316 M | 20× RT |
| Pyannote 3.1 segmentation + embedding | 0.65% | 6 M | 100× RT |
| ReDimNet (2024) | 0.39% | 24 M | 100× RT |

### Diarização

"Quem falou quando" em um clip de alto-falantes. Pipeline: VAD → segmento → embebed cada segmento → cluster (aglomerativo ou espectral) → limites suaves.`pyannote.audio`3.1, que agrupa a segmentação de alto-falantes + incorporação + agrupamento por trás de uma chamada.

```figure
sp-eer-crossover
```

## Construí-lo

### Passo 1: inserção de brinquedos a partir das estatísticas da MFCC

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

Não é só para ensinar.`code/main.py`utiliza isto como prova de conceito em dados de alto-falantes sintéticos.

### Passo 2: semelhança cosínica + limiar

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0

def verify(enroll, test, threshold=0.75):
    return cosine(enroll, test) >= threshold
```

### Passo 3: EER a partir de pares de semelhanças

```python
def eer(same_scores, diff_scores):
    thresholds = sorted(set(same_scores + diff_scores))
    best = (1.0, 1.0, 0.0)  # (fa, fr, threshold)
    for t in thresholds:
        fr = sum(1 for s in same_scores if s < t) / len(same_scores)
        fa = sum(1 for s in diff_scores if s >= t) / len(diff_scores)
        if abs(fa - fr) < abs(best[0] - best[1]):
            best = (fa, fr, t)
    return (best[0] + best[1]) / 2, best[2]
```

Retorno (eer, threshold_at_eer).

### Passo 4: produção com SpeechBrain

```python
from speechbrain.pretrained import EncoderClassifier

clf = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")

# enroll: average the embeddings of 3-5 clean samples
enroll = torch.stack([clf.encode_batch(load(x)) for x in enrollment_clips]).mean(0)
# verify
score = clf.similarity(enroll, clf.encode_batch(load("test.wav"))).item()
verdict = score > 0.25   # ECAPA typical threshold; tune on your data
```

### Passo 5: Diário com pyannote

```python
from pyannote.audio import Pipeline

pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
diarization = pipe("meeting.wav", num_speakers=None)
for turn, _, speaker in diarization.itertracks(yield_label=True):
    print(f"{turn.start:.1f}–{turn.end:.1f}  {speaker}")
```

## Usá-lo

A pilha de 2026:

| Situation | Pick |
|-----------|------|
| Closed-set 1:1 verification, edge | ECAPA-TDNN + cosine threshold |
| Open-set verification, cloud | WavLM-SV + AS-norm |
| Diarization (meetings, podcasts) | `pyannote/speaker-diarization-3.1` |
| Anti-spoofing (replay / deepfake detection) | AASIST or RawNet2 |
| Tiny embedded (KWS + enrollment) | Titanet-Small (NeMo) |

## Encurralagens

- **Channel mismatch.**Modelo treinado em VoxCeleb (vídeo web) ≠ áudio de chamada telefônica.
- **Short utterances.**O EER degrada-se acentuadamente abaixo dos 3 segundos de áudio do ensaio.
- **Enrollment with noise.**Uma inscrição barulhenta envenena a âncora.
- **Fixed threshold across conditions.**Sempre ajuste o limiar num conjunto de desenvolvimento de destino.
- **Cosine on non-normalized embeddings.**L2-normalizar primeiro; caso contrário, a magnitude domina.

## Envia-o

Salva como`outputs/skill-speaker-verifier.md`- Seleção de modelo, protocolo de inscrição, plano de ajuste de limiares e proteção contra fraude.

## Exercícios

1. **Easy.**Corra .`code/main.py`- Construir "alto-falantes" sintéticos (profis de tom diferentes), inscrever, calcular o EER numa lista de ensaio de 100 pares.
2. **Medium.**Use o SpeechBrain ECAPA em 30 pronunciamentos VoxCeleb1 (5 alto-falantes × 6 cada).
3. **Hard.**Construir o registro completo → diário → verificar pipeline com `pyannote.audio`Avaliação de DER no set de desenvolvimento de AMI.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| EER | The headline metric | Threshold where False Accept = False Reject. |
| Verification | 1:1 | "Is this Alice?" |
| Identification | 1:N | "Who is speaking?" |
| Open-set | Unknown possible | Test set can contain unenrolled speakers. |
| Enrollment | Registering | Computing a speaker's reference embedding. |
| AAM-softmax | The loss | Softmax with additive angular margin; forces cluster separation. |
| PLDA | Classic scoring | Probabilistic LDA; likelihood-ratio scoring on top of embeddings. |
| DER | Diarization metric | Diarization Error Rate — miss + false alarm + confusion. |

## Mais leitura

- [Snyder et al. (2018). X-Vectors: Robust DNN Embeddings for Speaker Recognition](https://www.danielpovey.com/files/2018_icassp_xvectors.pdf)O papel clássico de inserção profunda.
- [Desplanques et al. (2020). ECAPA-TDNN](https://arxiv.org/abs/2005.07143)Arquitetura dominante 20202026.
- [Chen et al. (2022). WavLM: Large-Scale Self-Supervised Pre-Training for Full Stack Speech Processing](https://arxiv.org/abs/2110.13900) Espécie vertebral SSL para SV e diarização.
- [Bredin et al. (2023). pyannote.audio 3.1](https://github.com/pyannote/pyannote-audio) Diarização da produção + estaca de incorporação.
- [VoxCeleb leaderboard (updated 2026)](https://www.robots.ox.ac.uk/~vgg/data/voxceleb/) classificações actuais das EER em todos os modelos.
