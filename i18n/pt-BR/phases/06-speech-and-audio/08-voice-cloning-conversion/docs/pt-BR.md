# Clonagem de voz e conversão de voz

> A clonagem de voz lê o seu texto na voz de outra pessoa. A conversão de voz reescreve a sua voz para a de outra pessoa, preservando o que você disse. Ambos dependem da mesma decomposição: a identidade do alto-falante separada do conteúdo.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 07 (TTS)
**Time:** ~75 minutes

## O problema

Em 2026, um clip de áudio de 5 segundos é suficiente para produzir um clone de alta qualidade da voz de qualquer pessoa com uma GPU de consumo. ElevenLabs, F5-TTS, OpenVoice v2, VoiceBox todos enviam clonagem de zero-shot ou poucos-shot. A tecnologia é uma bênção (acessibilidade TTS, dobramento, vozes de assistência) e uma arma (chamadas de fraude, deepfakes políticos, roubo de IP).

Duas tarefas estreitamente relacionadas:

- **Voice cloning (TTS-side):**texto + 5 segundos de voz de referência → áudio nessa voz.
- **Voice conversion (speech-side):**Áudio fonte (pessoal A dizendo X) + voz de referência da pessoa B → áudio de B dizendo X.

Ambos factorizam uma forma de onda em (conteúdo, alto-falantes, prosódias) e recombinam conteúdo de uma fonte com alto-falantes de outra.

Uma restrição chave que agora se submeterá em 2026:**watermarking and consent gates are legally required in the EU (AI Act, enforceable August 2026) and in California (AB 2905, effective 2025)**O seu gasoduto deve emitir uma marca de água inaudivel e recusar clones não consensuais.

## O conceito

![Voice cloning vs conversion: factorize, swap speaker, recombine](../assets/voice-cloning.svg)

**Zero-shot cloning.**Passe um clip de 5 segundos para um modelo que foi treinado em milhares de alto-falantes. O codificador de alto-falantes mapeia o clip para um integrador de alto-falantes; o decodificador TTS condiciona essa incorporação mais texto.

Usado por: F5-TTS (2024), YourTTS (2022), XTTS v2 (2024), OpenVoice v2 (2024).

**Few-shot fine-tuning.**Gravar 5-30 minutos da voz alvo. LoRA-fine-tune um modelo base por uma hora. Qualidade salta de "okay" para "indistinguible". Coqui e ElevenLabs ambos suportam este padrão; comunidade usa-o com F5-TTS.

**Voice conversion (VC).**Duas famílias:

- **Recognition-synthesis.**Execute um modelo ASR para extrair representação de conteúdo (por exemplo, posteriors fonémicos moles, PPGs), em seguida, resinteze com o incorporamento de alto-falantes alvo. Robusto para a linguagem e o sotaque. usado por KNN-VC (2023), Diff-HierVC (2023).
- **Disentanglement.**Treinar um autoencoder que separa conteúdo, alto-falantes e prosódias em espaço latente no gargalo de engarrafamento. Swap alto-falantes incorporando na inferência. Baixa qualidade, mas mais rápido. Usado por AutoVC (2019), variantes VITS-VC.

**Neural codec-based cloning (2024+).**VALL-E, VALL-E 2, NaturalSpeech 3, VoiceBox  tratar o áudio como tokens discretos do SoundStream / EnCodec, treinar um grande modelo autoregressivo ou de correspondência de fluxo sobre tokens de codec. Qualidade comparável a ElevenLabs em instruções curtas.

### O pouco ético, não um boleto

**Watermarking.**PerTh (Perth) e SilentCipher (2024) incorporam um ID de ~16-32 bits imperceptiblemente no áudio. Sobrevive ao re-encodificação, streaming e edições comuns.

**Consent gates.**"Eu, Rohit, em 2026-04-22, autorizo esta voz para propósito X". Guarde num registro de manipulação.

**Detection.**AASIST, RawNet2 e Wav2Vec2-AASIST navio como detectores. ASVspoof 2025 desafio publicou EERs de 0,82,3% para os detectores de última geração contra ElevenLabs, VALL-E 2, e Bark saídas.

### Números (2026)

| Model | Zero-shot? | SECS (target sim) | WER (intel.) | Params |
|-------|-----------|--------------------|--------------|--------|
| F5-TTS | Yes | 0.72 | 2.1% | 335M |
| XTTS v2 | Yes | 0.65 | 3.5% | 470M |
| OpenVoice v2 | Yes | 0.70 | 2.8% | 220M |
| VALL-E 2 | Yes | 0.77 | 2.4% | 370M |
| VoiceBox | Yes | 0.78 | 2.1% | 330M |

SECS > 0,70 é geralmente indistinguível do alvo para a maioria dos ouvintes.

```figure
sp-voice-factorize
```

## Construí-lo

### Passo 1: decompõe com reconhecimento-síntese (só código demo em main.py)

```python
def clone_pipeline(ref_audio, text, target_embedder, tts_model):
    speaker_emb = target_embedder.encode(ref_audio)
    mel = tts_model(text, speaker=speaker_emb)
    return vocoder(mel)
```

