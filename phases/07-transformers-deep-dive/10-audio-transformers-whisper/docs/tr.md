# Ses Transformer'ler — Fısıltı Mimarisi

> Ses, frekansın zaman içerisindeki görüntüsüdür. Whisper, mel spektrogramlarını yiyip karşılık veren bir ViT'dir.

**Tür:** Öğren
**Diller:** Python
**Önkoşullar:** Aşama 7 · 05 (Tam Transformer), Aşama 7 · 08 (Kodlayıcı-Kod Çözücü), Aşama 7 · 09 (ViT)
**Süre:** ~45 dakika

## Sorun

Whisper'dan (OpenAI, Radford ve diğerleri 2022) önce, son teknoloji ürünü otomatik konuşma tanıma (ASR), wav2vec 2.0 ve HuBERT (kendi kendini denetleyen özellik çıkarıcılara ek olarak ince ayarlı bir kafa) anlamına geliyordu. Yüksek kaliteli, pahalı veri hatları, etki alanı açısından kırılgan. Çok dilli konuşma tanıma, dil ailesi başına ayrı modellere ihtiyaç duyuyordu.

Whisper üç bahis yaptı:

1. **Her konuda eğitim alın.** 97 dilde internetten alınan 680.000 saatlik zayıf etiketli ses. Temiz bir akademik külliyat yok. Ses etiketi yok.
2. **Çok görevli tek model.** Görev token'ler aracılığıyla transkripsiyon, çeviri, ses etkinliği algılama, dil kimliği ve zaman damgası konularında ortaklaşa eğitilen bir kod çözücü.
3. **Standart kodlayıcı-kod çözücü transformer.** Kodlayıcı, log-mel spektrogramlarını kullanır. Kod çözücü, token metinlerini otomatik regresif olarak üretir. Ses kodlayıcı yok, CTC yok, HMM yok.

Sonuç: Whisper Large-v3, sıfır temiz etiketli veri içeren aksanlara, gürültüye ve dillere karşı dayanıklıdır. Bu, 2026'daki her açık kaynaklı sesli asistan ve çoğu ticari asistan için varsayılan konuşma ön ucudur.

## Konsept

![Fısıltı hattı: ses → mel → kodlayıcı → kod çözücü → metin](../assets/whisper.svg)

### Adım 1 — yeniden örnekleme + pencere

16 kHz'de ses. 30 saniyeye kadar klipsleyin/pedleyin. Log-mel spektrogramını hesaplayın: 80 mel kutu, 10 ms adım → ~3.000 kare × 80 özellik. Bu, Whisper'ın gördüğü "giriş görüntüsüdür".

### Adım 2 – evrişimli kök

Çekirdek 3 ve adım 2'ye sahip iki Conv1D katmanı, 3.000 kareyi 1.500'e düşürür. Çok fazla parametre eklemeden dizi uzunluğunu yarıya indirir.

### Adım 3 — kodlayıcı

1.500 zaman adımının üzerinde 24 katmanlı (büyük için) transformer kodlayıcı. Sinüzoidal konumsal kodlama, kendine dikkat, GELU FFN. 1.500 × 1.280 gizli durum üretir.

### Adım 4 — kod çözücü

24 katmanlı bir transformer kod çözücü. Birkaç sese özgü özel token'ler ile GPT-2'lerin bir üst kümesi olan bir BPE sözlüğünden otomatik regresif olarak token'ler üretir.

### Adım 5 — görev token'ler

prompt kod çözücüsü, modele ne yapacağını söyleyen kontrol token'lerle başlar:

```
<|startoftranscript|>  <|en|>  <|transcribe|>  <|0.00|>
```

veya

```
<|startoftranscript|>  <|fr|>  <|translate|>   <|0.00|>
```

Model bu sözleşmeye göre eğitildi. Görevi önek ile kontrol edersiniz. Talimat ayarlamasının 2026 eşdeğeri, ancak konuşmaya uygulandı.

### Adım 6 — çıktı

Günlük prob eşiğiyle ışın arama (genişlik 5). Zaman damgaları, `<|notimestamps|>` token olmadığında sesin her 0,02 saniyesinde bir tahmin edilir.

### Fısıltı boyutları

| Model | Parametreler | Katmanlar | d_model | Kafalar | VRAM (fp16) |
|-------|--------|--------|---------|-------|-------------|
| minik | 39 milyon | 4 | 384 | 6 | ~1GB |
| Baz | 74 milyon | 6 | 512 | 8 | ~1GB |
| Küçük | 244 milyon | 12 | 768 | 12 | ~2GB |
| Orta | 769M | 24 | 1024 | 16 | ~5GB |
| Büyük | 1550M | 32 | 1280 | 20 | ~10GB |
| Büyük-v3 | 1550M | 32 | 1280 | 20 | ~10GB |
| Büyük-v3-turbo | 809M | 32 | 1280 | 20 | ~6 GB (4 katmanlı kod çözücü) |

