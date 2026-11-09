# LLaVA ve Görsel talimat ayarlama

> LLaVA (April 2023) gezegenin en çok kopyalanan multimodal mimarisidir. BLIP-2'nin Q-Former'ini 2 katlı MLP ile değiştirdi, Flamingo'nun kapalı çapraz dikkatini naif bir simge zinciriyle değiştirdi ve GPT-4 tarafından yalnızca metin başlıklarından üretilen 158k görsel talimat dönüşlerinde eğitildi. 2023 ile 2026 yılları arasında bir VLM inşa eden herhangi bir uygulayıcı LLaVA'nın bir çeşitini inşa etti. LLaVA-1.5 bir MLP projeksiyoncu ve 336px kodlayıcı ile değiştirildi. LLaVA-NeXT yüksek çözünürlüklü giriş için AnyRes kapak ekledi. LLaVA-OneVision tek bir tarifle birleşik görüntü, çoklu görüntü ve video. Bu ders, reçeti okuyor, projeksiyonu uyguluyor ve neden "simpler kazanmış" olduğunu açıklıyor.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, projector + instruction-template builder)
**Prerequisites:** Phase 12 · 02 (CLIP), Phase 11 (LLM Engineering — instruction tuning)
**Time:** ~180 minutes

## Öğrenme Hedefleri

- Bir LLM'nin gömülme dim (dim 4096) için ViT patch yerleşimlerini (dim 1024) haritalayan 2 katmanlı bir MLP projeksiyonu inşa edin.
- LLaVA iki aşamalı tarifini izleyin: (1) 558k başlık çiftlerinde projektor düzeni, (2) 158k GPT-4 üretilen dönüşlerde görsel talimat ayarlaması.
- Resim jetonu yer tutucu, sistem prompt ve kullanıcı/asistan dönüşleri ile LLaVA biçimindeki bir istek sorgu oluşturun.
- Toplumun neden Q-Former'in token-budget kazanmasına rağmen MLP'ye taşındığını açıklayın.

## Sorun

BLIP-2'nin Q-Former'i (Denevi 12.03) bir görüntüyü 32 tokene sıkıştırır. Temiz, verimli, referans değerleri için iyi. Ama iki sorunu vardır.

İlk olarak, Q-Former eğitimlidir ancak kaybı son görev değildir. 1. aşama ITC+ITM+ITG'yi eğitir. 2. aşama LM kaybını eğitir. Sorgular LLM'nin sonra çözmesi gereken bazı ara temsilleri öğrenir. Bilgi boğazında kaybolur.

İkinci olarak, Q-Former 188M param alır ve LLaVA'nın 2023 ölçeğinde hedefinize LLM ile birlikte tasarlamak zorunda kalırsınız. LLM'yi değiştirin, Q-Former'i yeniden eğitin. Görüş kodlayıcısını değiştirin, yeniden eğitin. Her kombinasyon ayrı bir araştırma ve geliştirme projesiydi.

LLaVA cevabı basitliğiyle utanç vericiydi: ViT'nin 576 patch tokenini alın ve her biri iki katlı MLP üzerinden geçsin (`1024 → 4096 → 4096`Bu yüzden, bu programın ilk aşaması, bir sonraki aşaması, bir sonraki aşaması, bir sonraki aşaması, bir sonraki aşaması, bir sonraki aşaması, bir sonraki aşaması, bir sonraki aşaması, bir sonraki aşaması, bir sonraki aşaması, bir sonraki aşaması, bir sonraki aşaması, bir sonraki aşaması, bir sonraki aşaması, bir sonraki aşaması, bir sonraki aşaması, bir sonraki aşaması, bir sonraki aşaması, bir sonraki aşaması, bir sonraki aşaması, bir sonraki aşaması, bir sonraki aşaması, bir sonraki aşama, bir sonraki aşaması, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir sonraki aşama, bir LM kaybı, bir sonraki aşama, bir sonraki aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama, bir aşama

Veriler nereden geliyor? LLaVA'nın ikinci anlayışı: talimat verileri oluşturmak için GPT-4'i (tekestli) kullanın. GPT-4'e bir görüntü için COCO başlığı ve sınırlama kutu verilerini besleyin, konuşmalar, açıklamalar ve karmaşık mantık soruları üretmesini isteyin. 158k talimat- yanıt ücretsiz döndürülür. İnsan notları yoktur.

Sonuç: bir gün boyunca 8 A100'de çalışan, MMMU'de Flamingo'yu yenen ve toplumun genişletebileceği açık bir kontrol noktası gönderdiği bir VLM. 2023'ün sonuna kadar 50+ çatal doğurdu.

## Anlaşım

### Mimarlık

