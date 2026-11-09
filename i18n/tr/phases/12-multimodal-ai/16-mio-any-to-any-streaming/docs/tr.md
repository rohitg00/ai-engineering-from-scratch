# MIO ve Herhangi Bir Akışla Çok Modal Modeller

> GPT-4o, çoğu açık modelin kopyalayamadığı bir ürünü gönderir: Ses işiten, video gören ve gerçek zamanlı olarak konuşan bir ajan. Açık ekosistemle ilgili cevap 2024'ün sonuna kadar MIO (Wang et al., Eylül 2024) idi. MIO metin, görüntü, konuşma ve müziği simgelendirir, birbirine karışmış sekanslar üzerinde bir sebep transformatörü eğitir ve herhangi bir modaliteyi herhangi bir modaliteye üretir. AnyGPT (Zhan et al., Şubat 2024) kavramın kanıtıydı; MIO ölçeklendirme; Unified-IO 2 (Allen AI, Aralık 2023) vizyon + eylem yerleşimi olan kuzendi. Bu ders herhangi bir şekilde  dört tokenizör, bir transformatör, akış dostu dekodlama.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, four-modality token allocator + streaming decode loop)
**Prerequisites:** Phase 12 · 11 (Chameleon), Phase 6 (Speech and Audio)
**Time:** ~120 minutes

## Öğrenme Hedefleri

- Birlikte paylaşılmış bir kelime kitlesini oluşturun ki, metin, resim, konuşma ve müzik simgelerinin çarpışma olmadan barındırılsın.
- SEED-Tokenizer (resimler) ve SpeechTokenizer residual-VQ (söz) ile sıkıştırma + yeniden inşaat pazarlamaları karşılaştırın.
- Herhangi bir nesle oluşturan dört aşamalı ders programını açıklayın.
- Açık olan üç resepti ve onların temel anlaşmalarını isimlendirin: MIO, AnyGPT, Unified-IO 2.

## Sorun

Birleştirilmiş multimodal model iddia etmek kolaydır ve ölçekte inşa etmek zordur. 2024 yılına kadar çoğu "herhangi bir kişiye herhangi bir kişiye" sistemler boru hattında bulunmuştur: vizyon modeli → metin temsilciliği → konuşma modeli → ses. Her hop bilgi kaybeder, gecikme ekler ve eğitimyi karmaşıklaştırır. GPT-4o'nun demo videosu ikinci tepki ile tek model alternatifini göstermiştir; açık sistemler aylarca geriye döner.

Mühendislik zorlukları:

- Tokenizers her modalite için var olmalıdır, yeniden inşa için yeterince kayıpsız sıkıştırmalı ve transformatör tüketebilecek hızlarda token üretmelidir.
- Tek bir kelime birikimi metin (32k+), görüntü (8k+), konuşma (4k+), müzik (8k+) için alan ayırmalıdır.
- Eğitim verileri her giriş-çıktı çiftini kapsamalıdır (metin→resim, resim→düşüm, konuşma→resim vb.) veya model oluşturulmalıdır.
- Inference, konuşma gecikmesi için çıkış jetonlarını yeterince hızlı akıtmalıdır (<500ms time-to-first-audio-byte).

## Anlaşım

### Dört modelle dört tokenizör

MIO'nun simgelik yığın:

- Metin: standart BPE, kelime ~32000.
- Resim: SEED-Tokenizer (2023), bir görüntü başına 32 token yayan 8192 giriş kod defteri olan ayrı bir görüntü tokenizeri.
- Konuşma: Konuşma Tokenizer geri kalan-VQ (2023), 16kHz dalga biçimini 8 hiyerarşik kod defterine kodlayan; ilk seviyede kaba içerik, daha sonraki seviyelerde prosodi ve hoparlör kimliği eklenir. MIO içerik seviyesini ekleyerek ilk üç timbre seviyesini, her biri 1024 kodunu tutar, bu nedenle 4096 konuşma kimliği tutar.
- Müzik: benzer kalan-VQ (Meta'nın MusicGen / Encodec ailesi), 4-8 kod kitabı. MIO kendisi bir müzik tokenizerini göndermez (dördüncü modaliteti görüntü tokenizer aracılığıyla çerçeveler olarak video); bu dersin oyuncağı yeni bir modalitenin bir ID aralığını nasıl iddia ettiğini göstermek için müzik ekler.

Her modalitede tam sayı belirtiler üretilir. belirtiler paylaşılan kelimebizinde ayrı tanımlama aralıkları elde eder:

```
text:   0..31999
image:  32000..40191  (8192 image tokens)
speech: 40192..44287  (4 codebooks x 1024 speech tokens)
music:  44288..52479  (8192 music tokens, the toy's extension)
sep:    52480..52485  (<image>, <speech>, <music>, </...>)
```

Toplam: ~ 52k kelime birikimi. Giriş yerleştirme ve çıkış projeksiyonu tümünü kapsar.

### Akışlı dekode

Konuşma jenerasyonu kalan-VQ kullanır. Transformatör temel (sınıf 0) konuşma belirtilerini tahmin eder; paralel olarak kodlanmış kalan kuantitör sonraki katmanları tahmin eder. Her sıfır 0 belirti 16kHz'de yaklaşık 50 ms ses tutar.

Akış tarzı:

1. Kullanıcı mikrofonla konuşur; gerçek zamanlı ses jetonları her 50 ms'de konuşma jetonları yayar.
2. MIO, gelen tokenleri tüketir (sürekli önceden doldurma + artışlı ileri).
3. Çıktılık jetonları üretildiği gibi akıyor; paralel bir konuşma dekodörü onları ~ 50-150ms gecikme ile ses örneklerine dönüştürüyor.
4. MIO kağıdı gecikme sayısını bildirmez. Aşağıdaki bütçe bu tasarımı en iyi 300 ms'e, GPT-4o'nun ~ 250 ms'ine karşı koyar.

Mini-Omni (arXiv:2408.16725), GLM-4-Voice (arXiv:2412.02612), ve Moshi (arXiv:2410.00037) tamamlayıcı akış konuşma-LLM tasarımlarıdır.

### Dört aşamalı ders programı

MIO'nun eğitim programı:

1. 1. aşama  uyum. Büyük ölçekli modalite-par korporası: metin-resim, metin-dedik, metin-müzik. Her çift kendi simge sözlük bölümü kullanır. Paylaşılan sözlüklük eğitimi.
2. Etap 2  birbirine karışmış. Çok modalitelerle birbirine karışmış belgeler (resimler + video, transkriptleri olan podcastler vb.)
3. 3. aşama  Konuşma geliştirilmiştir. Metin yeteneğini kaybetmeden konuşma kalitesini yükseltmek için ek ses verileri.
4. 4. aşama  SFT. Modaliteler arasında talimat ayarlama: VQA, başlık, anlatım, konuşma-söz diyalogu.

Bir aşama eksik olması belirli yetenekleri düşürür: 2. aşamayı atlamak ve model çapraz modalite bağlamını kaybeder; 3. aşamayı atlamak ve konuşma zayıf.

### Görsel düşünce zinciri

MIO, görsel düşünce zincirini tanıtır: model, bir mantık adımı olarak ara görüntü belirtilerini yayar. "Kedi bir ağaca tırmanıyor mu?" için model:

1. Çıkar .`<image>`Sahneyi gösterme simgelerinden (geleneksel görüntüden veya bir çizimden).
2. Resimi analiz ederek mesaj gönderir.
3. Son cevabı verir.

Yaratılan ara görüntü bir çizim tabanı olarak hizmet eder. Yerel mantıklama görevlerinde ölçüm noktası gelişir. Fikir metin mantığı için düşünce zincirini yansıtır.

### Herhangi bir yarışta rekabetçiler

- AnyGPT (arXiv:2402.12226): 4 modalitesi (metin, görüntü, konuşma, müzik), benzer tasarım.
- Birleştirilmiş-IO 2 (arXiv:2312.17172): görme eylem çıkışları, derinliği, normallerini ekler. Daha fazla görev çeşitliliği, daha küçük ölçek.
- NExT-GPT (arXiv:2309.05519): LLM + modalite-specifik difüzyon dekodörleri. Tek bir model yaklaşımı değil.
- CoDi (arXiv:2305.11846): bileşenlebilir yayılma; herhangi bir ortak gizli yoluyla herhangi bir kişiye.

MIO, saf bir simge olan herhangi bir kişiye en yakın bir şeydir. AnyGPT, kavramsal atalarıdır.

### Gecikme bütçesi

Bir konuşma ürünü için, her bileşenin gecikmesi önemlidir:

- Mikrofonla ses jetonları: ~ 50 ms.
- Ön doldurma (audio tokens + tarih): ~ 100 ms 8B modelinde.
- İlk çıkış simgesi: ~ 50 ms.
- Paralel kalan-VQ + konuşma dekodörü: ~ 100-150 ms.

Toplam zaman-to-first-audio-byte: ~300ms minimum. GPT-4o ~250ms iddia eder. Moshi 160ms iddia eder. Ne MIO ne de AnyGPT ölçümlü bir rakam yayınlamaz, bu yüzden bu bütçeyi bir tahmin olarak değerlendirin, bir referans değil.

### Neden herkesin zorlukları var ?

2026'da bile, herhangi bir model açılsın iki eksede kapanmış olan modeller izlenecektir:

- Konuşma kalitesi. Geri kalan VQ tokenizer kayblıdır; sohbet konuşması ElevenLabs sınıfı seslerine kıyasla robotik bir ses.
- Modelle "gördüğünüz hakkında şarkı söyleyin" sormak, görme görevinin yerine daha sık başarısız olur.

Bu açık araştırma sorunları. Qwen3-Omni (Desin 12.20) 2025'te en gelişmiş açık girişimdir.

```figure
any-to-any-stream
```

## Kullan

`code/main.py`- ...

- Dört modalite kelime dağılımını tanımlar ve yazdırırır.
- Tokenizer yönlendirici aracılığıyla multimodal girişlerin (metin, görüntü, sesli klip, müzik) bir listesini yönlendirir.
- Gecikme sayımı ile metin-söz cevabı için akış dekodunu simüle eder.
- Enkodlayıcı, önceden doldurma ve dekodör gecikmelerinin beklenen ilk ses baytına kadar beklenen zamanı hesaplar.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-any-to-any-pipeline-auditor.md`. Konuşma ürün özelliklerini (gelirme, çıkma, gecikme hedefi) göz önüne alarak, MIO ailesinin tasarım seçimlerini denetlemektedir ve gecikme bütçesini hesaplar.

## Egzersizler

1. Ürününüz konuşma girişini kabul eder ve konuşma çıkışını gönderir. Sonundan sonuna kadar gecikme bütçesinin hedefi nedir? Zaman harcayan bileşenleri listelen.

2. SpeechTokenizer residual-VQ 8 kod defteri kullanır. Geri kalan seviyelerin paralel dekodlanmasının neden gerekli olduğunu (sıralı karşı karşıya) ve ne kadar gecikme tasarrufu getirdiğini önerin.

3. Sözcükleriniz 32k metin + 8k görüntü + 4k konuşma. 8k müzik ve ~10 ayırıcı ekleyin. Gizli dim 4096'da yerleştirme-matriks parametresi maliyeti nedir?

4. Görsel düşünce zinciri bir ara görüntü verir. Hangi sorular yararlı?

5. Moshi'yi okuyun (arXiv:2410.00037). "İçer monolog" tekniğini tarif edin ve MIO'nun görsel düşünce zinciri ile karşılaştırın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Any-to-any | "Multimodal in/out" | A single model that accepts and emits text, image, speech, and music in any direction |
| Residual-VQ | "Speech tokenizer stack" | Multi-codebook tokenization where each layer adds information; base layer is content, later layers are prosody |
| SEED-Tokenizer | "Image codes" | Discrete image tokenizer with an 8192-entry codebook and 32 tokens per image, used by MIO |
| Chain-of-visual-thought | "Visual scratchpad" | The model generates an intermediate image as a reasoning step before its final answer |
| Time-to-first-audio-byte | "TTFAB" | Latency from user voice to first audio output; <500ms for conversational feel |
| Four-stage curriculum | "Training recipe" | Alignment -> interleaved -> speech-enhanced -> SFT, in that order |

## Daha Fazla Okumak

- [Wang et al. — MIO (arXiv:2409.17692)](https://arxiv.org/abs/2409.17692)
- [Zhan et al. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Lu et al. — Unified-IO 2 (arXiv:2312.17172)](https://arxiv.org/abs/2312.17172)
- [Wu et al. — NExT-GPT (arXiv:2309.05519)](https://arxiv.org/abs/2309.05519)
- [Tang et al. — CoDi (arXiv:2305.11846)](https://arxiv.org/abs/2305.11846)
