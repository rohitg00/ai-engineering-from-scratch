# Şapışmak  Mimarlık ve Güzel Düzenleme

> Whisper, 30 saniyelik bir pencere transformatörü kodlayıcı-dekoder, 680 bin saatlik çok dilli zayıf denetimli ses metni çiftlerinde eğitilmiştir.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04 (ASR), Phase 5 · 10 (Attention), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## Sorun

OpenAI tarafından Eylül 2022'de yayınlanan Whisper, bir mal olarak gönderilen ilk ASR modeliydi: ses koy, metin alın, 99 dil, gürültüye dayanıklı, bir dizüstü bilgisayarda çalışır. 2024 yılına kadar OpenAI, Large-v3 ve Turbo çeşitlerini göndermişti; 2026 yılına kadar, Whisper, podcast transkripsiyonundan ses asistanlarına kadar YouTube altyazımlarına kadar her şey için varsayılan temel çizgidir.

Ama Whisper, sonsuza kadar kara kutu gibi davranılabilecek bir boru hattı değil.

1. İçeride ne olduğunu.
2. Nasıl doğru şekilde parçalanmış, akışlı veya uzun formatlı ses verirsin?
3. Ne zaman ve nasıl ayarlanacak.

## Anlaşım

![Whisper encoder-decoder, tasks, chunked inference, fine-tune](../assets/whisper.svg)

**Architecture.**Standart transformatör kodlayıcı-dekoder.

- Giriş: 30 saniyelik log-mel spektrogramı, 80 mels, 10 ms hop → 3000 çerçeve.
- Kodlayıcı: konvulsiyon aşağı örnek (addım 2) + `N`Büyük V3: 32 katman, 1280 katman, 20 baş.
- Çözücü: `N`Transformer blokları sebebsel kendi kendine atn + kodlayıcı çıkışına çapraz atn.
- Çıktı: 51.865'lik bir sözcük üzerinde BPE tokenleri.

Large-v3'de 1.55B parametreleri vardır. Turbo, 4 katlı bir dekodör kullanır (32'den itibaren), %1 WER çarpması ile 8× gecikme keser.

**The prompt format.**Whisper , dekodör uyarısında özel jetonlar tarafından yönlendirilmiş bir çok görevli modeldir:

```
<|startoftranscript|><|en|><|transcribe|><|notimestamps|> Hello world.<|endoftext|>
```

- `<|en|>`: dil etiketleri; sesli konuşulan dili isimlendirir.
- `<|transcribe|>`veya `<|translate|>`: görev etiket; konuşmayı kaynak diliyle çevirin veya İngilizce metine çevirin.
- `<|notimestamps|>`: kelime seviyesindeki zaman damgasını atlayın (hızlı).

Bu, bir modelin birçok görevi yapmasına izin veren bir prompt.`<|en|>`- ...`<|fr|>`Fransızca yazıyor.

**30-second window.**Her şey 30 saniyeye bağlanır. Uzun klipler parçalanmaya ihtiyaç duyar; kısa klipler dolandırılır. Windows doğal olarak akışlanmaz  bu nedenle WhisperX, Whisper-Streaming ve daha hızlı fısıldayan var.

**Log-mel normalization.** `(log_mel - mean) / std`Whisper'in kendi eğitim kurpusundan gelen istatistikler.`whisper.audio.log_mel_spectrogram`- Hayır .`librosa.feature.melspectrogram`- Evet .

### 2026'da değişiklikler

| Variant | Params | Latency (A100) | WER (LibriSpeech-clean) |
|---------|--------|----------------|------------------------|
| Tiny | 39M | 1× realtime | 5.4% |
| Base | 74M | 1× | 4.1% |
| Small | 244M | 1× | 3.0% |
| Medium | 769M | 1× | 2.7% |
| Large-v3 | 1.55B | 2× | 1.8% |
| Large-v3-turbo | 809M | 8× | 1.58% |
| Whisper-Streaming (2024) | 1.55B | streaming | 2.0% |

### Düzgün ayarlama

2026 yılında Kanonik çalışma akışı:

1. Düzleştirilmiş transkriptlerle hedef alan ses 10100 saat toplayın.
2. Çık .`transformers.Seq2SeqTrainer`- Evet .`generate_with_loss`Geri çağır.
3. Parametre- verimli: LoRA `q_proj`- Evet .`k_proj`- Evet .`v_proj`Dikkat katmanlarının GPU belleğini 4×'ye düşürüyor ve WER maliyeti < 0.3'dir.
4. Eğer <10 saatiniz varsa kodlayıcıyı dondurun.
5. Whisper'in kendi tokenizer ve prompt formatını kullanın; tokenizerleri asla değiştirmeyin.

Topluluk sonuçları: 20 saatlik tıbbi diktasyonda ortalama ayarlama tıbbi kelime birikimine %12'den %4,5'e düşer.

```figure
sp-asr-attention
```

## Yapın

### Adım 1: Kıskançlığı kutudan çıkar

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

