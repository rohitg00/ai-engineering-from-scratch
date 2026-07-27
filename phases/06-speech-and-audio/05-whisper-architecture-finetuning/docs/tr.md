# Fısıltı — Mimarlık ve Fine-Tuning

> Whisper, 680 bin saatlik çok dilli zayıf denetimli ses-metin çiftleriyle eğitilmiş, 30 saniyelik bir pencere transformer kodlayıcı-kod çözücüdür. Tek mimari, birden fazla görev, 99 dilde sağlamlık. 2026 referansı ASR.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 6 · 04 (ASR), Aşama 5 · 10 (Dikkat), Aşama 7 · 05 (Tam Transformer)
**Süre:** ~75 dakika

## Sorun

OpenAI tarafından Eylül 2022'de piyasaya sürülen Whisper, ticari olarak sunulan ilk ASR modeliydi: ses yapıştırma, metin alma, 99 dil, gürültüye karşı dayanıklı, dizüstü bilgisayarda çalışıyor. 2024 yılına gelindiğinde OpenAI, Large-v3 ve Turbo çeşitlerini piyasaya sürdü; 2026 yılına kadar Whisper, podcast transkripsiyonundan sesli asistanlara ve YouTube altyazılarına kadar her şey için varsayılan temel olacaktır.

Ancak Whisper, sonsuza kadar kara kutu olarak görebileceğiniz bir boru hattı değil. Alan değişikliği onu öldürür; teknik jargon, konuşmacının vurguları, özel isimler, kısa klipler, sessizlik. Bilmeniz gerekenler:

1. İçeride gerçekte ne var?
2. Parçalı, akışlı veya uzun biçimli sesin doğru şekilde nasıl verileceği.
3. İnce ayar ne zaman ve nasıl yapılmalı?

## Konsept

![Fısıltı kodlayıcı-kod çözücü, görevler, parçalanmış inference, ince ayar](../assets/whisper.svg)

**Mimari.** Standart transformer kodlayıcı-kod çözücü.

- Giriş: 30 saniyelik log-mel spektrogramı, 80 mel, 10 ms atlama → 3000 kare. Daha kısa klipler sıfır dolguludur, daha uzun klipler parçalıdır.
- Kodlayıcı: dönüşüm-aşağı örnek (adım 2) + `N` transformer bloklar. Büyük-v3 için: 32 katman, 1280-dim, 20 kafa.
- Kod çözücü: Kodlayıcı çıkışına nedensel öz-attn + cross-attn ile `N` transformer blok. Kodlayıcıyla aynı boyutta.
- Çıktı: 51.865-token kelime haznesinin üzerinde BPE tokens.

Large-v3'ün 1,55B parametreleri vardır. Turbo, <%1 WER isabetiyle gecikmeyi 8 kat azaltan 4 katmanlı bir kod çözücü (32'den itibaren) kullanır.

**prompt biçimi.** Fısıltı, prompt kod çözücüdeki özel token'ler tarafından yönlendirilen çok görevli bir modeldir:

```
<|startoftranscript|><|en|><|transcribe|><|notimestamps|> Hello world.<|endoftext|>
```

- `<|en|>` — dil etiketi; çeviri-transkripsiyon davranışını zorlar.
- `<|transcribe|>` veya `<|translate|>` — herhangi bir dildeki girişten İngilizce çıktıyı veya kelimesi kelimesine çevirir.
- `<|notimestamps|>` — Kelime düzeyindeki zaman damgalarını atla (daha hızlı).

prompt, bir modelin birçok görevi yerine getirmesini sağlayan şeydir. `<|en|>`'yi `<|fr|>` olarak değiştirin ve Fransızca'yı yazıya dökün.

**30 saniyelik aralık.** Her şey 30 saniyeye sabitlenmiştir. Daha uzun kliplerin parçalanması gerekir; daha kısa klipler dolguludur. Windows yerel olarak yayınlanmaz; WhisperX, Whisper-Streaming ve daha hızlı Whisper'ın var olmasının nedeni budur.

