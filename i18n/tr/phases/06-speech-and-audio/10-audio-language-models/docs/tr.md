# Ses-Dil Modeller  Qwen2.5-Omni, Ses Flamingo, GPT-4o Ses

> 2026 ses dili modelleri konuşma + çevresel ses + müzik üzerinde düşünüyor. Qwen2.5-Omni-7B MMAU-Pro'da GPT-4o Audio ile eşleşir. Audio Flamingo Next LongAudioBench'de Gemini 2.5 Pro'yu yener. Açık ve kapalı arasındaki boşluk, herkesin neredeyse rastgele olduğu çok sesli görevler hariç, esasen kapalıdır.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04 (ASR), Phase 12 · 03 (Vision-Language Models), Phase 7 · 10 (Audio Transformers)
**Time:** ~45 minutes

## Sorun

5 saniyelik sesiniz var: köpek havlıyor, biri "dur!" diye bağırıyor, sonra sessizlik.

- **Transcription.**"Ne söylendi?"  ASR bölgesinde.
- **Semantic reasoning.**"İnsan tehlikede mi?"  havlama + bağırmak + sessizlik hakkında ortak bir anlayış gerektirir.
- **Music reasoning.**"Ne tür aletler melodi çalıyor?"
- **Long-audio retrieval.**"Bu 90 dakikalık konuşmada öğretmen, gradient düşüşünü nerede açıkladı?"

Tüm bunları tek bir çağrı ile cevaplayan tek bir model **audio-language model**(LALM / ALM). Saf ASR'den ayrı: LALM'ler sadece transkriptleri değil, serbest biçimli doğal dil cevapları üretir.

## Anlaşım

![Audio-language model: audio encoder + projector + LLM decoder](../assets/alm-architecture.svg)

### Üç bileşenli şablon

2026'da her LALM'de aynı iskelet vardır:

1. **Audio encoder.**Şapış kodlayıcı · BEATs · CLAP · WavLM · veya model başına özel bir kodlayıcı.
2. **Projector.**Lineer veya MLP köprü ses kodlayıcı özellikleri LLM'nin simge yerleştirme alanına.
3. **LLM.**Llama / Qwen / Gemma tabanlı dekodör. Çelişkili metin + ses jetonlarını alır; metin oluşturur.

Eğitim:

- **Stage 1.**Dondurma kodlayıcısı + LLM; tren projeksiyonu sadece ASR / başlık verileri üzerinde.
- **Stage 2.**Tam / LoRA ince ayarlamaları, talimatları takip eden ses görevleri (QA, akıl yürütme, müzik anlama) üzerinde.
- **Stage 3 (optional).**Ses içi / ses çıkışı konuşma dekodörü ekler. Qwen2.5-Omni ve AF3-Chat bunu yapar.

### 2026 model haritası

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

### Benchmark gerçeklik kontrolü (2026)

**MMAU-Pro.**1800 konuşma / ses / müzik / karışıklık kapsamındaki QA çiftleri.

| Model | Overall | Speech | Sound | Music | Multi-audio |
|-------|---------|--------|-------|-------|-------------|
| Gemini 2.5 Pro | ~60% | 73.4% | 51.9% | 64.9% | ~22% |
| Gemini 2.5 Flash | ~57% | 73.4% | 50.5% | 64.9% | 21.2% |
| GPT-4o Audio | 52.5% | — | — | — | 26.5% |
| Qwen2.5-Omni-7B | 52.2% | 57.4% | 47.6% | 61.5% | ~20% |
| Audio Flamingo 3 | ~54% | — | — | — | — |
| Audio Flamingo Next | SOTA on LongAudioBench | — | — | — | — |

- Evet .**multi-audio column is damning for everyone.**4 seçeneklü birden fazla seçeneğin rastgele şansı = 25%; çoğu model burada puan alır. LALM'ler hala iki klipin karşılaştırılmasında zorlanırlar.

### 2026 yılında LALM'lerin yararlı olduğu yerler

- **Compliance audit of call-center recordings.**"Agent, gerekli ifşa edilmesini söyledi mi?"
- **Accessibility.**Sesli olayları sağır kullanıcılara anlatın (sadece transkripsiyon değil).
- **Content moderation.**Şiddetli dil + tehdit edici ton + arka plan bağlamı tespit et.
- **Podcast / meeting chaptering.**Semantik özet, sadece konuşmacı döner değil.
- **Music catalog analysis.**"B bölümünde anahtar değişikliği ile tüm parçaları bul".

### (Hâlâ) yararlı olmadıkları yerlerde

- Güzel tohumlu müzik teorisi (akord seviyesinin altında).
- Uzun konuşmalar (sadece 10 dakika geçen dereceler) üzerinde konuşmacı tarafından atfedilen mantıklama.
- Çok sesli karşılaştırma (22-26% rastgeleden fazla değil).
- Gerçek zamanlı akışlı akıl yürütme (çoğu çevrimdışı parti sonuçlarıdır).