Conceptualmente simples; massa de implementação é de`tts_model`e um codificador de alto-falantes.

### Passo 2: clone de tiro zero com F5-TTS

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="rohit_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please add milk and bread to my list.",
)
```

A transcrição de referência deve corresponder exatamente ao áudio; a descoincidência rompe o alinhamento.

### Passo 3: conversão de voz com KNN-VC

```python
import torch
from knnvc import KNNVC  # 2023 model, https://github.com/bshall/knn-vc
vc = KNNVC.load("wavlm-base-plus")
out_wav = vc.convert(source="my_voice.wav", target_pool=["alice_1.wav", "alice_2.wav"])
```

KNN-VC executa WavLM para extrair embebimentos por quadro para pool de fonte e alvo, em seguida, substitui cada quadro de origem com o vizinho mais próximo na piscina.

### Passo 4: inserir uma marca de água

```python
from silentcipher import SilentCipher
sc = SilentCipher(model="2024-06-01")
payload = b"consent_id:abc123;ts:1745353200"
watermarked = sc.embed(wav, sr=24000, message=payload)
detected = sc.detect(watermarked, sr=24000)   # returns payload bytes
```

~ 32 bits de carga útil, detectável após a recodificação MP3 e ruído leve.

### Passo 5: Portal de consentimento

```python
def cloned_inference(text, ref_audio, consent_record):
    assert verify_signature(consent_record), "Signed consent required"
    assert consent_record["speaker_id"] == hash_speaker(ref_audio)
    wav = tts.infer(ref_file=ref_audio, gen_text=text)
    wav = watermark(wav, payload=consent_record["id"])
    return wav
```

## Usá-lo

A pilha de 2026:

| Situation | Pick |
|-----------|------|
| 5-sec zero-shot clone, open-source | F5-TTS or OpenVoice v2 |
| Commercial production cloning | ElevenLabs Instant Voice Clone v2.5 |
| Voice conversion (rewriting) | KNN-VC or Diff-HierVC |
| Many-speaker fine-tune | StyleTTS 2 + speaker adapter |
| Cross-lingual cloning | XTTS v2 or VALL-E X |
| Deepfake detection | Wav2Vec2-AASIST |

## Encurralagens

- **Misaligned reference transcript.**F5-TTS e similares exigem que o texto de referência corresponda exatamente ao áudio de referência, incluindo a pontuação.
- **Reverberant reference.**O Echo mata o clone.
- **Emotional mismatch.**A referência de treinamento "alegre" produz clones alegres de tudo.
- **Language leakage.**Clonar um falante de inglês e depois pedir ao modelo que fale francês geralmente carrega o sotaque de qualquer maneira; use modelos interlinguários (XTTS, VALL-E X).
- **No watermark.**Não é legalmente enviável na UE a partir de agosto de 2026.

## Envia-o

Salva como`outputs/skill-voice-cloner.md`. Desenhar um canal de clonagem ou de conversão com porta de consentimento + marca de água + meta de qualidade.

## Exercícios

1. **Easy.**Corra .`code/main.py`. Demonstra a troca de integradores de alto-falantes, calculado o cosino entre dois "falantes" antes e depois da troca.
2. **Medium.**Use o OpenVoice v2 para clonar a sua própria voz. Messa o SECS entre referência e clone. Messa o CER através do Whisper.
3. **Hard.**Aplique a marca de água SilentCipher em 20 clones, execute-os através de 128 kbps MP3 codificação + decodificação, detectar a carga útil.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Zero-shot clone | 5 seconds is enough | Pretrained model + speaker embedding; no training. |
| PPG | Phonetic posteriorgram | Per-frame ASR posteriors used as language-agnostic content rep. |
| KNN-VC | Nearest-neighbor conversion | Replace each source frame with nearest target-pool frame. |
| Neural codec TTS | VALL-E style | AR model over EnCodec/SoundStream tokens. |
| Watermark | Inaudible signature | Bits embedded in audio, survive re-encode. |
| SECS | Cloning fidelity | Cosine between target and clone speaker embeddings. |
| AASIST | Deepfake detector | Anti-spoof model; detects synthesized speech. |

## Mais leitura

- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) Clonagem de código aberto SOTA de tiro zero.
- [Baevski et al. / Microsoft (2023). VALL-E](https://arxiv.org/abs/2301.02111)E ...[VALL-E 2 (2024)](https://arxiv.org/abs/2406.05370) TTS de codec neural.
- [Qian et al. (2019). AutoVC](https://arxiv.org/abs/1905.05879) conversão de voz baseada em desembaraço.
- [Baas, Waubert de Puiseau, Kamper (2023). KNN-VC](https://arxiv.org/abs/2305.18975) VC baseado em recuperação.
- [SilentCipher (2024) — Audio Watermarking](https://github.com/sony/silentcipher) Marca de áudio de 32 bits pronta para produção.
- [ASVspoof 2025 results](https://www.asvspoof.org/) corrida de armamento detector vs. sintetizador, atualizada em 2026.
