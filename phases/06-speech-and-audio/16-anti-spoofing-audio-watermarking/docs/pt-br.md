# Anti-Spoofing de Voz e Marca d'Água de Áudio — ASVspoof 5, AudioSeal, WaveVerify

> Clonagem de voz foi mais rápida que as defesas. Sistemas de voz de produção de 2026 precisam de duas coisas: um detector (AASIST, RawNet2) que classifica fala real vs falsa, e uma marca d'água (AudioSeal) que sobrevive a compressão e edição. Entregue ambas ou não faça implantação de clonagem de voz.

**Tipo:** Construir
**Idiomas:** Python
**Pré-requisitos:** Fase 6 · 06 (Reconhecimento de Falante), Fase 6 · 08 (Clonagem de Voz)
**Tempo:** ~75 minutos

## O Problema

Três defesas relacionadas:

1. **Anti-spoofing / detecção de deepfake.** Dado um clipe de áudio, é sintético ou real? Benchmarks ASVspoof (ASVspoof 2019 → 2021 → 5) são o padrão ouro.
2. **Marca d'água de áudio.** Embute um sinal imperceptível no áudio gerado que um detector pode extrair depois. AudioSeal (Meta) e WavMark são as opções open.
3. **Proveniência autenticada.** Assinatura criptográfica de arquivos de áudio + metadados. C2PA / Content Authenticity Initiative.

Detecção lida com adversários que não cooperam. Marca d'água lida com conformidade — áudio gerado por IA deve ser identificável como tal. Ambas são obrigatórias em 2026.

## O Conceito