Her zaman geçersiz kılmanız gereken anahtar varsayımlar: `temperature=0.0`(defaultları örneğe alarak 0.0 → 0.2 → 0.4 ... geri dönüş zinciri) `condition_on_previous_text=False`(kaskadör halüsinasyon problemini önler) ve`no_speech_threshold=0.6`(Sessizlik algısı).

### Adım 2: Uzun şekilli parçalar

```python
# whisperx is the 2026 reference for long-form with word-level timestamps
import whisperx
model = whisperx.load_model("large-v3-turbo", device="cuda", compute_type="float16")
segments = model.transcribe("1hour.mp3", batch_size=16, chunk_size=30)
```

WhisperX (1) Silero VAD kaplama, (2) wav2vec 2.0 üzerinden kelime seviyesinde birleştirme, (3) günlükleştirme `pyannote.audio`2026'da üretime dönüştürülecek bir iş atı.

### Adım 3: LoRA ile ince ayarlama

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

Sonra standart Trainer döngüsü, her 1000 adımda bir kontrol noktası, UYK ile beklenmiş durumları değerlendirin.

### Dördüncü adım: Her katman ne öğreniyorsa kontrol edin

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

Bir ısıtma haritasıyla görselleştirin  dekodör adımları kodlayıcı çerçeveleri aracılığıyla tarayılırken diyagonal ayar görülecektir.

## Kullan

2026'da:

| Situation | Pick |
|-----------|------|
| General English, offline | Large-v3-turbo via `whisperx` |
| Mobile / edge | Whisper-Tiny quantized (int8) or Moonshine |
| Multilingual long-form | Large-v3 via `whisperx` + diarization |
| Low-resource language | Fine-tune Medium or Turbo with LoRA |
| Streaming (2 s latency) | Whisper-Streaming or Parakeet-TDT |
| Word-level timestamps | WhisperX (forced alignment via wav2vec 2.0) |

`faster-whisper`(CTranslate2 backend) 2026'da en hızlı CPU + GPU sonuç süresi  4x aynı çıkışla vanilya daha hızlıdır.

## 2026'da hala yolculuk eden tuzaklar

- **Hallucinated text on silence.**Başlıklara göre eğitilmiş fısıltılar "Seyrettiğiniz için teşekkürler!", "Abone olun!", şarkı sözleri içerir.
- **`condition_on_previous_text` cascade.**Bir halüsinasyon sonraki pencereleri kirletiyor.`False`Eğer parçalar arasında akıcılık gerekmezse.
- **Short-clip padding.**30 saniyeye kadar doldurulan 2 saniyelik bir klip, sonraki sessizlikte halüsinasyonlar yaratabilir.`pad=False`Ya da VAD-gate.
- **Wrong mel stats.**Whisper'in yerine librosa'nın mels'ini kullanmak neredeyse rastgele çıkış üretir.`whisper.audio.log_mel_spectrogram`- Evet .

## Gönder

- Kaydet .`outputs/skill-whisper-tuner.md`- Belirli bir alan için Whisper ince ayar veya sonuçlar boru hattı tasarlayın.

## Egzersizler

1. **Easy.**Çık .`code/main.py`Whisper tarzı bir istek simgesi oluşturur, çözülmüş biçim bütçelerini hesaplar ve 10 dakikalık bir klip için parça programını basar.
2. **Medium.**Kurulum`faster-whisper`, 10 dakikalık bir podcast transkripte, WER'i insan transkriptine karşı karşılaştır.`language="auto"`- Zorla`language="en"`- Evet .
3. **Hard.**HF kullanmak `datasets`, Whisper'in mücadele ettiği bir dil seçin (örneğin, Urdu), 2 saatte 2 dönem boyunca Orta ile LoRA'yı ince ayarlayın ve WER delta raporunu yapın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| 30-sec window | Whisper's limit | Hard input cap; chunk longer audio. |
| SOT | Start-of-transcript | `<\|startoftranscript\|>` kicks off the decoder prompt. |
| Timestamps token | Temporal alignment | Every 0.02 s offset is a special token in the 51k vocab. |
| Turbo | The fast variant | 4-decoder layers, 8× faster, <1% WER regression. |
| WhisperX | The long-form wrapper | VAD + Whisper + wav2vec alignment + diarization. |
| LoRA fine-tune | Efficient tuning | Add low-rank adapters to attention; train ~0.3% of params. |
| Hallucination | The silent failure | Whisper produces fluent English from noise/silence. |

## Daha Fazla Okumak

- [Radford et al. (2022). Whisper paper](https://arxiv.org/abs/2212.04356) orijinal mimarlık ve eğitim tarifi.
- [OpenAI (2024). Whisper Large-v3-turbo release](https://github.com/openai/whisper/discussions/2363)4 katlı dekodör, 8 kat hızlandırma.
- [Bain et al. (2023). WhisperX](https://arxiv.org/abs/2303.00747)Uzun şekil, kelimeyle uyumlu, günlük.
- [Systran — faster-whisper repo](https://github.com/SYSTRAN/faster-whisper) CTranslate2 desteklenmiş, 4x daha hızlı.
- [HuggingFace — Whisper fine-tune tutorial](https://huggingface.co/blog/fine-tune-whisper) Kanonik LoRA / tam FT yürüyüş.
