# Yönetilen LLM Platformları  Bedrock, Vertex AI, Azure OpenAI

> Üç hiper ölçekli, üç farklı strateji. AWS Bedrock, bir API arkasında bir model pazarıdır  Claude, Llama, Titan, Stability, Cohere. Azure OpenAI özel kapasite için özel bir OpenAI ortaklığı ve sağlanan geçiş birimleri (PTU) dir. Vertex AI, en iyi uzun bağlamlı ve multimodal hikaye ile Gemini'nin ilk yeri aldı. 2026 yılında Yapay Analiz, Azure OpenAI'yi ortalama ~ 50 ms ve Bedrock'u Llama 3.1 405B eşdeğerlerinde ~ 75 ms olarak ölçer. Karar kuralının "en hızlı" değil, "ne model katalog ve FinOps yüzey ürünümle eşleşir".

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy cost-and-latency comparator)
**Prerequisites:** Phase 11 (LLM Engineering), Phase 13 (Tools & Protocols)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Üç platform stratejisini (sıklama vs. özel vs. İkiz-birincil) isimlendirin ve her birini bir ürün kullanım durumuna eşleştirin.
- Azure OpenAI'de sağlanan geçiş ünitelerinin (PTU'lar) size ne satın aldığını ve neden talep üzerine Bedrock'un 405B ölçeğinde tipik olarak yaklaşık 25 ms daha yavaş okuduğunu açıklayın.
- Her platform için FinOps atribut yüzeyini çiz (Bedrock Application Inference Profiles vs Vertex projesi-e-team vs Azure kapsamları + PTU rezervasyonları).
- "İki sağlayıcı minimum" politikasını yazın ve 2026'da tek satıcı kilitlemesinin neden pahalı bir hata olduğunu açıklayın.

## Sorun

Ürününüz için Claude 3.7 Sonnet'i seçtiniz. Şimdi servis etmeniz gerekiyor. Anthropic API'yi doğrudan arayabilir veya AWS Bedrock üzerinden arayabilir veya bir geçit üzerinden geçebilirsiniz. Doğrudan API en basit; Bedrock BAAs, VPC son noktaları, IAM ve CloudWatch özelliğini ekler. Geçit servisleri arasında failover, tekelendirilmiş faturalama ve oran sınırlarını ekler.

Daha derin bir soru katalog. Eğer aynı üründe Claude, Llama ve Gemini'ye ihtiyacınız varsa, aynı anda Bedrock + Vertex + Azure OpenAI'den başka bir yerden hepsini satın alamayacaksınız.

Bu ders üç bahsi, gecikme boşluğu, FinOps boşluğu ve kilitleme riskiyi haritasıyor.

## Anlaşım

### Üç strateji

**AWS Bedrock**Bu nedenle, bu ürünler, birbiriyle birlikte, bir diğer ürünlerin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de de ürünlerinin de ürünlerinin de ürünlerinin de ürünlerinin de de ürünlerinin de ürünlerinin de de de ürünlerinin de ürünlerinin de de ürünlerinin de de ürünlerinin de ürünlerinin de de de ürünlerinin de de ürünlerinin de de ürünlerinin de deye fişeri olarak üretilmesi gerekir.

**Azure OpenAI** özel ortaklık. Azure veri merkezlerinde GPT-4 / 4o / 5 / o serisi, DALL·E, Whisper ve OpenAI modellerinin ince ayarlarını alırsınız. "Azure OpenAI Hizmet" katalogunda OpenAI olmayan modeller yoktur  bunlar Azure AI Foundry'ye (ayrı bir ürün) gider. Azure'ın bahsi OpenAI'nin sınır olarak kalması ve müşteriler bu özel ilişki üzerinde kurumsal kontroller istemektedir.

**Vertex AI** Gemini önce, diğer her şey ikinci. Gemini 1.5 / 2.0 / 2.5 Flash ve Pro, artı Model Garden (üçüncü taraf). Vertex'in bahsi multimodal uzun bağlam  1M-token Gemini bağlamı farklılık göstericidir.

### Ölçüsünde gecikme farkı

