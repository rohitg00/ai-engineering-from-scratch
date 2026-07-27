# Ses Klonlama ve Ses Dönüştürme

> Ses klonlama, metninizi başka birinin sesiyle okur. Ses dönüştürme, söylediklerinizi korurken sesinizi başka birinin sesine yeniden yazar. Her ikisi de aynı ayrıştırmaya dayanıyor: Konuşmacı kimliğini içerikten ayırmak.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 6 · 06 (Konuşmacı Tanıma), Aşama 6 · 07 (TTS)
**Süre:** ~75 dakika

## Sorun

2026'da, tüketici GPU'su ile herkesin sesinin yüksek kaliteli bir kopyasını oluşturmak için 5 saniyelik bir ses klibi yeterli olacaktır. ElevenLabs, F5-TTS, OpenVoice v2 ve VoiceBox'un tümü sıfır atışlı veya birkaç atışlı klonlama sunar. Teknoloji bir nimettir (erişilebilirlik TTS, dublaj, yardımcı sesler) ve bir silahtır (dolandırıcılık aramaları, siyasi deepfakeler, IP hırsızlığı).

Birbiriyle yakından ilişkili iki görev:

- **Ses klonlama (TTS tarafı):** metin + 5 saniyelik referans sesi → söz konusu sesteki ses.
- **Ses dönüşümü (konuşma tarafı):** kaynak ses (A kişisi X diyor) + B kişisinin referans sesi → B'nin X söylediği ses.

Her ikisi de bir dalga biçimini (içerik, konuşmacı, prozodi) hesaba katar ve bir kaynaktan gelen içeriği diğerinden gelen konuşmacıyla yeniden birleştirir.

