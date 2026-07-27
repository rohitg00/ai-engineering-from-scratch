# LLM'ler için FinOps — Birim Ekonomisi ve Çok Kiracılı İlişkilendirme

> LLM harcamalarında geleneksel FinOps molaları. Maliyetler, kaynak çalışma süresi değil, token işlemleridir. Etiketler eşlenmez; API çağrısı bir varlık değil, bir işlemdir. Mühendislik kararları (prompt tasarımı, context window, çıktı uzunluğu) finansal kararlardır. 2026 başucu kitabının birinci günde cihaza ilişkin üç ilişkilendirme boyutu vardır: lisans fiyatlandırması ve genişletme için kullanıcı başına (`user_id`), ürün yüzeyi maliyeti ve önceliklendirme için görev başına (`task_id` + `route`), birim ekonomi ve yenileme için kiracı başına (`tenant_id`). Dört token katmanı — prompt, araç, bellek, yanıt — bir bölme harcamayı gizler. Çok kiracılı ürünler için yaptırım merdiveni: kiracı başına oran sınırları (beklenen zirvenin 2-3 katı, temizleme 429 + yeniden deneme); günlük harcama üst sınırı (1,5-3 kat sözleşmeli tavan; oran sıkılaştırmasını tetikler + uyarı); z-puanı > 4 (otomatik duraklatma + çağrı sırasında sayfa) harcamalarında anahtarları sonlandır. İlişkilendirme modelleri: etiketleme ve toplama, telemetri-birleştirici (izleme kimliği → faturalandırma; en yüksek doğruluk), örnekleme ve ekstrapolasyon, model tabanlı tahsis, olay kaynaklı, gerçek zamanlı akış. Birim metriği: çözümlenen sorgu başına maliyet, oluşturulan artifact başına maliyet - $/M token değil. Geriye dönük etiketleme her zaman ıskalar; istek üzerine enstrüman oluşturma.

**Tür:** Öğren
**Diller:** Python (stdlib, acil anahtarlı oyuncak maliyet ilişkilendirme simülatörü)
**Önkoşullar:** Aşama 17 · 13 (Observability), Aşama 17 · 14 (Önbelleğe Alma)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- LLM harcamalarında geleneksel FinOps'un (etiketler + kademeler) neden bozulduğunu açıklayın ve üç yeni ilişkilendirme boyutunu adlandırın.
- Dört token katmanını (prompt, araç, bellek, yanıt) ve tek paket faturalandırmanın maliyeti neden gizlediğini sıralayın.
- Çok kiracılı bir ürün için bir yaptırım merdiveni tasarlayın (oran → harcama sınırı → sonlandırma anahtarı).
- $/M token yerine bir birim metrik seçin (çözülen sorgu başına maliyet / artifact).

## Sorun

Faturanızda 40.000$ yazıyor. Bilmiyorsun:
- Hangi kiracı harcadı?
- Hangi ürün özelliği buna neden oldu?
- Herhangi bir kullanıcının kötü niyetli olup olmadığı.
- Suçlu ister prompt şişkinliği, ister araç çağrıları, ister hafıza amplifikasyonu olsun.

Sağlayıcı tarafında etiketleme ve toplama, etiketlerin satır öğelerine yayıldığı bulut kaynakları (EC2, S3) için çalışır. LLM API çağrıları otomatik etiketleme yapmaz; çağrı sitesinde kullanıcıyı/görevi/kiracıyı damgalamanız ve devam etmeniz gerekir. Geriye dönük ilişkilendirme her zaman uç durumları gözden kaçırır.

## Konsept

### Üç ilişkilendirme boyutu

**Kullanıcı başına** (`user_id`): kimin neye maliyeti var. Koltuk fiyatlandırmasını, genişleme konuşmalarını yönlendirir, uzman kullanıcıları belirler.