![Anti-spoofing vs marca d'água vs proveniência — três camadas de defesa](../assets/spoofing-watermark.svg)

### ASVspoof 5 — o benchmark 2024-2025

Maior mudança das edições anteriores:

- **Dados crowdsourceados** (não de estúdio limpo) — condições realistas.
- **~2000 falantes** (vs ~100 antes).
- **32 algoritmos de ataque.** TTS + conversão de voz + perturbação adversarial.
- **Duas faixas.** Medida de contramedida (CM) detecção independente; ASV robusto a spoofing (SASV) para sistemas biométricos.

SOTA no ASVspoof 5: ~7,23% EER. No ASVspoof 2019 LA mais antigo: 0,42% EER. Deploy em mundo real: espere 5-10% EEM em clips selvagens.

### AASIST e RawNet2 — famílias de modelos de detecção

**AASIST** (2021, atualizado até 2026). Attention em grafo sobre características eespecificaçãotrais. SOTA atual na tarefa de contramedida ASVspoof 5.

**RawNet2.** Front-end convolucional sobre forma de onda bruta + backbone TDNN. Baseline mais simples; ainda competitivo com ajuste fino.

**NeXt-TDNN + características SSL.** Variante de 2025: estilo ECAPA + características WavLM + focal loss. Alcança o 0,42% EER no ASVspoof 2019 LA.

### AudioSeal — o padrão de marca d'água de 2024

**AudioSeal** da Meta (jan 2024, v0.2 dez 2024). Design principal:

- **Localizado.** Detecta a marca d'água por frame a 16 kHz (1/16000 s).
- **Gerador + detector treinados conjuntamente.** Gerador aprende a embutir sinal inaudível; detector aprende a encontrá-lo através de augmentações.
- **Robusto.** Sobrevive a compressão MP3 / AAC, EQ, mudança de velocidade ±10%, mix de ruído +10 dB SNR.
- **Rápido.** Detector roda a 485× tempo real; 1000× mais rápido que WavMark.
- **Capacidade.** Payload de 16 bits (pode codificar ID do modelo, timestamp de geração, ID do usuário) embutível em cada utterance.

### WavMark

O baseline open pré-AudioSeal. Rede neural invertível, 32 bits/seg. Problemas:

- Sincronização por força bruta é lenta.
- Pode ser removida por ruído gaussiano ou compressão MP3.
- Não é amigável a tempo real.

### WaveVerify (julho 2025)

Resolve as fraquezas do AudioSeal — eespecificaçãoificamente manipulações temporais (reversão, velocidade). Usa gerador baseado em FiLM + detector Mixture-of-Experts. Competitivo com AudioSeal em ataques padrão; lida com edições temporais.

### O gap que adversários exploram

Do AudioMarkBench: "sob mudança de tom, todas as marcas d'água mostram Bit Recovery Accuracy abaixo de 0,6, indicando remoção quase completa." **Mudança de tom é o ataque universal.** Nenhuma marca d'água de 2026 é totalmente robusta a modificação agressiva de tom. É por isso que você precisa de detecção (AASIST) ao lado de marca d'água.

### C2PA / Content Authenticity Initiative

Não é técnica ML — é formato manifesto. Arquivos de áudio carregam metadados assinados criptograficamente sobre ferramenta de criação, autor, data. Audobox / Seamless usam. Bom para proveniência; não faz nada se um ator mal-intencionado re-encriptar e remover metadados.

## Construa

### Passo 1: detector simples de características eespecificaçãotrais (toy)

```python
def especificaçãotral_rolloff(especificação, percentile=0.85):
    cum = 0
    total = sum(especificação)
    if total == 0:
        return 0
    threshold = total * percentile
    for k, v in enumerate(especificação):
        cum += v
        if cum >= threshold:
            return k
    return len(especificação) - 1

def is_suspicious(audio):
    especificação = magnitude_especificaçãotrum(audio)
    rolloff = especificaçãotral_rolloff(especificação)
    return rolloff / len(especificação) > 0.92
```

Fala sintetizada frequentemente tem energia de alta frequência incomumente plana. Detectores de produção usam AASIST, não isso. Mas a intuição vale.

### Passo 2: AudioSeal embutir + detectar

```python
from audioseal import AudioSeal
import torch

generator = AudioSeal.load_generator("audioseal_wm_16bits")
detector = AudioSeal.load_detector("audioseal_detector_16bits")

audio = load_wav("generated.wav", sr=16000)[None, None, :]
payload = torch.tensor([[1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0]])
watermark = generator.get_watermark(audio, sample_rate=16000, message=payload)
watermarked = audio + watermark

result, decoded_payload = detector.detect_watermark(watermarked, sample_rate=16000)
```

### Passo 3: avaliação — EER

```python
def eer(real_scores, fake_scores):
    thresholds = sorted(set(real_scores + fake_scores))
    best = (1.0, 0.0)
    for t in thresholds:
        far = sum(1 for s in fake_scores if s >= t) / len(fake_scores)
        frr = sum(1 for s in real_scores if s < t) / len(real_scores)
        if abs(far - frr) < best[0]:
            best = (abs(far - frr), (far + frr) / 2)
    return best[1]
```

### Passo 4: a integração de produção

```python
def safe_tts(text, voice, clone_reference=None):
    if clone_reference is not None:
        verify_consent(user_id, clone_reference)
    audio = tts_model.synthesize(text, voice)
    audio_with_wm = audioseal_embed(audio, payload=build_payload(user_id, model_id))
    manifest = c2pa_sign(audio_with_wm, user_id, timestamp=now())
    return audio_with_wm, manifest
```

Toda geração envia: (1) marca d'água, (2) manifesto assinado, (3) log de auditoria compatível com política de retenção.

## Use

| Caso de uso | Defesa |
|-------------|--------|
| Deploy de TTS / clonagem de voz | AudioSeal embutido em cada saída (obrigatório) |
| Desbloqueio de voz biométrico | AASIST + conjunto ECAPA; desafio de vivacidade |
| Detecção de fraude em call-center | AASIST em 20% da amostra de chamadas recebidas |
| Autenticidade de podcast | Assinatura C2PA no upload, AudioSeal se gerado por IA |
| Pesquisa / treino de detectores | Conjuntos train/dev/eval do ASVspoof 5 |

## Armadilhas

- **Marca d'água sem detector nunca rodando.** Inútil. Coloque o detector no seu CI.
- **Detecção sem calibração.** AASIST treinado em ASVspoof LA sofre de overfitting; precisão em mundo real cai. Calibre no seu domínio.
- **Gap de mudança de tom.** Mudança de tom agressiva remove a maioria das marcas d'água. Tenha um reserva de detecção.
- **Strip-and-rehost de metadados.** C2PA é facilmente contornável por re-encriptação. Sempre adicione defesa criptográfica + perceptual (marca d'água) juntas.
- **Vivacidade como detecção.** Peça ao usuário para dizer uma frase aleatória. Previne ataques de replay mas não clonagem em tempo real.

## Entregue

Salve como `outputs/skill-spoof-defender.md`. Escolha modelo de detector, marca d'água, manifesto de proveniência e playbook operacional para uma implantação de geração de voz.

## Exercícios

1. **Fácil.** Execute `code/main.py`. Detector toy + marca d'água toy embutir/detectar em áudio sintético.
2. **Médio.** Instale `audioseal`, embuta payload de 16 bits em saída de TTS, re-decode. Corrompa o áudio com ruído e meça Bit Recovery Accuracy.
3. **Difícil.** Ajuste fino um RawNet2 ou AASIST no ASVspoof 2019 LA. Meça EER. Teste em conjunto de validação de clips gerados por F5-TTS — veja como a detecção OOD degrada.

## Termos Chave

| Termo | O que a gente diz | O que significa de verdade |
|-------|-------------------|---------------------------|
| ASVspoof | O benchmark | Desafio bienal; 2024 = ASVspoof 5. |
| CM (contramedida) | Detector | Classificador: fala real vs sintetizada/convertida. |
| SASV | Verificação de falante + CM | Biométrico + detecção de spoof integrados. |
| AudioSeal | Marca d'água da Meta | Localizada, payload de 16 bits, 485× mais rápido que WavMark. |
| Bit Recovery Accuracy | Sobrevivência da marca d'água | Fração de bits do payload recuperados após ataque. |
| C2PA | Manifesto de proveniência | Metadados criptográficos sobre criação/autoria. |
| AASIST | Família de detectores | Anti-spoofing baseado em attention de grafo SOTA. |

## Leitura Adicional

- [Todisco et al. (2024). ASVspoof 5](https://dl.acm.org/doi/10.1016/j.csl.2025.101825) — o benchmark atual.
- [Defossez et al. (2024). AudioSeal](https://arxiv.org/abs/2401.17264) — o padrão de marca d'água.
- [Chen et al. (2025). WaveVerify](https://arxiv.org/abs/2507.21150) — detector MoE para ataques temporais.
- [Jung et al. (2022). AASIST](https://arxiv.org/abs/2110.01200) — backbone de detecção SOTA.
- [AudioMarkBench (2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/5d9b7775296a641a1913ab6b4425d5e8-Paper-Datasets_and_Benchmarks_Track.pdf) — avaliação de robustez.
- [Eespecificaçãoificação C2PA](https://c2pa.org/especificaçãoifications/especificaçãoifications/) — formato de manifesto de proveniência.