Large-v3-turbo (2024), kod çözücüyü 32 katmandan 4,8 kat daha hızlı kod çözme işlemine, <1 WER noktası regresyonuyla kesti. Bu kod çözme hızı kilidinin açılması, 2026'da gerçek zamanlı ses agent'ler için Whisper-turbo'nun varsayılan olmasının nedenidir.

### Whisper'ın yapmadığı şeyler

- Günlük yok (kim konuşuyor). Bunun için pyannote ile eşleştirin.
- Yerel olarak gerçek zamanlı akış yok; 30 saniyelik pencere düzeltildi. Modern sarmalayıcılar (`faster-whisper`, `WhisperX`) VAD + örtüşme yoluyla akışa bağlanır.
- Harici yığınlama olmadan 30 saniyeyi aşan uzun biçimli bağlam yok. Pratikte iyi çalışıyor çünkü insan konuşması, transkripsiyon için nadiren uzun menzilli bağlama ihtiyaç duyuyor.

### 2026 manzarası

| Görev | Modeli | Notlar |
|------|-------|-------|
| İngilizce ASR | Fısıltı turbo, Ay Işığı | Moonshine kenarda 4 kat daha hızlı |
| Çok dilli ASR | Whisper-büyük-v3 | 97 dil |
| ASR Akışı | daha hızlı fısıltı + VAD | 150 ms gecikme hedeflerine ulaşılabilir |
| TTS | Piper, XTTS-v2, Kokoro | Kodlayıcı-kod çözücü deseni, ancak Fısıltı şeklinde |
| Ses + dil | AudioLM, SeamlessM4T | Metin token'ler + ses token'ler bir arada transformer |

## Build It — Kendin Oluştur

Bkz. `code/main.py`. Whisper'ı eğitmiyoruz; log-mel spektrogram hattını + görev-token prompt biçimlendiriciyi oluşturuyoruz. Bunlar üretimde aslında dokunduğunuz kısımlardır.

### 1. Adım: sesi sentezleyin

16 kHz'de örneklenmiş 440 Hz'de 1 saniyelik sinüs dalgası oluşturun. 16.000 örnek.

### Adım 2: log-mel spektrogramı (basitleştirilmiş)

Tam mel spektrogramının FFT'ye ihtiyacı vardır. `librosa` gerektirmeden boru hattını gösteren basitleştirilmiş bir çerçeveleme + çerçeve başına enerji sürümü yapıyoruz:

```python
def frame_signal(x, frame_size=400, hop=160):
    frames = []
    for start in range(0, len(x) - frame_size + 1, hop):
        frames.append(x[start:start + frame_size])
    return frames
```

Çerçeve = 25 ms, atlama = 10 ms. Whisper'ın pencerelemesiyle eşleşir. Pedagojide çerçeve başına enerji, mel kutularının yerine geçer.

### Adım 3: 30 saniyeye tamamlayın

Whisper her zaman 30 saniyelik parçaları işler. Spektrogramı 3.000 kareye kadar doldurun (veya kırpın).

### Adım 4: prompt token'leri oluşturun

```python
def whisper_prompt(lang="en", task="transcribe", timestamps=True):
    tokens = ["<|startoftranscript|>", f"<|{lang}|>", f"<|{task}|>"]
    if not timestamps:
        tokens.append("<|notimestamps|>")
    return tokens
```

Görev kontrol yüzeyinin tamamı budur. 4-token öneki.

## Use It — Uygula

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("meeting.wav", language="en", task="transcribe")
print(result["text"])
print(result["segments"][0]["start"], result["segments"][0]["end"])
```

Daha hızlı, OpenAI uyumlu:

```python
from faster_whisper import WhisperModel
model = WhisperModel("large-v3-turbo", compute_type="int8_float16")
segments, info = model.transcribe("meeting.wav", vad_filter=True)
for s in segments:
    print(f"{s.start:.2f} - {s.end:.2f}: {s.text}")