LLaVA-1.5 7B'de:
- Görme kodlayıcı: CLIP ViT-L/14 @ 336 (sasta 1 sırasında dondurulmuş, seçenek olarak 2. aşamada dondurulmuş).
- Projector: GELU aktivasyonu ile 2 katlı MLP, `1024 → 4096 → 4096`- Evet .
- LLM: Vicuna-7B v1.5 (13B varianti Vicuna-13B kullanır; daha sonra çatallar Llama-3.1-8B'ye taşınır).

Resim + metin sorgulamasını ileriye aktar:

```
img -> ViT -> 576 patches of dim 1024
patches -> MLP -> 576 tokens of dim 4096
prompt: system + "<image>" placeholder + user question
replace <image> token with the 576 projected tokens
feed the full sequence to the LLM
decode response
```

Resim LLM bağlamının 576 simgesini yer almaktadır. 2048 bağlamda, bu metin için 1472 simge bırakır. 32k bağlamda, yuvarlama hatasıdır.

### 1. aşama: Projector düzeni

Dondurma ViT. Dondurma LLM. Sadece iki katmanlı MLP'yi çalıştırın. Verim kümesi: 558k görüntü-başlık çiftleri (LAION-CC-SBU). Kayıp: başlık üzerinde dil modelleme, projelenen görüntü jetonları üzerinde şartlı.

Bu projektor, bir süre içinde, bir süre içinde, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre, bir süre,

### İkinci aşama: Görsel talimat ayarlama

Projector'u (hâlâ eğitim edilebilir) dondur. LLM'yi (genellikle tamamen, bazen LoRA) dondur. 158k görsel talimat dönüşlerinde eğit.

Liu ve diğerleri bunu:
1. COCO'nun fotoğrafını çek.
2. Metin açıklamasını çıkarın (5 insan başlığı + sınırlama kutusunun listesi).
3. GPT-4'e üç öntanımlı şablon ile gönder:
   - Konuşma: "Bir kullanıcı ve asistan arasında bu görüntü hakkında ileri geri bir diyalog oluşturun".
   - Detaylı açıklama: "Şekil hakkında zengin ve ayrıntılı bir açıklama verin".
   - Karmaşık bir mantık: "Bu resim hakkında düşünmeyi gerektiren bir soru sor ve sonra cevap ver".
4. GPT-4'in çıkışını çiftlere (özet, cevap) analiz edin.

Bu hiçbir şey resme doğrudan dokunmaz  sadece metin açıklaması. GPT-4 inanılmaz görüntü içeriğini halüsinasyonlar. Biraz gürültü, ama işe yaradı: 158k dönüş diyalogun kilitlenmesi için yeterli oldu.

### Toplum bunu neden kopyaladı?

- 1 aşama özel kayıplar yok.
- Projector saatler içinde trenler, günler değil.
- LLM sadece projeksiyoncuyu yeniden eğiterek değiştirilebilir (LLaVA-Llama2, LLaVA-Mistral, LLaVA-Llama3).
- Görsel talimat verileri boru hattı GPT-4 kullanır ve yeni bir alan için yenilenmek için ucuz.

### LLaVA-1.5 ve LLaVA-NeXT

LLaVA-1.5 (Oktyabr 2023) eklendi:
- Akademik görev verileri (VQA, OKVQA, RefCOCO) talimat ayarlamalarına karıştı.
- Sistem hızlandırması daha iyi.
- Orijinal tek çizgi katman yerine iki katlı MLP projeksiyonu ve 224px (256 token) yerine 336px (576 token) ile CLIP ViT-L/14'i. Eğitim sekansları 2048 token üzerinde kaldı.
- Gazetede bir şebeke bölücü HD varianti, daha sonra LLaVA-NeXT'in AnyRes olarak gönderdiği.

LLaVA-NeXT (Ocak 2024) ekledi:
- AnyRes: yüksek çözünürlüklü görüntüleri 336x336 bitkiyi 2x2 veya 1x3 şebekesine bölünerek, bir küresel düşük çözünürlüklü küçük resimler ekleyerek. Her bir biçim 576 jeton olur. 2x2 şebekesi ekleyerek küçük resimler görüntü başına yaklaşık 2880 görsel jeton verir. 1x3 şebekesi daha az bitkiye sahip, bu nedenle daha az jeton maliyetini artırır. OCR ve grafik görevleri atladı.
- Daha iyi talimat verileri karışımı ShareGPT4V ile (yüksek kaliteli GPT-4V başlıkları)
- Daha güçlü temel LLM (Mistral-7B, Yi-34B).

### LLaVA-OneVision

12.08 dersi OneVision'ı derinlemesine kapsar. Kısa sürüm: aynı projektor, ancak tek görüntü, çok görüntü ve videoyu bir modelde paylaşılan görsel belirti bütçesi ile kapsayan bir ders planıyla eğitilmiştir.

### Q-Former ile karşılaştırma

| | Q-Former (BLIP-2) | MLP (LLaVA) |
|---|---|---|
| Visual tokens per image | 32 | 576 (base) or about 2880 (AnyRes, 2x2 grid) |
| Trainable params | 188M + LM | ~22M (7B) + LM |
| Stage 1 loss | ITC+ITM+ITG | LM only |
| LLM drop-in | Requires retrain | Swap with minimal retrain |
| Multi-image | Awkward | Natural (concat) |
| Video | Awkward | Natural (per-frame concat) |
| Token budget | Small | Large |

MLP, basitlik ve token esnekliği ile kazanır. Q-Former, token bütçesinde kazanır. 2023'ün sonuna kadar token bütçesi artık bağlayıcı bir kısıtlama değildi (LLM bağlamları 32k-128k+'ye büyüdü) ve basitlik baskın oldu.

