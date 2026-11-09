# Avaliação de áudio  WER, MOS, UTMOS, MMAU, FAD e as tablas de classificação abertas

> Esta lição nomeia as métricas 2026 para cada tarefa de áudio: ASR (WER, CER, RTFx), TTS (MOS, UTMOS, SECS, WER-on-ASR-round-trip), áudio-linguagem (MMAU, LongAudioBench), música (FAD, CLAP) e alto-falantes (EER).

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04, 06, 07, 09, 10; Phase 2 · 09 (Model Evaluation)
**Time:** ~60 minutes

## O problema

Cada tarefa de áudio tem múltiplas métricas, cada uma medindo um eixo diferente. Usando a métrica errada é como você envia um modelo que parece ótimo no seu painel de controle e terrível em produção.

| Task | Primary | Secondary |
|------|---------|-----------|
| ASR | WER | CER · RTFx · first-token latency |
| TTS | MOS / UTMOS | SECS · WER-on-ASR-round-trip · CER · TTFA |
| Voice cloning | SECS (ECAPA cosine) | MOS · CER |
| Speaker verification | EER | minDCF · FAR / FRR at operating point |
| Diarization | DER | JER · speaker confusion |
| Audio classification | top-1 · mAP | macro F1 · per-class recall |
| Music generation | FAD | CLAP · listening panel MOS |
| Audio language model | MMAU-Pro | LongAudioBench · AudioCaps FENSE |
| Streaming S2S | latency P50/P95 | WER · MOS |

## O conceito

![Audio evaluation matrix — metrics vs tasks vs 2026 leaderboards](../assets/eval-landscape.svg)

### Metricas de RAS

**WER (Word Error Rate).** `(S + D + I) / N`- Baixa letra, pontuação de strip, normalização de números antes de marcar.`jiwer`ou da OpenAI `whisper_normalizer`. &lt;5% = leitura de fala em paridade humana.

**CER (Character Error Rate).**A mesma fórmula, nível de caracteres. Usado para línguas de tom (mandarim, cantonês) onde a segmentação de palavras é ambígua.

**RTFx (inverse real-time factor).**Segundo de áudio processado por segundo de relógio de parede. Mais alto é melhor. Parakeet-TDT atinge 3380x.

**First-token latency.**O relógio de parede da entrada de áudio para o primeiro token de transcrição.

### Metricas de TTS

**MOS (Mean Opinion Score).**1-5 de classificação humana. Padrão de ouro, mas lento. Coletar mais de 20 ouvintes por amostra, 100+ amostras por modelo.

**UTMOS (2022-2026).**Aprendi predictor MOS. Correlação de ~ 0,9 com MOS humano em padrões de referência. F5-TTS: UTMOS 3,95; verdade fundamental: 4,08.

**SECS (Speaker Encoder Cosine Similarity).**Para clonagem de voz. ECAPA incorporando cosino entre referência e saída clonada. &gt; 0,75 = clone reconhecível.

**WER-on-ASR-round-trip.**Execute Whisper sobre a saída TTS, computa WER contra o texto de entrada. Capta regressões de inteligibilidade. 2026 SOTA: &lt; 2% WER em conjuntos de teste em inglês (em vez disso, conjuntos mandarinos relatam CER).

**TTFA (time-to-first-audio).**Latência de relógio de parede. Kokoro-82M: ~ 100 ms; F5-TTS: ~ 1 s.

### Específico para clonagem vocal

**SECS + MOS + CER**Cloning que tem um alto SECS mas baixo MOS significa timbre-direito-mas-naturalmente; o oposto significa voz natural mas falhante.

### Verificação de alto-falantes

**EER (Equal Error Rate).**O limite em que a taxa de rejeição falsa é igual à taxa de rejeição falsa.

**minDCF (min Detection Cost).**Custo ponderado num ponto de exploração escolhido (frequentemente FAR=0,01).

### Diarização

