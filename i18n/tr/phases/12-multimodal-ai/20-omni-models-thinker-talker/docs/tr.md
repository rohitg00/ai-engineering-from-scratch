# Omni Modeller: Qwen2.5-Omni ve Düşünceci-Söyleyicisi Bölünmesi

> GPT-4o'nun Mayıs 2024'te yapılan ürün gösterisi altta yatan modelden dolayı değil, ürün şekli nedeniyle  konuştuklarınızda sesli bir arayüzün olması, modelin kamerada gördüğünü gördüğü ve 250 ms'den kısa bir süre içinde tekrar konuşması nedeniyle bozulmuştu. Açık ekosistem, 2024 ve 2025 yıllarının geri kalanını bu ürün yüzeyine ulaşmak için yarışarak geçirdi. Qwen2.5-Omni (Mart 2025) referans açık tasarımdır: bir Thinker (büyük metin üreten transformatör) ek olarak bir Talker (paralel konuşma üreten transformatör), akış konuşma jetonları ile bağlantılıdır. Mini-Omni basitleştirdi, Moshi gecikme süresine eşleşti, GLM-4-Voice Çin'e uzattı. Bu ders, akılcı-sözcü mimarisini ve akış gerçek zamanlı diyalogunu çalıştırmak için gecikme bütçesini okuyor.

**Type:** Build
**Languages:** Python (stdlib, streaming pipeline latency simulator + VAD loop), TypeScript
**Prerequisites:** Phase 12 · 19 (audio-LLMs), Phase 12 · 16 (any-to-any)
**Time:** ~180 minutes

## Öğrenme Hedefleri

- İfade borusunu düşünce (metin mantığı) ve konuşma (söz sentezi) olarak bölün ve paralel akış neden çalışır açıklayın.
- Bir konuşma etkileşimi için, bileşenler arasındaki Time-to-First-Audio-Byte (TTFAB) bütçesini hesaplayın.
- TMRoPE'nin düşünceci içinde görme, ses ve metin üzerinde zaman doğrultusunda konum kodlamasını açıklayın.
- İki gerçek zamanlı konuşma örneğini, yarı duplex ve tam duplex adını verin ve VAD dönüşü almanın yarı duplex el uzatmasını nasıl yönlendirdiğini açıklayın.

## Sorun

Gerçek zamanlı ses asistanı çok şey yapmalı, hızlı:

1. Kullanıcıyı dinleyin. Gerçek zamanlı konuşma simgesi, ses etkinliği algılama (VAD) konuşma bittiklerini bilmek için.
2. Kamera girişleri 2 ila 4 FPS'de, sesle birlikte düşünceciye akıştı.
3. Düşün, konuşma geçmişine göre bir cevap yaz.
4. Ses simgelerini sentezle, dalga şekline dekode et, kullanıcıların hoparlörlerine akışla.

Her adım gecikme ekler. Konuşma-hissesi toplam geri dönüş < 500ms  gerektirir, kullanıcı gecikmeyi fark etmeyi bırakır. GPT-4o ~250ms iddiasını ifade eder. Moshi ~160ms. Qwen2.5-Omni ~350-500ms.

Her bileşen akışmalı. Hiçbir şey "her şeyi toplayıp sonra kodlamayı" olamaz.

## Anlaşım

### Düşünen ve Konuşan

Qwen2.5 Omni'nin parçalanması:

- Düşünceci: 7B-80B metin üreten bir transformatör. Çelişkili metin + görüntü + ses jetonlarını tüketir. Neyi söylemek istediğini temsil eden metin jetonlarını çıkarır.
- Konuşmacı: daha küçük bir konuşma üreten transformatör (200M-1B). Düşüncenin metin çıkış işaretlerini ve son konuşma bağlamı işaretlerini tüketir. Diskret konuşma işaretlerini (kayıp-VQ indeksleri) çıkarır.
- Konuşma dekodörü: Ses simgelerini gerçek zamanlı olarak ses örneklerine götüren akış dalga biçimleri dekodörü (SNAC, MoVQGAN ailesi).

Ayrılma önemlidir. İyi bir mantık yürütmek için düşünen büyük olmalıdır. Konuşmacı küçük olabilir çünkü işinin yerel olması  metni konuşma işaretlerine dönüştürmek. Büyük Konuşmacı daha ifade edici değildir; daha yavaş.

İkisini de paralel olarak çalıştırmak:

1. Düşünceci metin işaretini gönderir .$t_i$- Evet .
2. Konuşmacı tüketir .$t_i$(streaming yoluyla) ve konuşma simgelerini gönderir $s_i, s_{i+1}, \ldots, s_{i+k}$- Evet .
3. Konuşma dekodörü, konuşma işaretlerini geldiğinde tüketir ve ses örneklerini yayar.
4. Düşünceci mesaj atışına varırken .$t_{i+3}$, Talker zaten ses yayını yaptı .$t_0, \ldots, t_{i+2}$- Evet .

### TMRoPE  Zaman doğrultusunda çok modal pozisyonlar