2026'da gönderim yapacağınız temel kısıtlamalar: **filigranlama ve izin kapıları AB'de (AI Yasası, Ağustos 2026'da yürürlüğe girecek) ve Kaliforniya'da (AB 2905, 2025'ten itibaren geçerli olacak) yasal olarak zorunludur**. Boru hattınız duyulamayan bir filigran yaymalı ve rıza dışı klonları reddetmelidir.

## Konsept

![Ses klonlama ve dönüştürme: çarpanlara ayırma, hoparlörü değiştirme, yeniden birleştirme](../assets/voice-cloning.svg)

**Sıfır atışlı klonlama.** Binlerce hoparlörle eğitilmiş bir modele 5 saniyelik bir klip aktarın. Hoparlör kodlayıcı, klibi bir hoparlör embedding ile eşleştirir; TTS kod çözücü koşulları bu embedding artı metin üzerinde gerçekleşir.

Kullanan: F5-TTS (2024), YourTTS (2022), XTTS v2 (2024), OpenVoice v2 (2024).

**Birkaç atış fine-tuning.** Hedef sesi 5-30 dakika kaydedin. LoRA temel modele bir saat boyunca ince ayar yapın. Kalite "iyi"den "ayırt edilemez"e sıçrar. Coqui ve ElevenLabs'ın ikisi de bu modeli destekliyor; topluluk bunu F5-TTS ile kullanıyor.

**Ses dönüştürme (VC).** İki aile:

- **Tanıma sentezi.** İçerik temsilini (e.g., yumuşak fonem sonuncuları, PPG'ler) çıkarmak için ASR benzeri modeli çalıştırın, ardından hedef hoparlör embedding ile yeniden sentezleyin. Dile ve aksana karşı dayanıklıdır. KNN-VC (2023), Diff-HierVC (2023) tarafından kullanılmaktadır.
- **Çözme.** Darboğazdaki gizli alanda içeriği, konuşmacıyı ve prozodiyi ayıran bir otomatik kodlayıcı eğitin. embedding hoparlörünü inference'den değiştirin. Daha düşük kalite ama daha hızlı. AutoVC (2019), VITS-VC çeşitleri tarafından kullanılır.

**Nöral codec tabanlı klonlama (2024+).** VALL-E, VALL-E 2, NaturalSpeech 3, VoiceBox — sesi SoundStream / EnCodec'ten ayrı token'ler olarak ele alın, codec token'ler üzerinden büyük bir otoregresif veya akış eşleştirme modeli eğitin. Kısa prompt'lerde ElevenLabs ile karşılaştırılabilir kalite.

### Etik kısmı, cıvatalı bağlantı değil

**Filigran.** PerTh (Perth) ve SilentCipher (2024), sese fark edilmeyecek şekilde ~16-32 bitlik bir kimlik yerleştirir. Yeniden kodlama, akış ve yaygın düzenlemelere rağmen hayatta kalır. Üretime hazır açık kaynak.

**Onay kapıları.** Klonlanan her çıktıyı doğrulanabilir bir izin kaydıyla eşleştirmesi gerekir. "Ben, Rohit, 2026-04-22 tarihinde bu sese X amacıyla yetki veriyorum." Kurcalanmaya açık bir kayıtta saklayın.

**Algılama.** AASIST, RawNet2 ve Wav2Vec2-AASIST dedektör olarak gönderilir. ASVspoof 2025 mücadelesinde ElevenLabs, VALL-E 2 ve Bark çıkışlarına karşı son teknoloji ürünü dedektörler için %0,8-2,3'lük EER'ler yayınlandı.

### Sayılar (2026)

| Modeli | Sıfır atış mı? | SECS (hedef sim) | WER (istihbarat) | Parametreler |
|-------|-----------|--------------------|--------------|--------|
| F5-TTS | Evet | 0,72 | %2,1 | 335M |
| XTTS v2 | Evet | 0,65 | %3,5 | 470M |
| OpenVoice v2 | Evet | 0,70 | %2,8 | 220M |
| VAL-E 2 | Evet | 0,77 | %2,4 | 370M |
| Ses Kutusu | Evet | 0,78 | %2,1 | 330M |

SECS > 0,70 çoğu dinleyici için genellikle hedeften ayırt edilemez.

## İnşa Et

### Adım 1: tanıma-sentez ile ayrıştırma (main.py'de yalnızca kod demosu)

```python
def clone_pipeline(ref_audio, text, target_embedder, tts_model):
    speaker_emb = target_embedder.encode(ref_audio)
    mel = tts_model(text, speaker=speaker_emb)
    return vocoder(mel)
```

Kavramsal olarak basit; uygulama kütlesi `tts_model` ve hoparlör kodlayıcısındadır.

### Adım 2: F5-TTS ile sıfır atışlı klon

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="rohit_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please add milk and bread to my list.",
)
```

Referans transkripti ses ile tam olarak eşleşmelidir; uyumsuzluk hizalamayı bozar.

### 3. Adım: KNN-VC ile ses dönüşümü

```python
import torch
from knnvc import KNNVC  # 2023 model, https://github.com/bshall/knn-vc
vc = KNNVC.load("wavlm-base-plus")
out_wav = vc.convert(source="my_voice.wav", target_pool=["alice_1.wav", "alice_2.wav"])
```

KNN-VC, kaynak ve hedef havuz için kare başına embedding'leri çıkarmak için WavLM'yi çalıştırır ve ardından her kaynak kareyi havuzdaki en yakın komşusuyla değiştirir. Parametrik olmayan, bir dakikalık hedef konuşmayla çalışır.

### Adım 4: filigran yerleştirin

```python
from silentcipher import SilentCipher
sc = SilentCipher(model="2024-06-01")
payload = b"consent_id:abc123;ts:1745353200"
watermarked = sc.embed(wav, sr=24000, message=payload)
detected = sc.detect(watermarked, sr=24000)   # returns payload bytes
```

~32 bitlik yük, MP3'ün yeniden kodlanması ve hafif gürültüden sonra algılanabilir.

### 5. Adım: izin kapısı

```python
def cloned_inference(text, ref_audio, consent_record):
    assert verify_signature(consent_record), "Signed consent required"
    assert consent_record["speaker_id"] == hash_speaker(ref_audio)
    wav = tts.infer(ref_file=ref_audio, gen_text=text)
    wav = watermark(wav, payload=consent_record["id"])
    return wav
```

## Kullan onu

2026 yığını:

| Durum | Seç |
|-----------|------|
| 5 saniyelik sıfır atışlı klon, açık kaynak | F5-TTS veya OpenVoice v2 |
| Ticari üretim klonlaması | ElevenLabs Anında Ses Klonu v2.5 |
| Ses dönüştürme (yeniden yazma) | KNN-VC veya Diff-HierVC |
| Çok hoparlörlü ince ayar | StyleTTS 2 + hoparlör adaptörü |
| Diller arası klonlama | XTTS v2 veya VALL-E X |
| Deepfake tespiti | Wav2Vec2-AASIST |

## Tuzaklar

- **Yanlış hizalanmış referans transkript.** F5-TTS ve benzeri, referans metninin, noktalama işaretleri dahil olmak üzere, referans sesle tam olarak eşleşmesini gerektirir.
- **Yankı referansı.** Echo klonu öldürür. Kuru, yakın mikrofonla kayıt yapın.
- **Duygusal uyumsuzluk.** "Neşeli" eğitim referansı her şeyin neşeli kopyalarını üretir. Referans duygusunu hedef kullanımla eşleştirin.
- **Dil sızıntısı.** İngilizce konuşan birini klonlamak ve ardından modelden Fransızca konuşmasını istemek çoğu zaman aksanı taşır; diller arası modelleri kullanın (XTTS, VALL-E X).
- **Filigran yok.** Ağustos 2026'dan itibaren AB'de yasal olarak gönderilemez.

## Gönderin

`outputs/skill-voice-cloner.md` olarak kaydedin. İzin kapısı + filigran + kalite hedefiyle bir klonlama veya dönüştürme ardışık düzeni tasarlayın.

## Egzersizler

1. **Kolay.** `code/main.py`'yi çalıştırın. İki "hoparlör" değiştirme öncesi ve sonrası arasındaki kosinüsü hesaplayarak hoparlör-embedding değişimini gösterir.
2. **Orta.** Kendi sesinizi kopyalamak için OpenVoice v2'yi kullanın. Referans ve klon arasındaki SECS'yi ölçün. Whisper aracılığıyla CER'yi ölçün.
3. **Zor.** SilentCipher filigranını 20 klona uygulayın, bunları 128 kbps MP3 kodlama+kod çözme yoluyla çalıştırın, yükü tespit edin. Bit doğruluğunu bildirin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| Sıfır atışlı klon | 5 saniye yeterli | Önceden eğitilmiş model + hoparlör embedding; eğitim yok. |
| PPG | Fonetik posteriorgram | Dilden bağımsız içerik temsilcisi olarak kullanılan kare başına ASR sondaları. |
| KNN-VC | En yakın komşu dönüşümü | Her kaynak çerçeveyi en yakın hedef havuz çerçevesiyle değiştirin. |
| Sinir codec'i TTS | VALL-E tarzı | EnCodec/SoundStream token'ler üzerinden AR modeli. |
| Filigran | Duyulmayan imza | Sese gömülü bitler yeniden kodlanarak hayatta kalır. |
| SEC | Klonlama doğruluğu | Hedef ve klon hoparlör embedding'ler arasındaki kosinüs. |
| AASİST | Deepfake dedektörü | Sahteciliğe karşı koruma modeli; sentezlenmiş konuşmayı algılar. |

## Daha Fazla Okuma

- [Chen ve ark. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) — açık kaynaklı SOTA sıfır atışlı klonlama.
- [Baevski ve ark. / Microsoft (2023). VALL-E](https://arxiv.org/abs/2301.02111) ve [VALL-E 2 (2024)](https://arxiv.org/abs/2406.05370) — sinir kodlayıcı TTS.
- [Qian ve ark. (2019). AutoVC](https://arxiv.org/abs/1905.05879) — çözülme tabanlı ses dönüşümü.
- [Baas, Waubert de Puiseau, Kamper (2023). KNN-VC](https://arxiv.org/abs/2305.18975) — erişim tabanlı VC.
- [SilentCipher (2024) — Ses Filigranı](https://github.com/sony/silentcipher) — üretime hazır 32 bit ses filigranı.
- [ASVspoof 2025 sonuçları](https://www.asvspoof.org/) — dedektör ile sentezleyici arasındaki silahlanma yarışı, 2026'da güncellendi.
