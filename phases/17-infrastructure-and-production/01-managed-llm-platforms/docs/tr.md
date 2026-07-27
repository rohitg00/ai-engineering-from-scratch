# Yönetilen Yüksek Lisans Platformları — Bedrock, Vertex AI, Azure OpenAI

> Üç hiper ölçekleyici, üç farklı strateji. AWS Bedrock, tek bir API'nin arkasında Claude, Llama, Titan, Stability, Cohere'den oluşan örnek bir pazar yeridir. Azure OpenAI, özel bir OpenAI ortaklığının yanı sıra ayrılmış kapasiteye yönelik Tedarik Edilen Verim Birimleri'nden (PTU'lar) oluşur. Vertex AI, en iyi uzun bağlam ve çok modlu hikayeye sahip Gemini'de bir ilktir. 2026'da Yapay Analiz, Llama 3.1 405B eşdeğerlerinde Azure OpenAI'yi ortalama 50 ms'de ve Bedrock'u ~75 ms'de ölçüyor. PTU'lar boşluğu açıklıyor çünkü özel kapasite, talep üzerine paylaşılan kapasiteyi geçiyor. Karar kuralı "hangisinin en hızlı olduğu" değil, "hangi model kataloğunun ve FinOps yüzeyinin ürünümle eşleştiğidir." Bu ders size titreşimleri değil yazılı olan ödünleşimleri seçmeyi öğretir.

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak maliyeti ve gecikme karşılaştırıcısı)
**Önkoşullar:** Aşama 11 (LLM Mühendislik), Aşama 13 (Araçlar ve Protokoller)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Üç platform stratejisini adlandırın (pazar yeri, özel ve Gemini-first) ve her birini bir ürün kullanım durumuyla eşleştirin.
- Azure OpenAI'de hangi Tedarik Edilen Verim Birimlerinin (PTU'lar) satın alındığını ve isteğe bağlı Bedrock'un neden 405B ölçeğinde ~25 ms daha yavaş okuduğunu açıklayın.
- Her platform için FinOps ilişkilendirme yüzeyinin diyagramını çizin (Bedrock Uygulaması Inference Profilleri, ekip başına Vertex projesi ve Azure kapsamları + PTU rezervasyonları).
- "Minimum iki sağlayıcı" politikasını yazın ve tek satıcıya bağlı kalmanın neden 2026'daki pahalı hata olduğunu açıklayın.

## Sorun

Ürününüz için Claude 3.7 Sonnet'i seçtiniz. Şimdi ona hizmet etmelisin. Anthropic API'yi doğrudan arayabilir, AWS Bedrock aracılığıyla arayabilir veya bir ağ geçidi üzerinden geçebilirsiniz. Doğrudan API en basit olanıdır; Bedrock, BAA'lar, VPC uç noktaları, IAM ve CloudWatch ilişkilendirmesini ekler. Ağ geçidi, sağlayıcılar arasında yük devretme, birleştirilmiş faturalandırma ve ücret sınırları ekler.

Daha derin soru katalogdur. Claude, Llama ve Gemini'ye aynı üründe ihtiyacınız varsa, Bedrock artı Vertex artı Azure OpenAI aynı anda olmadığı sürece hepsini tek bir yerden satın alamazsınız. Hiper ölçekleyiciler birbirinin yerine kullanılamaz; her biri model katmanının kime ait olduğu konusunda farklı bir bahis oynadı.

Bu ders üç bahsi, gecikme boşluğunu, FinOps açığını ve kilitlenme riskini haritalandırır.

## Konsept

### Üç strateji

**AWS Bedrock** — pazar yeri. Claude (Antropik), Llama (Meta), Titan (AWS birinci taraf), Stabilite (görüntü), Cohere (embeddings), Mistral, artı görüntü ve embedding alt katalogları. Bir API, bir IAM yüzeyi, bir CloudWatch dışa aktarımı. Bedrock'un iddiası, müşterilerin tek bir modelden çok isteğe bağlılığı istedikleri yönünde.

**Azure OpenAI** — özel ortaklık. Azure veri merkezlerinde GPT-4 / 4o / 5 / o-serisi, DALL·E, Whisper ve fine-tuning OpenAI modellerine sahip olursunuz. "Azure OpenAI Hizmeti" kataloğunda OpenAI olmayan modeller yoktur; bunlar Azure AI Foundry'ye (ayrı ürün) gider. Azure'un iddiası, OpenAI'nin sınır olmaya devam etmesi ve müşterilerin bu belirli ilişki üzerinde kurumsal kontroller istemesidir.

**Vertex AI** — İkizler birinci, diğer her şey ikinci. Gemini 1.5 / 2.0 / 2.5 Flash ve Pro, ayrıca Model Garden (üçüncü taraf). Vertex'in bahsi çok modlu uzun bağlamdır — 1M-token Gemini bağlamı farklılaştırıcıdır.

### Geniş ölçekte gecikme farkı