Yapay Analiz sürekli referans değerleri kullanıyor. Eşdeğer Llama 3.1 405B dağıtımlarında, Azure ortalama ilk jeton gecikmesi PTU'larla yaklaşık 50 ms; talep üzerine paylaşılan Bedrock yaklaşık 75 ms. Bu boşluk AWS başarısızlığı değil  kapasite model farkıdır. Azure, kiracı için GPU kapasitesini rezerve eden PTU'ları (Provisioned Throughput Units) satıyor. Bedrock'un eşdeğeri (Provisioned Throughput) var ama birim başına saatte yaklaşık 21 $ başlıyor ve çoğu müşteri talep üzerine paylaşılan bir hizmette kalıyor.

İstek üzerine paylaşılan kapasite diğer tüm müşterilerin trafiği ile rekabet eder. Dedicated kapasite değil. Eğer ürün SLA'sı TTFT < 100 ms ise, ya Azure'da PTU'lar satın alırsınız, ya da Bedrock Provisioned Throughput satın alırsınız veya varyasyonu kabul edersiniz.

### Sağlanan Çıktılama Ekonomi

Azure PTU'ları: bir sonucu hesaplama rezervasyonu. Önceden tahmin edilebilir iş yükleri için %70 tasarruf karşı talep. Trafikten bağımsız olarak saat başına sabit maliyetler  boşlukta bile rezervasyon için ödeme yaparsınız. Kesinlik genellikle sürdürülebilir kullanımın %40-60 civarındadır.

Yataklı Çıktıran: $21-$Model ve bölgeye bağlı olarak saatte 50'lik. Benzer matematik  Break-even yaklaşık yarım en yüksek kullanımdır. Aylık taahhüt gereklidir.

Vertex'in sağlanan kapasitesi Gemini SKU'na göre satılır; fiyatlandırma model ve bölgeye göre değişir ve daha az kamuoyuna duyurulur.

### FinOps yüzeyi  gerçek farklılık

**Bedrock Application Inference Profiles**Bu, pazardaki en temiz atribut.`team`- Evet .`product`- Evet .`feature`; tüm model çağrılarını üzerinden yönlendirir; CloudWatch, post-işlemeden profil başına maliyetleri koparır. 2025'te eklendi, hala en granüler hiperkaler doğası.

**Vertex**Bu yüzden, bu programın tüm programları bir grup için kullanmak için kullanılır. Bu programın tüm programları bir grup için kullanılır.

**Azure**PTU rezervasyonları birinci sınıf bir maliyet nesnesi olarak abonelik / kaynak grubu alanlarına ve etiketlere dayanır. Etiketler başlıkları damgalayan bir geçit gerektirir.

Şekil: Bedrock en temiz yerli, Vertex en esnek BigQuery, Azure en açık değil instrument kullanmadıkça.

### 2026 yılındaki risk kilitlenme.

Tek bir hiperkalterli yükümlülük bir model baskın olduğunda iyiydi. 2026 yılında sınır ayda  Claude 3.7 bir çeyrekte, Gemini 2.5 bir sonraki, GPT-5 bir sonraki çeyrekte hareket eder. Bir platformun kilitlenmesi sınırın üçte ikisini kilitler.

Model çalışma takımları: Herhangi bir ürün kritik LLM çağrısı için iki sağlayıcı minimum. Bedrock artı Azure OpenAI ortak çiftidir  Claude birinden, diğerinden GPT, bunlar arasında bir hata geçidi, aynı geçit. Geçiş yolları optimal olduğundan maliyet artışı önemsizdir; kesintiler sırasında kullanılabilirlik artışı (Azure OpenAI Ocak 2025 olayı gibi, AWS us-east-1 kesinti) belirleyici.

### Veri oturumları, BAA'lar ve düzenlenmiş endüstriler

Bedrock: Çoğu bölgede BAA'lar; VPC son noktaları; koruma rayları.
Azure OpenAI: HIPAA, SOC 2, ISO 27001; AB veri ikamet; kurumsal düzenlenmiş varsayım.
Vertex: HIPAA, GDPR, bölge başına veri oturum; Google Cloud'un uyumluluk yığıncağı.

Üçü de temel kontrol kutusuna uymaktadır. Farklılıklar veri saklama politikaları, günlüklerin nasıl işlenmesi ve kötüye kullanımı izleme trafiğinizin okunup okunmadığı (öntemli olarak çoğu için seçilme; işletme için seçilme seçenekleri mevcuttur).