```figure
v4-alm-tokens
```

## Yapın

### Adım 1: Qwen2.5-Omni sorgu

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

### Adım 2: Projector örneği

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

Bu projector genellikle 1-3 doğrusal katman. ASR çiftlerinde eğitmek (audio → transkript) 1. aşama bahane görevi.

### Adım 3: MMAU / LongAudioBench karşılaştırma

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

`audio_path`Veriler kümesinin repolarına işaretler `data.zip`(yaklaşık 47 GB), bu yüzden not almadan önce indir ve aç. Bu tam eşleşme döngüsü, referans puanlayıcı değil, akıl kontrolüdür, bu nedenle sayısı MMAU-Pro'nun yayınlanan sonuçlarıyla karşılaştırılamaz. Resmi değerlendirici benzerliği (NV-Embed-v2) yerleştirerek çoklu seçim yanıtlarını eşleştiriyor, bir LLM yargıçıyla açık sonlu yanıtları notlar ve talimatları takip eden yanıtları regex kurallarıyla kontrol ediyor: bir `model_output`sütun ve çalıştır `evaluate_mmau_pro_comprehensive.py`- ...[MMAU-Pro repo](https://github.com/sonalkum/MMAUPro)- Her biri rapor eder .`category`(söz, ses, müzik, multi ve diğerleri) ayrı ayrı.

## Kullan

| Task | 2026 pick |
|------|-----------|
| Free-form audio QA (open) | Qwen2.5-Omni-7B |
| Best open on long audio | Audio Flamingo Next |
| Best closed | Gemini 2.5 Pro |
| Voice-in / voice-out agent | Qwen2.5-Omni or GPT-4o Audio |
| Music reasoning | Audio Flamingo 3 or 2 (music-specialized AF-CLAP) |
| Call-center audit | Gemini 2.5 Pro via API, with RAG over your policy docs |

## Tuzaklar

- **Over-trust on multi-audio.**Göreviniz "Hangi klip X'ye sahip" gereksinimindedirse, rastgele şans düzeyinde performans gerçek olur.
- **Long-audio degradation.**Son 10 dakika, çoğu modelin hoparlör atributları bozulur. Önce diary'yi (Disim 6), sonra özetle.
- **Hallucinations on silence.**Aynı Whisper'ın şifresini kullanan LALM'ler tarafından miras alınan Whisper-style sorun.
- **Benchmark cherry-picking.**Satıcı blog yayınları en iyi durum kategorilerini vurguluyor.

## Gönder

- Kaydet .`outputs/skill-alm-picker.md`. Verilen ses anlama görevi için LALM + referans alt kümesi + çıkış modalitesi (söz karşılığı metin) seçin.

## Egzersizler

1. **Easy.**Çık .`code/main.py`Oyuncak projeksiyon örneğini görmek için + (audio-eğlence, metin-token) → çıkış tokenlerinin sahte LALM yönlendirilmesi.
2. **Medium.**100 MMAU-Pro konuşma öğesi üzerinde Qwen2.5 Omni-7B puanı alın.
3. **Hard.**Minimum bir ses başlıklı bir temel oluşturun: BEATs kodlayıcı + 2 katmanlı projektor + dondurulmuş Llama-3.2-1B. Sadece AudioCaps'taki projektoru ince ayarlayın. Clotho-AQA'daki SALMONN ile karşılaştırın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| LALM | Audio ChatGPT | Audio encoder + projector + LLM decoder. |
| Projector | Adapter | Small MLP mapping audio features into LLM embedding space. |
| MMAU | The benchmark | 10k audio-QA pairs across speech, sound, music. |
| MMAU-Pro | Harder MMAU | 1800 multi-audio / reasoning-heavy questions. |
| LongAudioBench | Long-form eval | Multi-minute clips with semantic queries. |
| Voice-in / voice-out | Speech-native | Model ingests speech and emits speech without text detour. |

## Daha Fazla Okumak

- [Chu et al. (2024). Qwen2-Audio](https://arxiv.org/abs/2407.10759)Referans mimarisi.
- [Alibaba (2025). Qwen2.5-Omni](https://huggingface.co/Qwen/Qwen2.5-Omni-7B)- Konuşma-söz-söz.
- [NVIDIA (2025). Audio Flamingo 3](https://arxiv.org/abs/2507.08128) açık uzun sesli lider.
- [NVIDIA (2026). Audio Flamingo Next](https://arxiv.org/abs/2604.10905) LongAudioBench SOTA.
- [Tang et al. (2023). SALMONN](https://arxiv.org/abs/2310.13289) çift kodlayıcı öncü.
- [MMAU-Pro leaderboard](https://sonalkum.github.io/mmau-pro/) 2026'da canlı sıralamalar.
