# Müzik Generi  MusicGen, Stable Audio, Suno ve Lisanslı Deprem

> 2026 müzik jenerasyonu: Suno v5 ve Udio v4 ticari olarak baskın; MusicGen, Stable Audio Open ve ACE-Step açık kaynaklı liderlik etmektedir. Teknik sorun çoğunlukla çözülmüştür. Hukuki sorun (Warner Music $ 500M anlaşması, UMG anlaşması) 2025-2026 yıllarında alanı yeniden şekillendirdi.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms), Phase 4 · 10 (Diffusion Models)
**Time:** ~75 minutes

## Sorun

Metin → 30 saniyelik 4 dakikalık bir müzik klipi, sözcük, vokal ve yapı ile.

1. **Instrumental generation.**"Lof-fi hip-hop davulları sıcak anahtarlarla" gibi metinler → ses. MusicGen, Stable Audio, AudioLDM.
2. **Song generation (with vocals + lyrics).**"Yağmurlu Teksas gecelerinden bahseden bir ülke şarkısı" → tam şarkı.
3. **Conditional / controllable.**Bir klip uzatmak, bir köprü, değişim türü, kök-ayrı veya boya yeniden oluşturmak.

## Anlaşım

![Music generation: token-LM vs diffusion, the 2026 model map](../assets/music-generation.svg)

### Nöral kodek tokenlerine karşı LM simgesi

Meta'lar **MusicGen**(2023, MIT) ve birçok türlü: metin/melodi yerleşimleri koşulları, autoregressiv olarak EnCodec tokenlerini (32 kHz, 4 kod kitabı) öngörür, EnCodec ile çözülür. 300M - 3.3B parametreleri. Güçlü bir başlangıç çizgisi; 30 saniye geçmeden mücadele eder.