**Görev başına** (`task_id` + `route`): hangi ürün yüzeyinin maliyeti nedir? Sürücülerde önceliklendirme ve pahalı özelliklerin ortadan kaldırılması kararları bulunur.

**Kiracı başına** (`tenant_id`): hangi müşterinin karlı olduğu. Birim ekonomisini, yenileme fiyatlandırmasını ve katman eşiklerini yönlendirir.

İlk gün üçünü de arama yerinde kullanın. Geriye dönük her zaman daha kötüdür.

### Dört token katmanı

| Katman | Örnek | Toplamın tipik yüzdesi |
|-------|---------|---------------------|
| Prompt | sistem + kullanıcı girişi | %40-60 |
| Araç | araç çağrısı sonuçları geri beslendi | %20-40 (agent iş yükleri) |
| Bellek | önceki görüşme / alınan belgeler | %10-30 |
| Yanıt | modeli çıktısı | %10-30 |

Dördünün birden bir araya getirilmesi optimizasyonun kör olmasına neden olur. Bunları ilişkilendirme şemanızda parçalara ayırın.

### Yaptırım merdiveni

1. Kiracı başına **fiyat sınırı**. 2-3x beklenen zirve. `Retry-After` ile 429'u döndürün. Kiracı sürtüşmeyi görüyor; sürpriz fatura yok

2. Kiracı başına **günlük harcama sınırı**. 1,5-3x daraltılmış tavan. Tetikleyici: oran sınırını sıkılaştırın + müşteri başarısını uyarın.

3. Kiracının temel çizgisine göre harcama z-puanının > 4 olması durumunda **geçişi sonlandır**. Kiracıyı otomatik olarak duraklatın; çağrı sırasında sayfa; ops + CS'ye iletin.

### İlişkilendirme kalıpları

- **Etiketle ve topla**: damga meta veri başlıkları; daha sonra toplayın. Basit; kaba.
- **Telemetri birleştirici**: izleme kimlikleri aracılığıyla izlemeleri faturalandırmaya birleştirin. En yüksek doğruluk. Olgun takımların yaptığı şeyler.
- **Örnekleme + ekstrapolasyon**: %5-10 örnekleyin, çarpın. Kaba harcamalar için uygun maliyetli; kuyrukları özlüyor.
- **Modele dayalı tahsis**: maliyet etkeni çıkarımına yönelik regresyon. Etiketsiz eski veriler için.
- **Olay kaynaklı**: bir akıştaki etkinlik olarak maliyet (Kafka / Kinesis). Gerçek zamanlı.
- **Gerçek zamanlı akış**: kontrol paneli güncellemeleri bir saniyeden kısa sürede gerçekleşir.

### X başına maliyet birim metriktir

$/M tokens satıcının konuşmasıdır. Ürün metrikleri:

- Çözümlenen destek bileti başına maliyet.
- Oluşturulan makale başına maliyet.
- Başarılı agent görevi başına maliyet.
- Kullanıcı oturumu dakikası başına maliyet.

Maliyeti bir ürün sonucuna bağlayın. Aksi takdirde optimizasyon sabitlenmez.

### Maliyet ilişkilendirme izleme şekli

```
trace_id: abc123
  user_id: u_42
  tenant_id: t_7
  task_id: task_classify_doc
  route: model_haiku
  layers:
    prompt_tokens: 1800
    tool_tokens: 600
    memory_tokens: 400
    response_tokens: 150
  cost_usd: 0.0135
  cached_input: true
  batch: false
```

Her çağrıda yayınlayın. Veri gölünde saklayın. Boyut başına toplayın. Aşama 17 · 13 observability yığını bunun yaşadığı yerdir.

### Bileşik tasarruf yığını

Yığın: önbellek + toplu iş + rota + ağ geçidi. Dördüyle birlikte:
- Önbellek L2 (Aşama 17 · 14): ~10 kat daha ucuz girdi.
- Toplu (Aşama 17 · 15): %50 indirim.
- Ucuz modele geçiş (Aşama 17 · 16): %60 maliyet azalması.
- Ağ geçidi verimliliği (Aşama 17 · 19): artıklık + yeniden denemeler.