**Log-mel normalleştirme.** `(log_mel - mean) / std` burada istatistikler Whisper'ın kendi eğitim külliyatından gelir. `librosa.feature.melspectrogram` değil, Whisper'ın ön işlemesini (`whisper.audio.log_mel_spectrogram`) *kullanmalısınız*.

### 2026'daki çeşitler

| Varyant | Parametreler | Gecikme (A100) | WER (LibriSpeech-temiz) |
|---------|--------|----------------|------------------------|
| minik | 39 milyon | 1× gerçek zamanlı | %5,4 |
| Baz | 74 milyon | 1× | %4,1 |
| Küçük | 244 milyon | 1× | %3,0 |
| Orta | 769M | 1× | %2,7 |
| Büyük-v3 | 1,55B | 2× | %1,8 |
| Büyük-v3-turbo | 809M | 8× | %1,58 |
| Fısıltı Yayını (2024) | 1,55B | akış | %2,0 |

### Fine-tuning

2026'da kanonik iş akışı:

1. Hizalanmış transkriptlerle 10-100 saatlik hedef alan sesini toplayın.
2. `transformers.Seq2SeqTrainer`'yi `generate_with_loss` geri aramasıyla çalıştırın.
3. Parametre açısından verimli: Dikkat katmanlarının `q_proj`, `k_proj`, `v_proj` üzerindeki LoRA, <0,3 WER maliyetiyle GPU belleğini 4 kat azaltır.
4. 10 saatten az süreniz varsa kodlayıcıyı dondurun. Yalnızca kod çözücüyü ayarlayın.
5. Whisper'ın kendi tokenizer ve prompt biçimini kullanın; asla tokenizer'leri değiştirmeyin.

Topluluk sonuçları: fine-tuning 20 saatlik tıbbi dikte ortamı, tıbbi kelime dağarcığında WER'yi %12'den %4,5'e düşürür. 4 saatlik İzlandacadaki Fine-tuning Turbo, WER'yi %18'den %6'ya düşürüyor.

## İnşa Et

### Adım 1: Whisper'ı kutudan çıkarın

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

Her zaman geçersiz kılmanız gereken anahtar varsayılanlar: `temperature=0.0` (örnekleme varsayılanı 0,0 → 0,2 → 0,4 … geri dönüş zinciridir), `condition_on_previous_text=False` (basamaklı halüsinasyon sorununu önler) ve `no_speech_threshold=0.6` (sessizlik tespiti).

### Adım 2: parçalanmış uzun biçim

```python
# whisperx is the 2026 reference for long-form with word-level timestamps
import whisperx
model = whisperx.load_model("large-v3-turbo", device="cuda", compute_type="float16")
segments = model.transcribe("1hour.mp3", batch_size=16, chunk_size=30)
```

WhisperX, (1) Silero VAD geçişi, (2) wav2vec 2.0 aracılığıyla kelime düzeyinde hizalama, (3) `pyannote.audio` aracılığıyla günlükleştirme ekler. Prodüksiyon transkripsiyonuna yönelik 2026'nın en güçlüsü.

### 3. Adım: LoRA ile ince ayar yapın

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

Daha sonra standart Trainer döngüsü. Her 1000 adımda bir kontrol noktası oluşturun. Uzatılmış durumda WER ile değerlendirin.

### Adım 4: her katmanın ne öğrendiğini inceleyin

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

Bir ısı haritasıyla görselleştirin; kod çözücü adımları kodlayıcı çerçevelerini tararken çapraz hizalamayı göreceksiniz. Bu köşegen, Whisper'ın sözcük zaman damgaları kavramıdır.

## Kullan onu

2026 yığını:

| Durum | Seç |
|-----------|------|
| Genel İngilizce, çevrimdışı | `whisperx` aracılığıyla büyük-v3-turbo |
| Mobil / kenar | Whisper-Tiny nicemlenmiş (int8) veya Moonshine |
| Çok dilli uzun biçim | `whisperx` + günlük oluşturma yoluyla Large-v3 |
| Düşük kaynaklı dil | LoRA ile Orta veya Turbo'ya ince ayar yapın |
| Akış (2 sn gecikme) | Fısıltı Yayını veya Muhabbetkuşu-TDT |
| Kelime düzeyinde zaman damgaları | WhisperX (wav2vec 2.0 aracılığıyla zorunlu hizalama) |

