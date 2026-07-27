# Maliyet Azaltma İlkeli Olarak Yönlendirme Modeli

> Dinamik bir aracı her isteği değerlendirir (görev türü, token uzunluğu, embedding benzerliği, güven) ve basit sorguları ucuz bir modele göndererek karmaşık olanları bir sınır modeline yükseltir. Ayrıca model basamaklı olarak da adlandırılır. Üretim vaka çalışmaları, ABD/İngiltere/AB deployment'lerde izo kalitesinde %20-60 maliyet düşüşü gösteriyor; Yüksek hacimli SaaS'ta %30'luk yönlendirme verimliliği artışı, altı haneli yıllık tasarruflara dönüşüyor. 2026 bağlamı, LLM inference fiyatlarının yılda yaklaşık 10 kat düştüğü yönünde — GPT-4 sınıfı bir token, 2022'nin sonlarından 2026'ya kadar $20/M to ~$0.40/M'den geldi. Düşüşün çoğu, donanımdan değil, daha iyi hizmet veren yığınlardan (Aşama 17 · 04-09) kaynaklanıyor. Yönlendirme, ürün gerilemesi olmadan bu fiyat düşüşünü marja nasıl dönüştürdüğünüzdür. Başarısızlık modu ucuz model sürüklenmesidir: rota %40'ı daha zayıf bir modele iter, muhakeme görevlerinde kalite %3-5 düşer, çeyrek boyunca kimse fark etmez. Rotaları yalnızca çevrimdışı değerlendirme kümelerine göre değil, çevrimiçi kalite ölçümlerine göre de değerlendirin.

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak basamaklı yönlendirici simülatörü)
**Önkoşullar:** Aşama 17 · 01 (Yönetilen LLM Platformları), Aşama 17 · 19 (AI Ağ Geçitleri)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Model basamaklandırmasını açıklayın: önce ucuza güven kontrolü yapın, düşük güveni artırın.
- Dört yönlendirme sinyalini numaralandırın (görev sınıflandırması, prompt uzunluğu, embedding bilinen sabit kümeye benzerlik, ilk geçişten itibaren özgüven).
- Hedef yönlendirme bölümünde beklenen karma maliyeti ve kalite kaybı toleransını hesaplayın.
- Ucuz model kaymasını yakalayan sürüklenme izleme metriğini (çevrimiçi kalite kapısı) adlandırın.

## Sorun

Hizmetinizin maliyeti GPT-5'te ayda 80 bin ABD dolarıdır. Analitikleriniz sorguların %70'inin basit olduğunu gösteriyor: "Paris'te saat kaç?" "Bu cümleyi yeniden söyle." Haiku sınıfı bir model, maliyetin %3'ü karşılığında bunları mükemmel bir şekilde halleder. %30'u GPT-5'in mantığına (kodlama, matematik, çok adımlı planlama) ihtiyaç duyuyor.

Eğer %70'i ucuza, %30'u pahalıya yönlendirirseniz aynı ürün kalitesinde faturanız ~%65 düşer. Bu yönlendirmedir. İşin püf noktası, komisyoncuyu kaliteyi düşürmeden oluşturmaktır.

## Konsept

### Dört yönlendirme sinyali

1. **Görev sınıflandırması**: basit/karmaşık/kod oluşturma/matematik/sohbet. Kurallara dayalı bir sınıflandırıcı, küçük bir Yüksek Lisans (0,25 ABD Doları/milyon değerindeki Haiku sınıfı) veya etiketli paketlere embedding benzerliği olabilir. Çıktı: rota = ucuz / dengeli / sınır.

2. **Prompt uzunluğu**: prompt'ler >4K token'ler tutarlılık için genellikle sınıra ihtiyaç duyar. Prompt'ler <500 token'ler genellikle bunu yapmaz.

3. **Embedding bilinen sabit kümeye benzerlik**: sorgu bilinen sabit kümeye yakınsa (kosinüs > 0,88), doğrudan sınıra iletin.

4. **İlk geçişten itibaren özgüven**: ucuza gönder; modelin log-prob'ları düşük güven gösterirse VEYA reddederse VEYA riskten korunma dili çıkarırsa, sınırda yeniden deneyin. Trafiğin ~%10'una P95 gecikmesi ekler, ancak diğer %90'da %50'den fazla tasarruf sağlar.

### Üç desen

**Yönlendirme öncesi** (öndeki sınıflandırıcı): ~5-10ms gecikme eklendi; genel olarak en hızlı.

**Kademeli** (önce ucuz, düşük güven durumunda üst kademeye iletir): ~1,2x ortalama gecikme (ucuz çalıştırma artı doğrulama), üst kademeye aktarıldığında ~2x. En kaliteli zemin.

**Topluluk rotası** (bir örnek için paralel olarak ucuz ve sınır koşusu yapın, ödül modeli seçimi): en yüksek kalite, en yüksek maliyet; yalnızca kritik A/B için kullanın.

### Uygulama

AI ağ geçitleri (Aşama 17 · 19) yönlendirmeyi açığa çıkarır. LiteLLM, geri dönüş ve maliyet yönlendirme özelliğine sahip `router` yapılandırmasına sahiptir. Portkey'de korumalar + yönlendirme bulunur. Kong AI Gateway, eklenti tabanlı yönlendirmeye sahiptir. OpenRouter'ın model pazarı bir öneri API'si sunar.