### İndirme biçimi

```
A chat between a curious human and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the human's questions. USER: <image> Describe this image in detail. ASSISTANT: The image shows ...
```

`<image>`Tokenizer, eğitim aldığından biraz daha uzun bir dizini görür, ancak LLM yeni girişleri ele alır çünkü 1. aşamada öğretildi.

### Parametre ekonomisi

LLaVA-1.5-7B ayrıntıları:
- CLIP ViT-L/14 @ 336: 303M (dondurulmuş aşama 1, sıklıkla dondurulmuş aşama 2).
- Projector (2x linear): ~ 22M tren edilebilir.
- Llama-7B: 7B.
- Toplam: 7.3B param. 2. aşamada çalıştırılabilir. Tam 7B + 22M projeksiyonu.

Etap 2: 8xA100'de 20 saatlik eğitim maliyeti. Bu anahtar sayı  bir gün, bir düğüm, yeniden üretilebilir.

```figure
mm-llava-projector
```

## Kullan

`code/main.py`Uygulamaları:

1. İki katlı MLP projeksiyonu (toy ölçeği için 16 → 32 → 32 boyutları) saf Python'da.
2. Hızlı inşaat boru hattı: Sistem hızlılığı + `<image>`N projelenen token + kullanıcı dönüşü + yardımcı jenerasyon yer tutıcısı ile değiştirilmiştir.
3. LLM bağlamında 576 token görsel bloğunun neye benzediğini görselleştiren bir görüntüleme ( tüketilen 2k / 32k / 128k bağlamının yüzdesi).

## Gönder

Bu ders bize çok yararlı .`outputs/skill-llava-vibes-eval.md`LLaVA aile kontrol noktası olarak, 10 hızlı vibes-eval suite (3 başlık, 3 VQA, 2 akıl yürütme, 2 reddetme) çalıştırır ve insan okuyabilir bir puan kartı rapor eder.

## Egzersizler

1. 2 katmanlı MLP projeksiyonu için tren edilebilir parametreler sayısını hesaplayın .`1024 → 4096 → 4096`GELU ve önyargıyla, LLaVA-13B'nin hangi kısmını temsil ediyor?

2. "Refusal" vakaları için LLaVA uyarısı oluşturun  görüntüde bir özel kişi bulunur. Beklenen asistan cevabını yazın.

3. LLaVA-NeXT blogunun AnyRes bölümünü okuyun. AnyRes'deki 1344x672 görüntü için görsel jeton sayısını hesaplayın. 336x336'daki 576 jetonun tabanına karşılaştırın.

4. LLaVA aşama-1 projeksiyonu başlıklarda LM kaybı ile eğitilmiştir. 1. aşamayı atlayıp doğrudan 2. aşamaya (görsel talimat ayarlama) giderseniz ne olur?

5. LLaVA-Instruct-150k, talimatları oluşturmak için GPT-4 ile COCO başlıklarını kullanır. Yeni bir alan için (tıp X-ışını, uydu görüntüleri), her adımda yanlış giden ne olabilir?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Projector | "MLP bridge" | 2-layer MLP with GELU mapping ViT dim to LLM dim |
| Image token | "<image> placeholder" | Prompt marker replaced by N projected visual tokens before inference |
| Visual instruction tuning | "LLaVA stage 2" | Training on GPT-4-generated (image, instruction, response) triplets |
| Stage 1 alignment | "Projector pretraining" | Freeze ViT and LLM, train projector with LM loss on captions |
| AnyRes | "Multi-crop tiling" | Split high-res image into a tile grid and concatenate each tile's visual tokens |
| LLaVA-Instruct | "GPT-4-generated" | 158k instruction-response pairs synthesized from COCO captions + GPT-4 |
| Vision encoder freeze | "Backbone locked" | CLIP weights do not update in stage 1, sometimes not in stage 2 either |
| ShareGPT4V | "Better captions" | 1M dense captions generated by GPT-4V, used for higher-quality alignment |
| VQA | "Visual question answering" | Task of answering a free-form question about an image |
| Prismatic VLMs | "Design-space paper" | Karamcheti 2024 ablation systematically testing projector and data choices |

## Daha Fazla Okumak

- [Liu et al. — Visual Instruction Tuning (arXiv:2304.08485)](https://arxiv.org/abs/2304.08485)LLaVA kağıdı.
- [Liu et al. — Improved Baselines with Visual Instruction Tuning (arXiv:2310.03744)](https://arxiv.org/abs/2310.03744) LLaVA-1.5.
- [Chen et al. — ShareGPT4V (arXiv:2311.12793)](https://arxiv.org/abs/2311.12793) yoğun başlıklı veri kümesi.
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865) tasarım-yer ablations.
- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326) tek görüntü, çok görüntü, video.