`faster-whisper` (CTranslate2 arka ucu), 2026'daki en hızlı CPU+GPU inference çalışma zamanıdır — aynı çıktıyla vanilyadan 4 kat daha hızlıdır.

## 2026'da hâlâ gönderilecek tuzaklar

- **Sessizlikle ilgili halüsinasyonlu metin.** Altyazılarla eğitilen fısıltı, "İzlediğiniz için teşekkürler!", "Abone olun!", şarkı sözlerini içerir. Aramadan önce daima VAD-gate'i kullanın.
- **`condition_on_previous_text` çağlayan.** Bir halüsinasyon sonraki pencereleri kirletir. Parçalar arasında akıcılığa ihtiyaç duymadığınız sürece `False`'yi ayarlayın.
- **Kısa klip dolgusu.** 30 saniyeye kadar doldurulmuş 2 saniyelik bir klip, sondaki sessizlikte halüsinasyon yaratabilir. `pad=False` veya VAD geçidini kullanın.
- **Yanlış mel istatistikleri.** Whisper'ınki yerine librosa'nın mellerini kullanmak neredeyse rastgele çıktı üretir. `whisper.audio.log_mel_spectrogram` kullanın.

## Gönderin

`outputs/skill-whisper-tuner.md` olarak kaydet. Belirli bir etki alanı için bir Whisper ince ayarı veya inference ardışık düzeni tasarlayın.

## Egzersizler

1. **Kolay.** `code/main.py` komutunu çalıştırın. tokenFısıltı stilinde bir prompt oluşturur, kodu çözülmüş şekil bütçelerini hesaplar ve 10 dakikalık bir klip için yığın programını yazdırır.
2. **Medium.** `faster-whisper` yükleyin, 10 dakikalık bir podcast'i yazıya dökün, WER'yi insan transkriptiyle karşılaştırın. `language="auto"` ve zorunlu `language="en"` karşılaştırmasını deneyin.
3. **Zor.** HF `datasets` kullanarak, Whisper'ın zorlandığı bir dil seçin (e.g., Urduca), Medium'da LoRA ile 2 saat boyunca 2 dönem boyunca ince ayar yapın ve WER deltasını bildirin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| 30 saniyelik pencere | Fısıltı sınırı | Sert giriş kapağı; daha uzun ses parçası. |
| SOT | Transkriptin başlangıcı | `<\|startoftranscript\|>`, prompt kod çözücüyü başlatır. |
| Zaman Damgaları token | Zamansal hizalama | Her 0,02 saniyelik kayma, 51k kelime haznesinde özel bir token'dir. |
| Turbo | Hızlı değişken | 4 kod çözücü katmanı, 8 kat daha hızlı, <%1 WER regresyonu. |
| WhisperX | Uzun biçimli ambalaj | VAD + Whisper + wav2vec hizalama + günlük oluşturma. |
| LoRA ince ayar | Verimli ayarlama | Düşük dereceli adaptörleri dikkatinize ekleyin; Paramların ~%0,3'ünü eğitin. |
| Halüsinasyon | Sessiz başarısızlık | Whisper, gürültü/sessizlikten akıcı İngilizce üretir. |

## Daha Fazla Okuma

-[Radford ve ark. (2022). Fısıltı kağıdı](https://arxiv.org/abs/2212.04356) — orijinal mimari ve eğitim tarifi.
- [OpenAI (2024). Whisper Large-v3-turbo sürümü](https://github.com/openai/whisper/discussions/2363) — 4 katmanlı kod çözücü, 8 kat hızlanma.
- [Bain ve ark. (2023). WhisperX](https://arxiv.org/abs/2303.00747) — uzun biçimli, kelime hizalı, günlükleştirilmiş.
- [Systran — daha hızlı fısıltı repo](https://github.com/SYSTRAN/faster-whisper) — CTranslate2 destekli, 4 kat daha hızlı.
- [HuggingFace — Whisper ince ayar eğitimi](https://huggingface.co/blog/fine-tune-whisper) — standart LoRA / tam FT izlenecek yol.