**DER (Diarization Error Rate).** `(FA + Miss + Confusion) / total_speaker_time`. Falsa fala + fala de falsa alarme + confusão de alto-falantes, cada uma como uma fração. Reuniões AMI: DER ~ 10-20% é realista. pyannote 3.1 + Precision-2 comercial: &lt;10% DER em áudio bem gravado.

**JER (Jaccard Error Rate).**Alternativa à DER, robusta para o viés de segmentos curtos.

### Classificação de áudio

Multi-etiqueta: **mAP (mean Average Precision)**AudioSet: 0,548 mAP para BEATs-iter3.

Exclusivos para várias classes: **top-1, top-5 accuracy**Comando de fala v2: 99,0% top-1 (Audio-MAE).

Desbalançado: **macro F1**+ **per-class recall**. Relatório por classe  A precisão agregada oculta quais classes falham.

### Geração de música

**FAD (Fréchet Audio Distance).**Distância entre distribuições de áudio real em VGGish versus gerado. MusicGen-small em MusicCaps: 4.5. MusicLM: 4.0. Baixo melhor.

**CLAP Score.**Pontuação de alinhamento de texto-áudio usando embalagens CLAP. &gt; 0,3 = alinhamento razoável.

**Listening panel MOS.**Ainda a palavra final para música de nível de consumo. Suno v5 marcou ELO 1293 no próprio índice de preferência em pares de Suno.

### Indicadores de referência de áudio

**MMAU (Massive Multi-Audio Understanding).**10 mil pares de áudio-QA.

**MMAU-Pro.**1800 itens rígidos, quatro categorias: fala / som / música / multi-audio. 25% acaso em quatro vias. Gemini 2.5 Pro em geral ~ 60%; multi-audio ~ 22% em todos os modelos.

**LongAudioBench.**Clips de vários minutos com consultas semânticas.

**AudioCaps / Clotho.**Captioning benchmarks. SPICE, CIDER, FENSE métricas.

### Transmissão de fala para fala

**Latency P50 / P95 / P99.**O relógio de parede do end-of-user-speech para a primeira resposta audível.

**WER / MOS**- A saída.

**Barge-in responsiveness.**Tempo de interrupção do usuário para assistente mudo.

### As tabela de liderança de 2026

| Leaderboard | Tracks | URL |
|------------|--------|-----|
| Open ASR Leaderboard (HF) | English + multilingual + long-form | `huggingface.co/spaces/hf-audio/open_asr_leaderboard` |
| TTS Arena (HF) | English TTS | `huggingface.co/spaces/TTS-AGI/TTS-Arena` |
| Artificial Analysis Speech | TTS + STT, ELO from paired votes | `artificialanalysis.ai/speech` |
| MMAU-Pro | LALM reasoning | `sonalkum.github.io/mmau-pro` |
| SpeakerBench / VoxSRC | Speaker recognition | `voxsrc.github.io` |
| MMAU music subset | Music LALM | (within MMAU) |
| HEAR benchmark | Self-supervised audio | `hearbenchmark.com` |

```figure
sp-wer-align
```

## Construí-lo

### Passo 1: REM com normalização

```python
from jiwer import wer, Compose, ToLowerCase, RemovePunctuation, Strip

transform = Compose([ToLowerCase(), RemovePunctuation(), Strip()])
score = wer(
    truth="Please turn on the lights.",
    hypothesis="please turn on the light",
    truth_transform=transform,
    hypothesis_transform=transform,
)
# ~0.17
```

### Passo 2: TTS WER de ida e volta

```python
def ttr_wer(tts_model, asr_model, texts):
    errors = []
    for txt in texts:
        audio = tts_model.synthesize(txt)
        recog = asr_model.transcribe(audio)
        errors.append(wer(truth=txt, hypothesis=recog))
    return sum(errors) / len(errors)
```

### Passo 3: SECS para clonagem de voz

```python
from speechbrain.inference.speaker import EncoderClassifier
sv = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb")

emb_ref = sv.encode_batch(load_wav("reference.wav"))
emb_clone = sv.encode_batch(load_wav("cloned.wav"))
secs = torch.nn.functional.cosine_similarity(emb_ref, emb_clone, dim=-1).item()
```