```

**2026'da Whisper'ı ne zaman seçmelisiniz:**

- Tek modelle çok dilli ASR.
- Gürültülü, çeşitli seslerin sağlam transkripsiyonu.
- ASR araştırması / prototipi — en hızlı başlangıç ​​noktası.

**Ne zaman başka bir şey seçmelisiniz:**

- Uçta ultra düşük gecikme süreli yayın — Moonshine, Whisper'ı eş kalitede yener.
- 200 ms'den kısa bir süre gerektiren gerçek zamanlı konuşma yapay zekası — özel akışlı ASR.
- Konuşmacı günlüğü — Whisper bunu yapmaz; Pyannote'a cıvata.

## Ship It — Kullanıma Sun

Bkz. `outputs/skill-asr-configurator.md`. Beceri, yeni bir konuşma uygulaması için bir ASR modeli, kod çözme parametreleri ve ön işleme hattını seçer.

## Egzersizler

1. **Kolay.** `code/main.py` komutunu çalıştırın. 10 ms atlama ile 16 kHz'de 1 saniyelik bir sinyal için kare sayısının ~100 kare olduğunu doğrulayın. 30 saniye boyunca: ~3.000 kare.
2. **Orta.** `numpy.fft` kullanarak tam log-mel spektrogramını oluşturun. 80 mel kutunun `librosa.feature.melspectrogram(n_mels=80)` ile sayısal hata dahilinde eşleştiğini doğrulayın.
3. **Zor.** inference akışını uygulayın: sesi 2 sn'lik örtüşmeyle 10 sn'lik pencerelere bölün, her parçada Whisper'ı çalıştırın, transkriptleri birleştirin. 5 dakikalık bir podcast örneğinde kelime hatası oranını tek geçişe karşı ölçün.

## Anahtar Terimler

| Terim | Yaygın ifade | Gerçek anlamı |
|------|-----------------|-----------------------|
| Mel spektrogramı | "Ses görüntüsü" | 2B gösterim: bir eksende frekans bölmeleri, diğerinde zaman çerçeveleri; Hücre başına log ölçekli enerji. |
| Log-mel | "Whisper'ın gördüğü şey" | Mel spektrogramı kütükten geçti; insanın ses yüksekliği algısına yakındır. |
| Çerçeve | "Tek zaman dilimi" | 25 ms'lik örnek penceresi; 10 ms'lik adımlarla örtüşüyor. |
| Görev token | "Prompt konuşma öneki" | prompt kod çözücüdeki `<\|transcribe\|>` / `<\|translate\|>` gibi özel token'ler. |
| Ses etkinliği algılama (VAD) | "Konuşmayı bul" | ASR öncesi sessizliği ortadan kaldıran kapı; maliyetleri büyük ölçüde azaltır. |
| CTC | "Bağlantıcı Zamansal Sınıflandırma" | Hizalama gerektirmeyen eğitim için klasik ASR kaybı; Whisper bunu KULLANMAZ. |
| Fısıltı turbo | "Küçük kod çözücü, tam kodlayıcı" | büyük v3 kodlayıcı + 4 katmanlı kod çözücü; 8 kat daha hızlı kod çözme. |
| Daha hızlı fısıltı | "Üretim ambalajı" | CTranslate2'nin yeniden uygulanması; int8 nicemleme; OpenAI'nin referansından 4 kat daha hızlı. |

## Daha Fazla Okuma

-[Radford ve ark. (2022). Büyük Ölçekli Zayıf Denetim aracılığıyla Güçlü Konuşma Tanıma](https://arxiv.org/abs/2212.04356) — Fısıltı kağıdı.
- [OpenAI Whisper repo](https://github.com/openai/whisper) — referans kodu + model ağırlıkları. Conv1D kök + kodlayıcı + kod çözücüyü yukarıdan aşağıya ~400 satırda görmek için `whisper/model.py` okuyun.
- [OpenAI Whisper — `whisper/decoding.py`](https://github.com/openai/whisper/blob/main/whisper/decoding.py) — 5. ve 6. Adımlarda açıklanan ışın arama + görev-token mantığı buradadır; 500 satır, tamamen okunabilir.
- [Baevski ve ark. (2020). wav2vec 2.0: Konuşma Temsillerinin Kendi Kendine Denetimli Öğrenimi için bir Framework](https://arxiv.org/abs/2006.11477) — öncü; bazı ayarlarda hala SOTA özellikleri var.
- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) — üretim sarmalayıcı, referanstan 4 kat daha hızlı.
- [Jia ve diğerleri. (2024). Moonshine: Canlı Transkripsiyon ve Sesli Komutlar için Konuşma Tanıma](https://arxiv.org/abs/2410.15608) — 2024 kenar dostu ASR, Fısıltı şeklinde ancak daha küçük.
- [HuggingFace blogu — "🤗 Transformers" ile Çok Dilde ASR İçin İnce Ayar Fısıltı](https://huggingface.co/blog/fine-tune-whisper) — mel spektrogram ön işlemcisi ve token-zaman damgası işlemeyi içeren kanonik fine-tuning tarifi.
- [HuggingFace `modeling_whisper.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/whisper/modeling_whisper.py) — dersin mimari diyagramını yansıtan tam uygulama (kodlayıcı, kod çözücü, çapraz dikkat, oluşturma).
