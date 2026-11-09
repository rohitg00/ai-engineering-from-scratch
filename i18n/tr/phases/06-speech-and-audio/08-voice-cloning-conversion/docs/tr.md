# Ses Klonlaması ve Ses Değişimi

> Ses klonlaması, metnizi başka birinin sesinde okuyor. Ses dönüşümü, sesinizi başka birinin sesine yeniden yazarken söylediğiniz şeyi korur. İkisi de aynı parçalanmaya bağlıdır: konuşmacı kimliğini içeriğinden ayırır.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 07 (TTS)
**Time:** ~75 minutes

## Sorun

2026 yılında, bir tüketici GPU ile herkesin sesinin yüksek kaliteli bir klonunu üretmek için 5 saniyelik bir ses klipi yeterlidir. ElevenLabs, F5-TTS, OpenVoice v2, VoiceBox hepsi sıfır çekim veya birkaç çekim klonlamasını gönderir. Teknoloji bir nimettir (erkinlik TTS, dublajlama, yardımcı sesler) ve bir silah (scam aramaları, siyasi derin sahtekarlıklar, IP hırsızlığı).

İki yakın bağlantılı görev:

- **Voice cloning (TTS-side):**Metin + 5 saniye referans sesi → ses bu sesde.
- **Voice conversion (speech-side):**Kaynak ses ( kişi A'nın X'i söyleyerek) + kişi B'nin referans sesi → B'nin X'i söyleyerek ses.

Her ikisi de dalga şeklini ( içeriği, hoparlör, prosodi) oluşturur ve bir kaynaktan hoparlörle diğerinden içeriği yeniden birleştirir.

2026 ' da şimdi gemiye gireceğiniz temel bir kısıtlama:**watermarking and consent gates are legally required in the EU (AI Act, enforceable August 2026) and in California (AB 2905, effective 2025)**- Boru hattınız sessiz bir su işaretini yaymalı ve konsensüs dışı klonları reddetmeli.

## Anlaşım

![Voice cloning vs conversion: factorize, swap speaker, recombine](../assets/voice-cloning.svg)

**Zero-shot cloning.**Binlerce hoparlör üzerinde eğitilmiş bir modele 5 saniyelik bir klip geçirin. Konuşmacı kodlayıcı klipini hoparlör yerleştirme kartı yapar; TTS dekodörü bu yerleştirme ek metinde koşullar oluşturur.

F5-TTS (2024), YourTTS (2022), XTTS v2 (2024), OpenVoice v2 (2024) tarafından kullanılır.

**Few-shot fine-tuning.**Bu nedenle, bu programın en iyi yönü, bir saatlik bir süre için bir temel modelin ayarlanmasıdır.

**Voice conversion (VC).**İki aile:

- **Recognition-synthesis.**İçerik temsilini çıkarmak için ASR benzeri bir model çalıştırın (örneğin yumuşak fonem pozteriyeleri, PPG), sonra hedef hoparlör yerleştirme ile yeniden sentez edin. Dil ve aksan için sağlam. KNN-VC (2023), Diff-HierVC (2023) tarafından kullanılır.
- **Disentanglement.**İçerik, hoparlör ve prosodiyi şişek boynunda gizli bir alanda ayıran bir oto-kodlayıcı eğit. Sonucunda hoparlör yerleştirme. Daha düşük kalite ama daha hızlı. AutoVC (2019), VITS-VC çeşitleri tarafından kullanılır.

**Neural codec-based cloning (2024+).**VALL-E, VALL-E 2, NaturalSpeech 3, VoiceBox  sesleri SoundStream / EnCodec'den ayrı bir token olarak değerlendirir, kodek tokenlerine karşı büyük bir autoregressive veya akış eşleşme modeli eğitir.

### Etik kısım, bir şapka değil.

**Watermarking.**PerTh (Perth) ve SilentCipher (2024) sesle ~16-32 bit bir ID'yi fark edilemez şekilde yerleştirir. Yeniden kodlama, akış ve ortak düzenlemeler hayatta kalır. Üretim hazır açık kaynak.

**Consent gates.**Her klon edilmiş çıkışın doğrulanabilir bir onay kaydı ile eşleştirilmesi gerekir. "Ben, Rohit, 2026-04-22'de bu sesin X amaçlı yetkisi veriliyor".

**Detection.**AASIST, RawNet2 ve Wav2Vec2-AASIST, detektör olarak gemiyi gönderdi. ASVspoof 2025 meydan okuma, ElevenLabs, VALL-E 2 ve Bark çıkışlarına karşı en son detektörler için 0.82.3% EER'leri yayınladı.

### Sayılar (2026)

| Model | Zero-shot? | SECS (target sim) | WER (intel.) | Params |
|-------|-----------|--------------------|--------------|--------|
| F5-TTS | Yes | 0.72 | 2.1% | 335M |
| XTTS v2 | Yes | 0.65 | 3.5% | 470M |
| OpenVoice v2 | Yes | 0.70 | 2.8% | 220M |
| VALL-E 2 | Yes | 0.77 | 2.4% | 370M |
| VoiceBox | Yes | 0.78 | 2.1% | 330M |

SECS > 0,70 çoğu dinleyiciler için hedeften genel olarak ayırt edilemez.

```figure
sp-voice-factorize
```

## Yapın

### Adım 1: Tanım-sentez ile parçalan (main.py'de sadece kodla gösterim)