Yapay Analiz sürekli benchmark'lari çalıştırır. Eşdeğer Llama 3,1 405B deployments'de (talep üzerine paylaşılır), Azure OpenAI ortalama birinci-token gecikme süresi yaklaşık 50 ms'dir; Ana kaya 75 ms civarındadır. Bu boşluk bir AWS arızası değil, kapasite modeli farkıdır. Azure, kiracınız için GPU kapasitesini ayıran PTU'lar (Tedarik Edilen Performans Birimleri) satar. Bedrock'un eşdeğeri (Tedarik Edilen Verim) mevcuttur ancak birim başına saat başına yaklaşık 21 ABD dolarından başlar ve çoğu müşteri talep üzerine paylaşımlı olarak kalır.

İsteğe bağlı paylaşılan kapasite diğer tüm müşterilerin trafiğiyle rekabet eder. Özel kapasite geçerli değildir. Ürün SLA'nız P99'da TTFT < 100 ms ise Azure'da PTU'lar satın alır, Bedrock Provisioned Throughput satın alır veya varsayılan farkı kabul edersiniz.

### Tedarik Edilen Performans ekonomisi

Azure PTU'lar: ayrılmış bir inference işlem bloğu. Tahmin edilebilir iş yükleri için talep üzerine kıyasla ~%70'e varan tasarruf. Trafikten bağımsız olarak saat başına sabit ücretler; boştayken bile rezervasyon için ödeme yaparsınız. Başabaş noktası genellikle %40-60 civarında sürekli kullanımdır.

Temel Tedarik Edilen Performans: Modele ve bölgeye bağlı olarak saatte $21-$50. Benzer matematik - başabaş noktası, en yüksek kullanımın yaklaşık yarısı kadardır. Aylık taahhüt gereklidir.

Vertex tarafından sağlanan kapasite Gemini SKU'su başına satılır; fiyatlandırma modele ve bölgeye göre değişir ve kamuya daha az duyurulur.

### FinOps yüzeyi — gerçek fark yaratan şey

**Bedrock Uygulaması Inference Profilleri** pazardaki en temiz ilişkilendirmedir. Bir profili `team`, `product`, `feature` ile etiketleyin; tüm model çağrılarını bunun üzerinden yönlendirin; CloudWatch, son işleme gerek kalmadan profil başına maliyetin dökümünü yapar. Hala en ayrıntılı hiper ölçekleyici yereli olan 2025 eklendi.

**Vertex** ilişkilendirmesi, ekip başına proje artı her yerdeki etiketlerdir. Her ekibi bir GCP projesi olarak modellersiniz, her kaynağa etiket koyarsınız ve toplamalar için BigQuery Billing Export + DataStudio'yu kullanırsınız. Daha fazla iş, ancak BigQuery size maliyet verileriyle ilgili isteğe bağlı SQL sunar.

**Azure**, birinci sınıf maliyet nesnesi olarak PTU rezervasyonlarıyla birlikte abonelik/kaynak grubu kapsamlarına ve etiketlere dayanır. Etiketler isteklerden değil kaynak gruplarından devralınır; dolayısıyla istek başına ilişkilendirme, Application Insights özel ölçümlerini veya üstbilgileri damgalayan bir ağ geçidini gerektirir.

Model: Bedrock en temiz yereldir, Vertex BigQuery aracılığıyla en esnektir, Azure siz enstrüman oluşturmadığınız sürece en opaktır.

### Kilitlenmek 2026'nın riskidir

Tek hiper ölçekleyici taahhüdü, bir model hakim olduğunda iyiydi. 2026'da sınır aylık olarak değişiyor; bir çeyrekte Claude 3,7, bir sonraki çeyrekte Gemini 2,5, bir sonraki çeyrekte GPT-5. Bir platforma kilitlenmek sizi sınırın üçte ikisinden mahrum bırakır.

Çalışma ekiplerinin benimsediği model: Ürün açısından kritik herhangi bir LLM çağrısı için minimum iki sağlayıcı. Bedrock artı Azure OpenAI ortak çifttir; birinden Claude, diğerinden GPT, aralarında yük devretme, aynı ağ geçidi. Ağ geçidi rotaları optimal olduğundan maliyet artışı göz ardı edilebilir; Kesintiler sırasında kullanılabilirlik artışı (Azure OpenAI Ocak 2025 olayı, AWS us-east-1 kesintisi gibi) belirleyicidir.

### Veri yerleşimi, BAA'lar ve düzenlemeye tabi sektörler

Ana Kaya: Çoğu bölgedeki BOAKM'ler; VPC uç noktaları; korkuluklar. Ortak fintech varsayılanı.
Azure OpenAI: HIPAA, SOC 2, ISO 27001; AB veri ikameti; kurumsal olarak düzenlenen varsayılan.
Vertex: HIPAA, GDPR, bölge başına veri yerleşimi; Google Cloud'un uyumluluk yığını.

Üçü de temel onay kutusunu karşılıyor. Farklılıklar, veri saklama politikaları, günlüklerin nasıl işlendiği ve kötüye kullanım izlemenin trafiğinizi okuyup okumadığıdır (çoğunda varsayılan katılım; kuruluş için devre dışı bırakma mevcuttur).

### Hatırlamanız gereken sayılar

