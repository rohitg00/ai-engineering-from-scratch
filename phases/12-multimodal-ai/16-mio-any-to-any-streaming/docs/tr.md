# MIO ve Herhangi Birinden Herhangi Birine Akış Multimodal Modelleri

> GPT-4o, çoğu açık modelin taklit edemeyeceği bir ürün sunar: gerçek zamanlı olarak sesi duyan, videoyu gören ve yanıt veren bir agent. 2024 sonlarına doğru açık ekosistemin cevabı MIO idi (Wang ve diğerleri, Eylül 2024). MIO token Metni, görüntüyü, konuşmayı ve müziği birleştirir, bir nedensel transformer'yi aralıklı diziler üzerinde eğitir ve herhangi bir modalite için herhangi bir modalite üretir. AnyGPT (Zhan ve diğerleri, Şubat 2024) konseptin kanıtıydı; MIO ölçek büyütmedir; Unified-IO 2 (Allen AI, Aralık 2023), vizyon + eylem temelinin kuzenidir. Bu ders herhangi birinden herhangi birine modeli okur - dört tokenizer, bir transformer, akış dostu kod çözme.

**Tür:** Öğren
**Diller:** Python (stdlib, dört modlu token ayırıcı + akış kod çözme döngüsü)
**Önkoşullar:** Aşama 12 · 11 (Bukalemun), Aşama 6 (Konuşma ve Ses)
**Süre:** ~120 dakika

## Öğrenme Hedefleri

- Metin, görüntü, konuşma ve müzik token'leri çarpışma olmadan barındıran paylaşılan bir kelime dağarcığı tasarlayın.
- Sıkıştırma + yeniden yapılandırma ödünleşimleri üzerine SEED-Tokenizer (görüntüler) ve SpeechTokenizer artık-VQ (konuşma) öğelerini karşılaştırın.
- Herhangi bir kuşağı oluşturan dört aşamalı müfredatı açıklayın.
- Herhangi birinden herhangi birine açık olan üç tarifi ve bunların ana değişimlerini adlandırın: MIO, AnyGPT, Unified-IO 2.

## Sorun

Birleşik çok modlu bir modelin iddia edilmesi kolay, ancak geniş ölçekte inşa edilmesi zordur. 2024 yılına kadar "herhangi birinden herhangi birine" sistemlerin çoğu ardışık düzene tabi tutuldu: görme modeli → metin gösterimi → konuşma modeli → ses. Her atlama bilgi kaybeder, gecikmeyi artırır ve eğitimi karmaşıklaştırır. GPT-4o'nun demo videosu, saniyeden kısa sürede yanıt veren tek modelli bir alternatifi gösteriyordu; açık sistemler aylarca geride kaldı.

Mühendislik zorlukları:

- Tokenizer'ler her modalite için mevcut olmalı, yeniden yapılandırma için kayıpsız olarak yeterince sıkıştırılmalı ve transformer'nin tüketebileceği oranlarda token'ler üretmelidir.
- Tek bir kelime dağarcığında metin (32k+), görüntü (16k+), konuşma (4k+), müzik (8k+) için yer ayrılmalıdır. Minimum kırk binden fazla giriş.
- Eğitim verileri her giriş-çıkış çiftini (metin→görüntü, görüntü→konuşma, konuşma→görüntü vb.) kapsamalı veya model oluşturmalıdır.
- Inference, token çıktılarını konuşma gecikmesi için yeterince hızlı bir şekilde aktarmalıdır (<500 ms ilk ses baytına kadar geçen süre).

## Konsept

### Dört yöntem için dört tokenizer

MIO'nun tokenizer yığını:

- Metin: standart BPE, kelime bilgisi ~32000.
- Resim: SEED-Tokenizer (2023) — ayrı kod kitabına sahip nicemlenmiş VAE, 4096 giriş, görüntü başına 32x32 token.
- Konuşma: SpeechTokenizer rezidüel-VQ (2023) — 16kHz dalga formunu 8 hiyerarşik kod kitabına kodlar; ilk seviye kaba içeriktir, sonraki seviyeler ise prozodi ve konuşmacı kimliğini ekler.
- Müzik: benzer artık-VQ (Meta'nın MusicGen / Encodec ailesi), 4-8 kod kitabı.

Her yöntem token tamsayılarını üretir. token'ler, paylaşılan sözlükte ayrık kimlik aralıkları elde eder:

```
text:   0..31999
image:  32000..36095  (4096 image tokens)
speech: 36096..40191  (4096 speech base tokens, plus residual layers)
music:  40192..48383  (8192 music tokens)
sep:    48384..48390  (<image>, <speech>, <music>, </...>, etc.)
```

Toplam: ~48k kelime hazinesi. embedding girişi ve çıkış projeksiyonu bunların tamamını kapsar.

### Akış kod çözme

Konuşma oluşturma artık-VQ'yu kullanır. transformer, temel (katman 0) konuşmayı token'leri tahmin eder; paralel kodu çözülmüş bir artık niceleyici, sonraki katmanları tahmin eder. Her katman 0 token, 16kHz'de yaklaşık 50ms sestir.

Akış düzeni:

1. Kullanıcı mikrofona konuşur; gerçek zamanlı ses tokenizer her 50 ms'de bir token konuşması yayar.
2. MIO, token'leri geldikleri anda tüketir (prompt ön doldurma + artımlı ileri).
3. Çıktı token'ler oluşturulduğu şekilde yayınlanır; paralel bir konuşma kod çözücü, bunları ~50-150 ms gecikme süresiyle ses örneklerine dönüştürür.
4. İlk ses baytına kadar geçen süre: MIO kağıdında ~300-500ms, GPT-4o'nun ~250ms'sine yaklaşıyor.

Mini-Omni (arXiv:2408.16725), GLM-4-Voice (arXiv:2412.02612) ve Moshi (arXiv:2410.00037) tamamlayıcı konuşma akışı-LLM tasarımlarıdır. Moshi özellikle tek bir GPU'da 160 ms'lik gidiş-dönüş hızına ulaşıyor.

### Dört aşamalı müfredat

MIO'nun eğitim müfredatı:

1. Aşama 1 – hizalama. Büyük ölçekli modalite çifti bütünlemi: metin-görüntü, metin-konuşma, metin-müzik. Her çift kendi token sözcük grubunu kullanır. Paylaşılan kelime dağarcığını eğitir.
2. Aşama 2 — aralıklı. Çok modlu serpiştirilmiş belgeler (resim + video içeren bloglar, transkript içeren podcast'ler vb.). Modaliteler arası bağlamı eğitir.
3. Aşama 3 – konuşma destekli. Metin özelliğini kaybetmeden konuşma kalitesini artırmak için ekstra ses verileri.
4. Aşama 4 – SFT. Yöntemler arasında talimat ayarlaması: VQA, altyazı, anlatım, konuşmadan konuşmaya diyalog.

Bir aşamanın kaçırılması belirli yeteneklerin azalmasına neden olur: 2. aşamayı atlarsanız model, modaliteler arası bağlamı kaybeder; 3. aşamayı atlayın ve konuşma zayıftır.

### Görsel düşünce zinciri

MIO, görsel düşünce zincirini tanıtıyor: model, bir akıl yürütme adımı olarak ara görüntü token'leri yayıyor. "Kedi ağaca mı tırmanıyor?" modeli:

1. Sahneyi oluşturan `<image>` token'leri yayar (giriş görüntüsünden veya çizimden).
2. Çizimi analiz eden metni yayınlar.
3. Son yanıtı verir.

Oluşturulan ara görüntü, karalama defteri görevi görür. Benchmark'ler mekansal akıl yürütme görevlerini geliştirir. Fikir, metin muhakemesi için düşünce zincirini yansıtıyor.

### Herhangi birinden herhangi birine rakipler

- AnyGPT (arXiv:2402.12226): 4 modalite (metin, resim, konuşma, müzik), benzer tasarım.
- Birleşik-IO 2 (arXiv:2312.17172): görme eylemi çıktıları, derinlik ve normaller ekler. Daha fazla görev çeşitliliği, daha küçük ölçek.
- NExT-GPT (arXiv:2309.05519): LLM + modaliteye özgü difüzyon kod çözücüleri. Tek modelli bir yaklaşım değil.
- CoDi (arXiv:2305.11846): şekillendirilebilir difüzyon; paylaşılan gizli aracılığıyla herhangi birinden herhangi birine.

MIO, saf token'ye en yakın olanıdır. AnyGPT onun kavramsal atasıdır.

### Gecikme bütçesi

Konuşmaya dayalı bir ürün için her bileşenin gecikmesi önemlidir:

- Mikrofondan sese token'ler: ~50ms.
- Önceden doldurma (ses token'ler + geçmiş): 8B modelinde ~100 ms.
- İlk çıkış token: ~50ms.
- Paralel artık-VQ + konuşma kod çözücü: ~100-150ms.

İlk ses baytına kadar toplam süre: ~300 ms minimum. GPT-4o ~250ms olduğunu iddia ediyor. Moshi 160ms olduğunu iddia ediyor. MIO/AnyGPT, genel benchmark başına 400-600 ms aralığındadır.

### Neden herhangi birinden herhangi birine zor kalıyor

2026'da bile açık, herhangi bir model, kapalı modelleri iki eksende takip ediyor:

- Konuşma kalitesi. Artık-VQ tokenizer kayıplıdır; Konuşma konuşması, ElevenLabs sınıfı seslerle karşılaştırıldığında robotik geliyor.
- Modaliteler arası akıl yürütme. Modelden "gördükleri hakkında şarkı söylemesini" istemek, saf görüş görevlerinden daha sık başarısız oluyor.

Bunlar açık araştırma problemleridir. Qwen3-Omni (Ders 12.20), 2025'teki en gelişmiş açık denemedir.

## Kullan onu

`code/main.py`:

- Dört modlu kelime tahsisini tanımlar ve yazdırır.
- Çok modlu girişlerin (metin, resim, ses klibi, müzik) listesini tokenizer yönlendirici üzerinden yönlendirir.
- Gecikme sayımı ile metinden konuşmaya yanıt için akış kod çözmeyi simüle eder.
- Verilen kodlayıcı, ön doldurma ve kod çözücü gecikme sürelerini ilk ses baytına kadar beklenen süreyi hesaplar.

## Gönderin

Bu ders `outputs/skill-any-to-any-pipeline-auditor.md`'yi üretir. Konuşmaya dayalı bir ürün spesifikasyonu verildiğinde (modaliteler içeri, modaliteler dışarıda, gecikme hedefi), MIO ailesi tasarım seçeneklerini denetler ve gecikme bütçesini hesaplar.

## Egzersizler

1. Ürününüz konuşma girişini kabul eder ve konuşma çıkışını verir. Uçtan uca gecikme bütçe hedefi nedir? Zaman harcayan bileşenleri listeleyiniz.

2. SpeechTokenizer rezidüel-VQ 8 kod kitabı kullanır. Artık seviyelerin paralel kodunun çözülmesinin neden gerekli olduğunu (sıralıya karşı) ve bunun gecikmeden ne gibi tasarruflar sağladığını önerin.

3. Kelime dağarcığınızın 32k metin + 4k resim + 4k konuşması var. 8k müzik ve ~10 ayırıcı ekleyin. Gizli dim 4096'daki embedding-matris parametresinin maliyeti nedir?

4. Görsel düşünce zinciri bir ara görüntü yayar. Ne tür sorular işe yarar? Ekstra token'ler hangi türlere zarar veriyor?

5. Moshi'yi (arXiv:2410.00037) okuyun. "İç monolog" tekniğini tanımlayın ve MIO'nun görsel düşünce zinciriyle karşılaştırın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Herhangi birinden herhangi birine | "Çok modlu giriş/çıkış" | Metin, görüntü, konuşma ve müziği her yönde kabul eden ve yayan tek bir model |
| Artık-VQ | "Konuşma tokenizer yığını" | Her katmanın bilgi eklediği çoklu kod kitabı tokenization; temel katman içeriktir, sonraki katmanlar prozodidir |
| TOHUM-Tokenizer | "Resim kodları" | MIO tarafından kullanılan 4096 girişli kod kitabına sahip ayrık görüntü tokenizer |
| Görsel düşünce zinciri | "Görsel karalama defteri" | Model, nihai cevabından önce bir akıl yürütme adımı olarak bir ara görüntü oluşturur |
| İlk ses baytına kadar geçen süre | "TTFAB" | Kullanıcı sesinden ilk ses çıkışına kadar gecikme; Konuşma hissi için <500 ms |
| Dört aşamalı müfredat | "Eğitim tarifi" | Hizalama -> aralıklı -> konuşma geliştirilmiş -> SFT, bu sırayla |

## Daha Fazla Okuma

- [Wang ve ark. — MIO (arXiv:2409.17692)](https://arxiv.org/abs/2409.17692)
- [Zhan ve diğerleri. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Lu ve ark. — Birleşik-IO 2 (arXiv:2312.17172)](https://arxiv.org/abs/2312.17172)
- [Wu ve ark. — NExT-GPT (arXiv:2309.05519)](https://arxiv.org/abs/2309.05519)
- [Tang ve ark. — CoDi (arXiv:2305.11846)](https://arxiv.org/abs/2305.11846)