**ACE-Step**(açık kaynaklı, Nisan 2026'da yayınlanan 4B XL) bu, Suno'ya en yakın açık toplumun tüm şarkı sözcükleri ile ilişkili nesli için uzanıyor.

### Erimiş veya gizli olanlarda yayılma

**Stable Audio (2023)**ve **Stable Audio Open (2024)**Sıkıştırılmış ses üzerinde gizli yayılma. Çubuklarda, ses tasarımında, ortam dokularında mükemmel.

**AudioLDM / AudioLDM2**T2I tarzı gizli yayımı yoluyla metin- ses, müzik, ses efektleri, konuşma genelleştirilmiştir.

### Hibrit (prodüksiyon)  Suno, Udio, Lyria

Kapalı ağırlıklar. Muhtemelen AR kodek LM + difüzyon tabanlı vokodör uzman ses / davul / melodi başları ile. Suno v5 (2026) ELO 1293 kalite lideri. Udio v4 boyanma + kök ayrımı (bas, davul, vokal ayrı indirmeler) ekler.

### Değerlendirme

- **FAD (Fréchet Audio Distance).**VGGish veya PANN özelliklerini kullanarak oluşturulan ve gerçek ses dağıtımları arasındaki yerleştirme seviyesindeki mesafe. Daha düşük daha iyidir. MusicGen küçük: MusicCaps'ta 4.5 FAD; SOTA ~3.0.
- **Musicality (subjective).**İnsan tercihleri. Suno v5 ELO 1293 liderleri.
- **Text-audio alignment.**CLAP puanı, hemen çıkış ve çıkış arasında.
- **Musicality artifacts.**Çatışmadan geçişler, sesli cümle sürüşü, 30 saniye sonra yapının kaybı.

## 2026 model haritası

| Model | Params | Length | Vocals | License |
|-------|--------|--------|--------|---------|
| MusicGen-large | 3.3B | 30 s | no | MIT |
| Stable Audio Open | 1.2B | 47 s | no | Stability non-commercial |
| ACE-Step XL (Apr 2026) | 4B | &gt; 2 min | yes | Apache-2.0 |
| YuE | 7B | &gt; 2 min | yes, multilingual | Apache-2.0 |
| Suno v5 (closed) | ? | 4 min | yes, ELO 1293 | commercial |
| Udio v4 (closed) | ? | 4 min | yes + stems | commercial |
| Google Lyria 3 (closed) | ? | real-time | yes | commercial |
| MiniMax Music 2.5 | ? | 4 min | yes | commercial API |

## Yasal manzarası (2025-2026)

- **Warner Music vs Suno settlement.**WMG şimdi Suno'da AI-e benzerlik, müzik hakları ve kullanıcı tarafından oluşturulan parçaları denetlemektedir.
- **EU AI Act**+ **California SB 942**: Yapay zeka tarafından üretilen müzik açıklanmalıdır.
- **Riffusion / MusicGen**MIT'de uyumluluk bagajı yok ama aynı zamanda ticari sesler de yok.

Geminin güvenli olması için düzenler:

1. Sadece enstrümanal (MusicGen, Stable Audio Open, MIT/CC0 çıkışları) oluşturun.
2. Bir nesle lisanslı ticari API'ler (Suno, Udio, ElevenLabs Music) kullanın.
3. Ekipçiliğin sahibi veya lisanslı bir katalog üzerinde çalışmak (çoğu işletme burada biter).
4. Su işaretleri + metadata ile nesilleri etiketleyin.

```figure
sp-codec-tokens
```

## Yapın

### Adım 1: MusicGen ile oluştur

```python
from audiocraft.models import MusicGen
import torchaudio

model = MusicGen.get_pretrained("facebook/musicgen-small")
model.set_generation_params(duration=10)
wav = model.generate(["upbeat synthwave with driving drums, 128 BPM"])
torchaudio.save("out.wav", wav[0].cpu(), 32000)
```

Üç boyut:`small`(300M, hızlı),`medium`(1.5B), `large`(3.3B) Küçüklik "İdeyanın yerleşmesini sağlar".

### Adım 2: Melodi şartlandırması

```python
melody, sr = torchaudio.load("humming.wav")
wav = model.generate_with_chroma(
    ["jazz piano cover"],
    melody.squeeze(),
    sr,
)
```

MusicGen-melody bir kromatogram alır ve timbreyi değiştirirken melodiyi korur.

### Adım 3: FAD değerlendirme

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()

fad.get_fad_score("generated_folder/", "reference_folder/")
```

VGGish yerleştirme mesafesini hesaplar. Genre seviyesindeki gerileme testleri için kullanışlı; insan dinleyiciler için bir yedek değil.

### Adım 4: LLM-müzik iş akışına eklenmek

Ders 7-8'den alınan fikirlerle birleştir:

```python
prompt = "Write a 30-second jazz loop. Describe the drums, bass, and piano voicing."
description = llm.complete(prompt)
music = musicgen.generate([description], duration=30)
```

## Kullan

| Goal | Stack |
|------|-------|
| Instrumental sound design | Stable Audio Open |
| Game / adaptive music | Google Lyria RealTime (closed) |
| Full songs with vocals (commercial) | Suno v5 or Udio v4 with explicit license |
| Full songs with vocals (open) | ACE-Step XL or YuE |
| Short ad jingle | MusicGen melody-conditioned on a hummed reference |
| Music-video background | MusicGen + Stable Video Diffusion |

## 2026'da hala yolculuk eden tuzaklar

- **Copyright-laundering prompts.**"Taylor Swift tarzı şarkı"  ticari Suno/Udio filtresi şimdi, açık modeller değil.
- **Repetition / drift past 30 s.**AR modelleri döngü. Çoklu nesiller çaprazlama veya yapısal tutarlılık için ACE-Step kullanın.
- **Tempo drift.**Modeller BPM'den uzaklaşır.`beat_track`- Evet .
- **Vocal intelligibility.**Suno mükemmel; açık modeller genellikle kelimeler konusunda gevşek.
- **Mono output.**Açık modeller mono veya sahte stereo üretir. Doğru bir stereo yeniden yapılandırması ile yükselt (örneğin, Cartesia'nın stereo yayılması).

## Gönder

- Kaydet .`outputs/skill-music-designer.md`. Müzik-gen dağıtımı için model seçin, lisans stratejisi, uzunluk / yapı planı ve açıklama metadataları.

## Egzersizler

1. **Easy.**Çık .`code/main.py`. Bir "generatif" akord ilerleme + ASCII sembolleri olarak davul örneği üretir  bir müzik-gen çizgi film. İstediğinizde herhangi bir MIDI render aracılığıyla tekrar çalın.
2. **Medium.**Kurulum`audiocraft`, MusicGen-small ile 4 tür sorguları boyunca 10 saniyelik klipler oluşturun, FAD'yi referans tür seti ile ölçün.
3. **Hard.**ACE-Step (veya MusicGen-melody) kullanarak, aynı melodiyi farklı timbre istekleriyle üç farklılık ile oluşturun.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| FAD | Audio FID | Fréchet distance between embedding distributions of real vs generated. |
| Chromagram | Melody as pitches | 12-dim per-frame vector; input to melody conditioning. |
| Stems | Instrument tracks | Separated bass / drums / vocals / melody as WAV. |
| Inpainting | Regen a section | Mask a time window; model regenerates just that. |
| CLAP | Text-audio CLIP | Contrastive audio-text embedding; eval text-audio alignment. |
| EnCodec | Music codec | Meta's neural codec used by MusicGen; 32 kHz, 4 codebooks. |

## Daha Fazla Okumak

- [Copet et al. (2023). MusicGen](https://arxiv.org/abs/2306.05284) açık autoregresiv referans değerini.
- [Evans et al. (2024). Stable Audio Open](https://arxiv.org/abs/2407.14358) ses tasarımının varsayılan.
- [ACE-Step](https://github.com/ace-step/ACE-Step)4B tam şarkı jeneratörü açıldı, Nisan 2026.
- [Suno v5 platform docs](https://suno.com) Ticari kalite lideri.
- [AudioLDM2](https://arxiv.org/abs/2308.05734) Müzik + ses efektleri için gizli difüsiyon.
- [WMG-Suno settlement coverage](https://www.musicbusinessworldwide.com/warner-music-group-settles-with-suno-strikes-first-of-its-kind-deal-with-ai-song-generator/) Kasım 2025 tarihli bir önceki durum.