### Hatırlamalısın numaralar

- Azure OpenAI ortalama TTFT Llama 3.1 405B eşdeğerlerinde: ~ 50 ms (PTU ile).
- İsteğe bağlı yatak ortalaması TTFT: ~75 ms.
- Yataklı Çıktıran: $21-$Birim başına 50/saat.
- Azure PTU'nun dengesi: %40-60 sürdürülebilir kullanım.
- Yüksek kullanım oranında talep karşısında PTU tasarrufları: %70'e kadar.

```figure
i4-platform-lanes
```

## Kullan

`code/main.py`Sintez bir iş yükü üzerinde üç platformu karşılaştırır  talep karşısında PTU ekonomisini, TTFT varyansını ve maliyet atributun sadakatini modeller.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-managed-platform-picker.md`. İş yükü profilini (gerekli modeller, TTFT SLA, günlük hacmi, uyumluluk gereksinimleri) göz önüne alarak, birincil bir platform, bir geri dönüş ve FinOps alet planı önerir.

## Egzersizler

1. Çık .`code/main.py`Azure PTU, 70B sınıfı modelini talep üzerine hangi sürdürülebilir kullanım oranında geçiyor?
2. Ürününüz Claude 3.7 Sonnet ve GPT-4o'ya ihtiyaç duyar. Hangi hiperkaler'e giden iki tedarikçi dağıtımını tasarlayın, önde hangi kapı oturuyor, başarısızlık politikası nedir?
3. Düzenlenmiş bir sağlık hizmetleri müşteri BAAs, ABD Doğu veri oturum ve sub-100ms P99 TTFT gerektirir. Bir platform seçin ve üç özel özellikle haklı çıkarın.
4. Bu ay Bedrock faturanın trafik değişiminin olmamasına rağmen 4 kat artığını keşfedin.
5. Antropic API ve Bedrock fiyatlama sayfalarını okuyun. 100M-token / ay Claude iş yükü için, hangi daha ucuz  doğrudan Anthropic API, Bedrock talep üzerine, veya Bedrock sağlanan geçiş?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Bedrock | "AWS LLM service" | Model marketplace across Claude, Llama, Titan, Mistral, Cohere |
| Azure OpenAI | "Azure's ChatGPT" | Exclusive OpenAI models in Azure datacenters with enterprise controls |
| Vertex AI | "Google's LLM" | Gemini-first platform with Model Garden for third-party models |
| PTU | "dedicated capacity" | Provisioned Throughput Unit — reserved inference GPUs, priced per hour |
| Application Inference Profile | "Bedrock tagging" | Per-product cost/usage profile with tags, CloudWatch-native |
| Model Garden | "Vertex catalog" | Vertex AI's third-party model section, separate from Gemini |
| Two-provider minimum | "LLM redundancy" | Policy of running every critical LLM path across ≥2 hyperscalers |
| BAA | "HIPAA paperwork" | Business Associate Agreement; required for PHI; provided by all three |
| Abuse monitoring | "the log watcher" | Provider-side safety scan on prompts/outputs; opt-out in enterprise |

## Daha Fazla Okumak

- [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/) yetkili oran kartı ve sağlanan throughput fiyatlandırması.
- [Azure OpenAI Service Pricing](https://azure.microsoft.com/en-us/pricing/details/azure-openai/) PTU ekonomisi ve oran kartları.
- [Vertex AI Generative AI Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing) Gemini katları ve Model Garden taksitleri.
- [Artificial Analysis LLM Leaderboard](https://artificialanalysis.ai/) Sağlayıcılar arasında sürekli gecikme ve geçiş referansları.
- [The AI Journal — AWS Bedrock vs Azure OpenAI CTO Guide 2026](https://theaijournal.co/2026/03/aws-bedrock-vs-azure-openai/) Kurumsal karar çerçevesini.
- [Finout — Bedrock vs Vertex vs Azure FinOps](https://www.finout.io/blog/bedrock-vs.-vertex-vs.-azure-cognitive-a-finops-comparison-for-ai-spend) Atribut mekanizması yan yana.