- Llama 3.1 405B eşdeğerlerinde Azure OpenAI ortalama TTFT'si: ~50 ms (PTU'larla).
- Talep üzerine temel ortalama TTFT: ~75 ms.
- Temel Tedarik Edilen Performans: Birim başına $21-$50/saat.
- Azure PTU başabaş noktası: ~%40-60 sürekli kullanım.
- Yüksek kullanımda isteğe bağlı olarak PTU tasarrufu: %70'e kadar.

## Use It — Hazır Araçla Uygula

`code/main.py` üç platformu sentetik bir iş yükünde karşılaştırır; isteğe bağlı olarak PTU ekonomisini, TTFT sapmasını ve maliyet ilişkilendirme doğruluğunu modeller. PTU'ların nerede işe yaradığını ve pazarın model genişliğinin TTFT açığını nerede aştığını görmek için bunu çalıştırın.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-managed-platform-picker.md` üretir. Bir iş yükü profili göz önüne alındığında (gerekli modeller, TTFT SLA, günlük hacim, uyumluluk gereksinimleri), birincil bir platform, bir yedek ve bir FinOps enstrümantasyon planı önerir.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Azure PTU, hangi sürekli kullanımda 70B sınıfı bir model için isteğe bağlı kullanımı geride bırakıyor? Başabaş noktasını hesaplayın ve reklamı yapılan %40-60 bandıyla karşılaştırın.
2. Ürününüzün Claude 3.7 Sonnet ve GPT-4o'ya ihtiyacı var. İki sağlayıcılı bir deployment tasarlayın — hangi hiper ölçekleyiciye gider, hangi ağ geçidi önde bulunur, yük devretme politikası nedir?
3. Düzenlemelere tabi bir sağlık hizmeti müşterisi, BAA'lara, ABD-Doğu veri ikametine ve 100 ms'nin altında P99 TTFT'ye ihtiyaç duyar. Bir platform seçin ve üç spesifik özellik ile gerekçelendirin.
4. Bu ay herhangi bir trafik değişikliği olmadan Bedrock faturanızın 4 kat arttığını fark ediyorsunuz. Uygulama Inference Profilleri olmadan suçluyu nasıl bulursunuz? Profiller kullanıldığında bu işlem ne kadar sürer?
5. Azure OpenAI ve Bedrock fiyatlandırma sayfalarını okuyun. Aylık 100 milyon token Claude iş yükü için hangisi daha ucuz? Doğrudan Anthropic API, Bedrock on-demand veya Bedrock Tedarik Edilen Performans mı?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Ana kaya | "AWS LLM hizmeti" | Claude, Llama, Titan, Mistral, Cohere'de model pazar yeri |
| Azure OpenAI | "Azure'un ChatGPT'si" | Azure veri merkezlerinde kurumsal denetimlere sahip özel OpenAI modelleri |
| Vertex AI | "Google'ın Yüksek Lisansı" | Üçüncü taraf modeller için Model Garden'a sahip ilk Gemini platformu |
| PTU | "özel kapasite" | Tedarik Edilen Performans Birimi — ayrılmış inference GPU, saat başına fiyatlandırılır |
| Uygulama Inference Profili | "Ana kaya etiketleme" | Etiketli ürün başına maliyet/kullanım profili, CloudWatch'ta yerel |
| Model Bahçesi | "Vertex kataloğu" | Vertex AI'nin Gemini'den ayrı üçüncü taraf model bölümü |
| Minimum iki sağlayıcı | "LLM artıklığı" | Her kritik LLM yolunu ≥2 hiper ölçekleyicide çalıştırma politikası |
| BAA | "HIPAA belgeleri" | İş Ortaklığı Anlaşması; PHI için gerekli; üçü tarafından sağlanmıştır |
| Kötüye kullanım izleme | "günlük gözlemcisi" | prompts/outputs'ta sağlayıcı tarafı güvenlik taraması; şirketten vazgeçme |

## Daha Fazla Okuma

- [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/) — yetkili ücret listesi ve Tedarik Edilen Performans fiyatlandırması.
- [Azure OpenAI Hizmet Fiyatlandırması](https://azure.microsoft.com/en-us/pricing/details/azure-openai/) — PTU ekonomisi ve ücret listeleri.
- [Vertex AI Generative AI Fiyatlandırması](https://cloud.google.com/vertex-ai/generative-ai/pricing) — Gemini katmanları ve Model Garden ek ücretleri.
- [Yapay Analiz LLM Skor Tablosu](https://artificialanalysis.ai/) — sağlayıcılar arasında sürekli gecikme ve aktarım hızı benchmark'lar.
- [The AI ​​Journal — AWS Bedrock vs Azure OpenAI CTO Kılavuzu 2026](https://theaijournal.co/2026/03/aws-bedrock-vs-azure-openai/) — kurumsal karar framework.
- [Finout — Bedrock vs Vertex vs Azure FinOps](https://www.finout.io/blog/bedrock-vs.-vertex-vs.-azure-cognitive-a-finops-comparison-for-ai-spend) — ilişkilendirme mekaniği yan yana.