En iyi durum yığını: Saf başlangıç değerinin ~%5-10'u. Çoğu takımın 2-3 kolu devrededir; çok azı dördünü de istifler.

### Hatırlamanız gereken sayılar

- İlişkilendirme boyutları: kullanıcı başına, görev başına, kiracı başına.
- Dört token katmanı: prompt, araç, bellek, yanıt.
- Kapatma anahtarı: z-puanını > 4 harcayın.
- Birim metriği: çözümlenen sorgu başına maliyet, $/M token değil.
- Yığılmış optimizasyonlar: Taban çizgisinin ~%5-10'u mümkün.

## Kullan onu

`code/main.py`, üç katmanlı uygulama merdiveni ile çok kiracılı bir LLM hizmetini simüle eder. İstismarcı bir kiracıya enjekte eder ve durdurma anahtarının ateşlendiğini gösterir.

## Gönderin

Bu ders `outputs/skill-finops-plan.md`'yi üretir. Verilen ürün ve ölçek, ilişkilendirme şemasını ve uygulama merdivenini tasarlar.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Kill switch hangi z-puanında etkinleşir? Eşiği nasıl seçersiniz?
2. Kiracı başına, görev başına maliyet panosu tasarlayın. İlk olarak oluşturduğunuz 5 görünüm nedir?
3. En büyük kiracınız birim ekonomisi açısından olumsuz. Müşteri etkisine göre sıralanan üç müdahale önerin.
4. Bir destek ürünü için çözümlenen bilet başına maliyeti hesaplayın: 3 milyon token/bilet, ~800 bilet/gün, GPT-5 önbelleğe alınmış oran.
5. Geriye dönük etiketlemenin işe yarayıp yaramayacağını tartışın. Ne zaman kabul edilebilir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Kullanıcı başına ilişkilendirme | "kullanıcı düzeyinde maliyet" | `user_id` her aramaya damgalanır |
| Görev başına ilişkilendirme | "özellik maliyeti" | `task_id` + `route` ürün yüzeyini tanımlar |
| Kiracı başına ilişkilendirme | "müşteri maliyeti" | `tenant_id`; tahrik ünitesi ekonomisi |
| Dört token katmanı | "maliyet katmanları" | prompt + araç + bellek + yanıt |
| Oran sınırı | "429 koruma" | Ağ geçidinde uygulanan kiracı tavanı |
| Günlük harcama sınırı | "günlük tavan" | Kiracı kapsamlı bütçe ve uyarı |
| Kapatma anahtarı | "otomatik duraklatma" | Harcama z-puanı > 4, otomatik askıya alma işlemini tetikler |
| Çözümlenen başına maliyet | "ürün birimi metriği" | Maliyet, token'lere değil, ürün sonucuna bağlıdır |
| Telemetri marangozu | "fatura takibi" | En yüksek doğrulukta ilişkilendirme modeli |
| Yığılmış optimizasyon | "önbellek+toplu+rota+ağ geçidi" | Tasarrufların ~%5-10'a kadar artırılması |

## Daha Fazla Okuma

- [FinOps Vakfı — Yapay Zeka için FinOps'a Genel Bakış](https://www.finops.org/wg/finops-for-ai-overview/)
- [FinOps Okulu — Birim Başına Maliyet 2026 Kılavuzu](https://finopsschool.com/blog/cost-per-unit/)
- [Dijital Uygulamalı — Yüksek Lisans Agent Maliyet İlişkilendirmesi 2026](https://www.digitalapplied.com/blog/llm-agent-cost-attribution-guide-production-2026)
- [PointFive — Azure OpenAI'de Yönetilen Yüksek Lisanslar](https://www.pointfive.co/blog/finops-for-ai-economics-of-managed-llms-in-azure-open-ai)