Düşünceci, görüntü çerçevelerini (örneğin 4 FPS'ye ulaşmak), ses çerçevelerini (sekunde 50 çerçeveye ulaşmak) ve konuşma geçmişinden metinleri entegre etmelidir.

TMRoPE, her token'e mutlak zaman damgaları verir. Görüş damgası t=2.3 saniye. Ses damgası t=2.32 saniye. Kullanıcıdan gelen metin damgası t=2.35 saniye. RoPE dikkatini zaman damgası ile döndürür; model onları geçici olarak eşzamanlı olarak görür.

Bu, "selamlarken el salladı" için altyapı çalışması için  model aynı kavramsal anlarda video çerçevesini ve sesini görür.

### Akış konuşma sentezi

Konuşma jetonları akışmalı. Mini-Omni (Xie & Wu, 2024) "dilli modeller akışta düşünerek işitebilir, konuşabilir" tanıttı: Düşünceci çıkış jetonları ve Konuşmacı çıkış jetonları aynı sırada birbirine karışır. Konuşmacı bir sonraki metin jetonu yapıldığında ateş eder.

Moshi (Défossez et al., Ekim 2024) en hızlı açık uygulamadır. 160 ms TTFAB tek bir A100'de. Mimarlık: Tek bir 7B transformatörü, değişen pozisyonlarda metin ve konuşma belirtilerini yayar, düşünce akışını konuşma akışından ayıran bir "içindeki monolog" ile. Bu etkili bir şekilde Düşünce + Konuşmacı'dır. Dikkatli eğitimle tek bir modelde birleştirildi.

### VAD ve dönüş

Ses etkinliği algılama giriş tarafında çalışır.

- Yarım duplex: kullanıcı konuşur, model dinler. Model konuşur, kullanıcı dinler. VAD sessizlik algılama yoluyla açık el uzatma (~ 200 ms).
- Tam duplex: her ikisi de aynı anda konuşabilir. Model arka kanal ("uh-huh") veya kesilebilir.

Qwen2.5 Omni, sessizlik eşiği üzerinden dönüş yaparak varsayılan olarak yarım duplex destekler.

### Qwen3-Omni (Kasım 2025)

GPT-4o'nun 250 ms'ine yakın gecikme. Açık ağırlıklar. OmniBench'de Benchmarks.

### Üretim gecikmesi bütçesi

Tipik bir akış etkileşimi için:

- Mikrofon -> ses simgeler: 40-80 ms.
- Ön doldurma (sürekli + tarih): 7B'de 100-200 ms, 70B'de çok daha fazla.
- İlk düşünceci metin simgesi: 40 ms.
- Konuşmacı ilk metin işlemi yapar: 20 ms.
- İlk konuşma simgesi: 40 ms.
- Geri kalan-VQ çözümü: 30 ms.
- Konuşma dalga şekli çözümü: 50-80 ms.

Toplam TTFAB: 7B'de 320-490 ms, 70B'de 600-900 ms. Sınır kalitesi genellikle 70B+ anlamına gelir; bu nedenle sınır gecikme boşluğu.

### Token oranı matematiği

16kHz konuşma ile 50 Hz temel konuşma işaretleri, çıkış saniyesinde 50 konuşma işaretine ihtiyacınız var. Konuşmacı takip etmek için ≥50 tok/s yaymalıdır. H100'de tipik bir LLM geçiş süresi 30-80 tok/s'de, küçük bir (200-300M) Konuşmacı yeterince hızlıdır; bir 7B Konuşmacı geride kalır.

Bu nedenle, "sadece ana modeli kullanmak" yerine küçük özel Talker modelleri var.

```figure
l5-thinker-talker
```

## Kullan

`code/main.py`- ...

- Sahte token emisyon oranları ile düşünce-sözcü boru hattını simüle eder.
- Yapılandırılabilir model boyutları ve mikrofon örnek oranları için TTFAB hesaplar.
- VAD sessizlik eşiği ile yarı duplex dönüş gösterir.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-omni-streaming-budget.md`. Gerçek zamanlı ses ürününün hedefi TTFAB ve özellik setini (görüş, iki dil, tam çift) göz önüne alarak, Qwen2.5-Omni, Qwen3-Omni, Moshi veya Mini-Omni'yi seçer ve Thinker/Talker'i boyutlandırır.

## Egzersizler

1. Hedefiniz TTFAB 300 ms. 7B Thinker ve 300M Talker'de, her bileşenin gecikmesini yazın.

2. Qwen2.5-Omni TMRoPE kullanıyor. Kullanıcı t=1s'de konuşmaya başladığı ve kamera t=1.2s'de bir hareket yakaladığı bir istek için modelin ne gördüğünü açıklayın.

3. Tam duplex desteği, modelin dinlerken ses yaymasını gerektirir.

4. Moshi'nin makalesini okuyun Bölüm 4. "İçer monolog" ayrılığını ve neden Düşünceci-Söyleyicinin bölünmesini engellediğini açıklayın.

5. Geçim bütçesini hesaplayın: Bir Konuşmacı 16kHz konuşmayı 50 temel katman tokeni/sekonda takip etmek için ne kadar hızlı jetonlar yaymak zorunda?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Thinker | "Reasoning brain" | Large text-generating transformer producing what to say |
| Talker | "Speech-generating mouth" | Small transformer producing discrete speech tokens from Thinker's text |
| TTFAB | "Latency budget" | Time-to-first-audio-byte: from user speech end to first audio sample out |
| TMRoPE | "Time-aligned RoPE" | Position encoding using absolute timestamps across vision, audio, text |
| Half-duplex | "Turn-taking" | User and model alternate; VAD silence detects user-done |
| Full-duplex | "Simultaneous" | Model can speak and listen at the same time; backchannel capable |
| Inner monologue | "Moshi separation" | Single-model design where thinking-stream and speaking-stream interleave |

## Daha Fazla Okumak

- [Xu et al. — Qwen2.5-Omni (arXiv:2503.20215)](https://arxiv.org/abs/2503.20215)
- [Qwen Team — Qwen3-Omni (arXiv:2509.17765)](https://arxiv.org/html/2509.17765v1)
- [Xie & Wu — Mini-Omni (arXiv:2408.16725)](https://arxiv.org/abs/2408.16725)
- [Défossez et al. — Moshi (arXiv:2410.00037)](https://arxiv.org/abs/2410.00037)
- [Zeng et al. — GLM-4-Voice (arXiv:2412.02612)](https://arxiv.org/abs/2412.02612)