```python
def clone_pipeline(ref_audio, text, target_embedder, tts_model):
    speaker_emb = target_embedder.encode(ref_audio)
    mel = tts_model(text, speaker=speaker_emb)
    return vocoder(mel)
```

Konseptik olarak basit; uygulama kütlesi `tts_model`Ve hoparlör kodlayıcı.

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

Referans transkripti sesle tam olarak eşleşmelidir; eşleşme uyumsuzluğu keser.

### Adım 3: KNN-VC ile ses dönüşümü

```python
import torch
from knnvc import KNNVC  # 2023 model, https://github.com/bshall/knn-vc
vc = KNNVC.load("wavlm-base-plus")
out_wav = vc.convert(source="my_voice.wav", target_pool=["alice_1.wav", "alice_2.wav"])
```

KNN-VC, kaynak ve hedef havuz için çerçeve içeriklerini çıkarmak için WavLM'i çalıştıracak, ardından her kaynak çerçeveyi havuzdaki en yakın komşusuyla değiştirir.

### Dördüncü adım: Su işaretini yerleştir

```python
from silentcipher import SilentCipher
sc = SilentCipher(model="2024-06-01")
payload = b"consent_id:abc123;ts:1745353200"
watermarked = sc.embed(wav, sr=24000, message=payload)
detected = sc.detect(watermarked, sr=24000)   # returns payload bytes
```

~ 32 bit yararlı yük, MP3 yeniden kodlaması ve hafif gürültüden sonra tespit edilebilir.

### Adım 5: İzn verme kapısı

```python
def cloned_inference(text, ref_audio, consent_record):
    assert verify_signature(consent_record), "Signed consent required"
    assert consent_record["speaker_id"] == hash_speaker(ref_audio)
    wav = tts.infer(ref_file=ref_audio, gen_text=text)
    wav = watermark(wav, payload=consent_record["id"])
    return wav
```

## Kullan

2026'da:

| Situation | Pick |
|-----------|------|
| 5-sec zero-shot clone, open-source | F5-TTS or OpenVoice v2 |
| Commercial production cloning | ElevenLabs Instant Voice Clone v2.5 |
| Voice conversion (rewriting) | KNN-VC or Diff-HierVC |
| Many-speaker fine-tune | StyleTTS 2 + speaker adapter |
| Cross-lingual cloning | XTTS v2 or VALL-E X |
| Deepfake detection | Wav2Vec2-AASIST |

## Tuzaklar

- **Misaligned reference transcript.**F5-TTS ve benzeri, referans metnini, noktalama dahil olmak üzere referans sesine tam olarak eşleştirmesini gerektirir.
- **Reverberant reference.**Echo klonu öldürür.
- **Emotional mismatch.**Eğitim referansı "sevinçli" her şeyin sevinçli klonlarını üretir.
- **Language leakage.**İngilizce konuşan bir kişiyi klonlamak ve modelden Fransızca konuşmasını istemek genellikle aksanı taşır; diller arası modeller kullanın (XTTS, VALL-E X).
- **No watermark.**2026 Ağustos'tan itibaren AB'de yasal olarak gönderilemez.

## Gönder

- Kaydet .`outputs/skill-voice-cloner.md`. İzin verme kapısı + su işaretleri + kalite hedefi ile klonlama veya dönüşüm boru hattı tasarlayın.

## Egzersizler

1. **Easy.**Çık .`code/main.py`. Konuşmacı-içerilen değişimi iki "düşenç" arasındaki kosinus'u hesaplayarak gösterir.
2. **Medium.**OpenVoice v2'yi kullanarak kendi sesini klonlayın. Referans ve klon arasındaki SECS'i ölçün.
3. **Hard.**SilentCipher su işaretini 20 klona uygulayın, 128 kbps MP3 kodlama + çözümü ile çalıştırın, yararlı yükü tespit edin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Zero-shot clone | 5 seconds is enough | Pretrained model + speaker embedding; no training. |
| PPG | Phonetic posteriorgram | Per-frame ASR posteriors used as language-agnostic content rep. |
| KNN-VC | Nearest-neighbor conversion | Replace each source frame with nearest target-pool frame. |
| Neural codec TTS | VALL-E style | AR model over EnCodec/SoundStream tokens. |
| Watermark | Inaudible signature | Bits embedded in audio, survive re-encode. |
| SECS | Cloning fidelity | Cosine between target and clone speaker embeddings. |
| AASIST | Deepfake detector | Anti-spoof model; detects synthesized speech. |

## Daha Fazla Okumak

- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) Açık kaynaklı SOTA sıfır çekim klonlaması.
- [Baevski et al. / Microsoft (2023). VALL-E](https://arxiv.org/abs/2301.02111)ve [VALL-E 2 (2024)](https://arxiv.org/abs/2406.05370) Nöral kodek TTS.
- [Qian et al. (2019). AutoVC](https://arxiv.org/abs/1905.05879) Çelişki tabanlı ses dönüşümü.
- [Baas, Waubert de Puiseau, Kamper (2023). KNN-VC](https://arxiv.org/abs/2305.18975) Arama tabanlı VC.
- [SilentCipher (2024) — Audio Watermarking](https://github.com/sony/silentcipher) 32 bitlik ses su işaretleri üretime hazır.
- [ASVspoof 2025 results](https://www.asvspoof.org/) Detektor vs. sentesizer silah yarışı, 2026'da güncellenmiştir.