### Passo 4: FAD para geração de música

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()
score = fad.get_fad_score("generated_folder/", "reference_folder/")
```

### Passo 5: EER para a verificação dos alto-falantes (o mesmo código que a lição 6)

```python
def eer(same_scores, diff_scores):
    thresholds = sorted(set(same_scores + diff_scores))
    best = (1.0, 0.0)
    for t in thresholds:
        far = sum(1 for s in diff_scores if s >= t) / len(diff_scores)
        frr = sum(1 for s in same_scores if s < t) / len(same_scores)
        if abs(far - frr) < best[0]:
            best = (abs(far - frr), (far + frr) / 2)
    return best[1]
```

## Usá-lo

Aparar cada implantação com um arnes de avaliação fixo que é executado em cada atualização do modelo.

1. **Normalize before scoring.**Baixa letra, linha de pontuação, número expandido, informe a regra de normalização.
2. **Report distributions, not averages.**P50/P95/P99 para latência. Recall por classe para classificação.
3. **Run one canonical public benchmark.**Mesmo que os seus dados de produção sejam diferentes, relatar no Open ASR / TTS Arena / MMAU permite que os revisores comparem maçãs a maçãs.

## Encurralagens

- **UTMOS extrapolation.**Treinado em discurso limpo no estilo VCTK; pontuação ruidosa / clonado / áudio emocional mal.
- **MOS panel bias.**20 trabalhadores da Amazon Mechanical Turk ≠ 20 usuários alvo. Pague por um painel de domínio se as apostas forem altas.
- **FAD depends on reference set.**Comparar com a mesma distribuição de referência entre os modelos.
- **Aggregate WER.**Uma REM de 5% em geral pode ocultar 30% da REM em discurso acentuado.
- **Public benchmark saturation.**A maioria dos modelos de fronteira está perto do teto em referência padrão.

## Envia-o

Salva como`outputs/skill-audio-evaluator.md`Selecionar métricas, referências e formato de relatório para qualquer lançamento de modelo de áudio.

## Exercícios

1. **Easy.**Corra .`code/main.py`- Calcular WER / CER / EER / SECS / FAD-ish / MMAU-ish em entradas de brinquedos.
2. **Medium.**Construir um arame WER de ida e volta TTS. Exibir sua saída Kokoro ou F5-TTS através de Whisper. Compute WER acima de 50 instruções. Flag instruções com WER &gt; 10%.
3. **Hard.**Marque a sua escolha de aula 10 LALM em discurso MMAU-Pro + subconjuntos de áudio múltiplos (50 itens cada).

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| WER | ASR score | `(S+D+I)/N` at word level after normalization. |
| CER | Character WER | For tone languages or char-level systems. |
| MOS | Human opinion | 1-5 rating; 20+ listeners × 100 samples. |
| UTMOS | ML MOS predictor | Learned model; correlates ~0.9 with human MOS. |
| SECS | Voice-clone similarity | ECAPA cosine between reference and clone. |
| EER | Speaker verif score | Threshold where FAR = FRR. |
| DER | Diarization score | (FA + Miss + Confusion) / total. |
| FAD | Music-gen quality | Fréchet distance on VGGish embeddings. |
| RTFx | Throughput | Audio seconds per wall-clock second. |

## Mais leitura

- [jiwer](https://github.com/jitsi/jiwer) Biblioteca WER/CER com utilitários de normalização.
- [UTMOS (Saeki et al. 2022)](https://arxiv.org/abs/2204.02152)Aprendi a prever o MOS.
- [Fréchet Audio Distance (Kilgour et al. 2019)](https://arxiv.org/abs/1812.08466)- O padrão da geração musical.
- [Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) 2026 rankings ao vivo.
- [TTS Arena](https://huggingface.co/spaces/TTS-AGI/TTS-Arena) TTS líder de votos humanos.
- [MMAU-Pro benchmark](https://sonalkum.github.io/mmau-pro/) Lista de resultados de raciocínio da LALM.
- [HEAR benchmark](https://hearbenchmark.com/) Referências de SSL de áudio.