Açık kaynak: RouteLLM (LMSYS), Not Diamond (ticari), Prompt Mule.

### 2026 fiyat eğrisi

| Modeli sınıfı | 2022 Sonu | 2026 | Değiştir |
|-------------|-----------|------|--------|
| GPT-4 düzeyinde kalite | ~$20/M | ~$0.40/M | 50 kat daha ucuz |
| Sınır (GPT-5, Claude 4) | — | ~3-10$/milyon | yeni seviye |

İyileştirmelerin çoğu verimliliğe hizmet ediyor; 17. Aşama · 04-09'daki temel dersler sağlayıcı tarafında maliyet düşüşlerine dönüştü. Yönlendirme, tüm kullanıcılarınızın ucuz katmana geçmesini beklemek yerine bu kazanımları uygulama katmanında yakalamanıza olanak tanır.

### Sürüklenme gerçek risktir

Rotanız ucuz modele %40 gönderiyor. Altı ay boyunca görev dağılımı değişiyor (kullanıcılar daha bilgili hale geliyor, daha uzun sorular soruyor). Yönlendirici bunu fark etmez çünkü sınıflandırıcısı Q1 verileri üzerinde eğitilmiştir. Kalite sessizce düşüyor. Kimse yeterince yüksek sesle şikayet etmiyor. Kaybettiğinizi bir rakip benchmark'de öğrenirsiniz.

Çevrimiçi kalite ölçümlerine göre rotalara geçiş yapın:

- Rota başına kullanıcı beğenmedi / beğenmedi.
- Rota başına uzatılan bir numunede (%5) otomatik LLM hakemi.
- Yükselme oranı: Eğer kademelendirme rotayı %30'dan fazla yükseltiyorsa, ucuz model aşırı yönlendiriliyor demektir.
- Rota başına ret oranı.

### Hatırlamanız gereken sayılar

- 2026'da izo kalitesinde yönlendirme tasarrufu: %20-60 vaka çalışmaları.
- Yüksek Lisans fiyat düşüşü 2022-2026: Yıllık toplam ~10 kat.
- GPT-4 düzeyi 2022 ve 2026: ~$20/M → ~$0.40/M.
- Kademeli gecikme etkisi: ~1,2x ortalama, ~2x artan (trafiğin ~%10'u).

## Kullan onu

`code/main.py`, karma bir iş yükünde ön yönlendirmeyi, basamaklamayı ve topluluğu simüle eder. Maliyeti, kalite kaybını ve artış oranını karma olarak raporlar.

## Gönderin

Bu ders `outputs/skill-router-plan.md`'yi üretir. İş yükü ve kalite bütçesi göz önüne alındığında, bir yönlendirme modeli ve sinyaller seçer.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Basamak hangi doğruluk seviyesinde ön rotayı geçiyor?
2. Kullanıcı tabanınızın %30'u kurumsal (karmaşık sorgular), %70'i ücretsiz katmandan (basit) oluşur. Yönlendirme bölümünü tasarlayın. Hangi çevrimiçi metrik bunu engelliyor?
3. Rota kaliteyi %2 düşürür ancak %40 tasarruf sağlar. Bu bir gemi mi? Ürüne bağlıdır; ikisini de tartışın.
4. OpenAI / Anthropic API'lerindeki logprob'ları kullanarak bir güven kontrolü uygulayın. Başladığınız eşik nedir?
5. Altı ay içinde artış oranı %8'den %22'ye çıktı. Üç nedeni teşhis edin ve her biri için düzeltme yapın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Model yönlendirme | "maliyet komisyoncusu" | Talep başına dinamik model seçimi |
| Model çağlayan | "önce ucuza yükseltme" | Ucuza koşun, düşük güven nedeniyle sınırlara ulaşın |
| Rota öncesi | "önce sınıflandır" | Sınıflandırıcı önde; yeniden çalıştırma yok |
| Topluluk rotası | "paralel seçim" | Birden fazla ödül modeliyle en iyi seçimleri yapın |
| Eskalasyon oranı | "yönlendirilen %" | Artan basamaklı isteklerin oranı |
| RotaLLM | "LMSYS yönlendiricisi" | OSS yönlendirici kitaplığı |
| Elmas Değil | "ticari yönlendirici" | SaaS model yönlendirme ürünü |
| Sürüklenme | "ucuz sürünme" | Yönlendiricinin farkına varmadan dağıtım değişimi |
| Çevrimiçi kalite kapısı | "canlı kontrol" | Otomatik yüksek lisans jürisi canlı trafik örneklemesi |

## Daha Fazla Okuma

- [AbhyashSuchi — Model Yönlendirme LLM 2026 En İyi Uygulamaları](https://abhyashsuchi.in/model-routing-llm-2026-best-practices/)
- [Lukas Brunner — Inference Optimizasyonunun Yükselişi 2026](https://dev.to/lukas_brunner/the-rise-of-inference-optimization-the-real-llm-infra-trend-shaping-2026-4e4o)
- [RotaLLM kağıdı / kodu](https://github.com/lm-sys/RouteLLM)
- [Diamond Değil — model yönlendirme](https://www.notdiamond.ai/)
- [OpenRouter](https://openrouter.ai/) — yönlendirme temellerine sahip çok modelli ağ geçidi.
