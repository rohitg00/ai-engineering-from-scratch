# Uzun Süreli Arka Plan Agent'ler: Dayanıklı Yürütme

> Üretim uzun ufuklu agent'ler `while True`'de çalışmaz. Her LLM çağrısı, kontrol noktası, yeniden deneme ve tekrar oynatma içeren bir etkinliğe dönüşür. Temporal'ın OpenAI Agent SDK entegrasyonu Mart 2026'da GA'ya geçti. Claude Kod Rutinleri (Antropik), kalıcı bir yerel süreç olmadan planlanmış Claude Kodu çağrılarını çalıştırır. Oturumlar insan girişiyle duraklatılır, dağıtımlardan sağ çıkar ve `thread_id` tarafından anahtarlanan en son denetim noktasından devam edilir. Yeni ergonominin arkasında, yeni bir girdiyle eski bir kalıp (iş akışı orkestrasyonu) yatıyor: LLM, iyileşme sırasında deterministik olarak yeniden oynatılması gereken, deterministik olmayan faaliyetler olarak çağrılıyor.

**Tür:** Öğren
**Diller:** Python (stdlib, minimum kalıcı yürütme durumu makinesi)
**Önkoşullar:** Aşama 15 · 10 (İzin modları), Aşama 15 · 01 (Uzun ufuk agent'ler)
**Süre:** ~60 dakika

## Sorun

Dört saat boyunca çalışan bir agent düşünün. Üç aracı çağırır, kullanıcıyı iki kez prompt arar ve kırk LLM çağrısı yapar. Yarı yolda, çalıştığı ana bilgisayar yeniden başlatılıyor. Ne oluyor?

- Saf bir `while True` döngüsünde: her şey kaybolur. Koşu sıfırdan yeniden başlar. Üç araç çağrısı (gerçek yan etkilerle birlikte) yeniden yürütülür. Kullanıcı zaten onayladığı şeyler için tekrar prompt'lenir. Kırk LLM çağrısı yeniden faturalandırılır.
- Dayanıklı yürütme ile: çalışma en son kontrol noktasından devam eder. Halihazırda tamamlanan faaliyetler yeniden yürütülmez; sonuçları dayanıklı kayıttan tekrar oynatılır. Kullanıcı daha önce onayladığı şeyleri yeniden onaylamaz. Halihazırda yapılmış olan LLM çağrıları yeniden faturalandırılmaz.

Bu, on yıldır (Temporal, Cadence, Uber'in Cherami'si) üretilen iş akışı motorlarının aynı modelidir. Yeni olan, LLM çağrılarının artık belirleyici olmayan, pahalı ve yan etkileri olan bir tür faaliyet haline gelmesi ve bu kalıba net bir şekilde uymasıdır.

Dersin ana teması: uzun ufukta güvenilirlik azalıyor (METR "35 dakikalık bir bozulma" gözlemliyor; başarı oranı ufukla kabaca ikinci dereceden düşüyor). Dayanıklı yürütme, güvenilirlik profili desteklerinden daha uzun çalışmalara olanak tanır; bu, tasarım doğruysa güvenli bir şekilde, tasarım yanlışsa güvenli olmayan bir şekilde arızalanmanın yeni bir yoludur.

## Konsept

### Etkinlikler, iş akışları ve tekrar oynatma

- **İş Akışı**: deterministik düzenleme kodu. Faaliyetlerin sırasını, dalları, beklemeleri tanımlar. Şaşırtıcı bir farklılık olmadan olay günlüğünden tekrar oynatılabilmesi için deterministik olmalıdır.
- **Etkinlik**: Belirleyici olmayan, potansiyel olarak başarısız olan bir iş birimi. LLM çağrısı, araç çağrısı, dosya yazma, HTTP isteği. Her aktivite, girdileri ve (tamamlandıktan sonra) çıktılarıyla birlikte günlüğe kaydedilir.
- **Olay günlüğü**: dayanıklı destek deposu. Her aktivite başlar, tamamlanır, başarısız olur, yeniden denenir ve her iş akışı kararı kaydedilir.
- **Yeniden Oynat**: kurtarma sırasında iş akışı kodu baştan itibaren yeniden çalıştırılır; Halihazırda tamamlanmış olan her etkinlik, yeniden yürütülmeden günlüğe kaydedilen sonucunu döndürür. Yalnızca tamamlanmayan faaliyetler gerçekte yürütülür.

Bu, React'in sanal bir DOM'a karşı yeniden işlemesi veya Git'in taahhütlerden çalışan bir ağacı yeniden oluşturmasıyla aynı şekildir. Dayanıklılığı ucuz kılan şey, orkestratördeki determinizmdir.

### Yüksek Lisans çağrıları neden bu kalıba uyuyor?

LLM çağrıları:
- Belirleyici değildir (sıcaklık > 0; hatta sıcaklık 0 model versiyonları arasında farklılık gösterir).
- Pahalı (para ve gecikme).
- Potansiyel olarak başarısız olma (hız sınırları, zaman aşımları).
- Yan etkili (araçları çağırırlarsa).

Bu tam olarak etkinlik profilidir. Her LLM çağrısını bir etkinlik olarak sarmalamak, üstel geri çekilmeyle yeniden denemenizi, yeniden başlatmalar arasında kontrol noktası belirlemenizi ve hata ayıklama için tekrar oynatılabilir bir izleme olanağı sağlar.

### `thread_id` tarafından anahtarlanan kontrol noktaları

LangGraph, Microsoft Agent Framework, Cloudflare Dayanıklı Nesneler ve Claude Kod Rutinlerinin tümü aynı API şeklinde birleştirilmiştir: bir `thread_id` (veya eşdeğeri) oturumu tanımlar; her durum geçişi bir arka uca devam eder (varsayılan PostgreSQL, geliştirme için SQLite, önbellek için Redis); özgeçmiş en son kontrol noktasını okur.

Arka uç seçimi önemlidir:

- **PostgreSQL**: dayanıklı, sorgulanabilir, dağıtımlardan sağ kurtulur. LangGraph için varsayılan.
- **SQLite**: yalnızca yerel geliştirme; ana bilgisayarlar arasında veri kaybeder.
- **Redis**: hızlı ancak AOF/anlık görüntü yapılandırılmadığı sürece geçicidir.
- **Cloudflare Dayanıklı Nesneler**: şeffaf olarak dağıtılır; benzersiz bir anahtar kapsamındadır; saatlerce, haftalarca hayatta kalır.

### Birinci sınıf bir durum olarak insan girdisi

Teklif et-sonra-taahhüt et (Ders 15), kalıcı bir "insanı bekleme" durumunu gerektirir. İş akışı duraklatılır, harici kuyruk bekleyen isteği tutar ve onay tam olarak bu noktadan itibaren devam eder. Dayanıklılık olmadan bu en iyi çabadır; bununla birlikte bir gecede onay gelir ve iş akışı sabah başlar.

### 35 dakikalık bozulma

METR, ölçülen her agent sınıfının ~35 dakikalık sürekli çalışmanın ötesinde güvenilirlik kaybı gösterdiğini gözlemledi. Görev süresinin iki katına çıkarılması başarısızlık oranını kabaca dört katına çıkarır. Kalıcı uygulama bunu düzeltmez; güvenilirlik profilinin desteklediğinden daha uzun süre çalışmanıza olanak tanır. Güvenli model, dayanıklılığı yeniden girişte yeni HITL gerektiren kontrol noktalarıyla ve duvar saati süresine bakılmaksızın toplam hesaplamayı sınırlayan bütçe kapatma anahtarlarıyla (Ders 13) birleştirmektir.

### Kalıcı uygulama yanlış cevap olduğunda

- Hiçbir insan müdahalesi olmadan birkaç dakikadan daha kısa çalışır. Genel gider > fayda.
- Kesinlikle salt okunur bilgi alımı.
- Doğruluğun tek bir context window dahilinde uçtan uca gerektirdiği görevler (bazı muhakeme görevleri; bazıları tek seferlik oluşturma).

```figure
memory-consolidation
```

## Kullan onu

`code/main.py`, stdlib Python'da minimum düzeyde dayanıklı bir yürütme motoru uygular. Şunları destekler:

- Girişleri ve çıkışları bir JSON olay günlüğüne kaydeden `@activity` dekoratörü.
- Faaliyetleri sıralayan bir iş akışı işlevi.
- Tamamlanan etkinlikleri yeniden yürütmeden yeniden oynatan bir `run_or_replay(workflow, event_log)` işlevi.

Sürücü, üç etkinlikli bir iş akışını simüle eder, yarı yolda çöker ve (a) her şeyi yeniden yürüten basit bir yeniden denemeye karşı (b) yalnızca eksik etkinliği çalıştıran bir tekrar gösterir.

## Gönderin

`outputs/skill-durable-execution-review.md`, doğru dayanıklı yürütme şekli için önerilen uzun süreli agent deployment'yi inceliyor: etkinlikler, determinizm, denetim noktası arka ucu, insan girişi durumu ve devam ettirildiğinde HITL politikası.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Saf yeniden deneme ve yeniden yürütme arasındaki etkinlik yürütme sayısındaki farkı gözlemleyin. Kilitlenme noktasını değiştirin ve tekrar sayısındaki değişiklikleri buna göre gösterin.

2. Oyuncak motorunu açıkça `thread_id` kullanacak şekilde dönüştürün. Motoru paylaşan iki eşzamanlı oturumu simüle edin ve olay günlüklerinin çakışmadığını doğrulayın.

3. Oyuncak motorunda bir aktivite yapın. Belirlenimsizliği (bir iş akışı kararının içinde bir duvar saati zaman damgası) tanıtın. Tekrar oynatıldığında farklılığı gösterin. Gerçek motorların bunu nasıl ele aldığını açıklayın (yan etki kaydı, `Workflow.now()` API'ler).

4. LangChain'in "Derin üretim agent'lerin arkasındaki çalışma zamanı" yazısını okuyun. Çalışma zamanının devam ettiği her durumu listeleyin ve her birinin kapsadığı hata modunu adlandırın.

5. 6 saatlik otonom kodlama görevi için bir kontrol noktası politikası tasarlayın. Nerede kontrol noktası var? Kilitlenme durumunda devam etme neye benziyor? Taze HITL'i ne gerektirir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|---|---|---|
| İş Akışı | "Agent'nin betiği" | Deterministik düzenleme kodu; olay günlüğünden tekrar oynatılabilir |
| Etkinlik | "Bir adım" | Belirleyici olmayan birim (LLM çağrısı, araç çağrısı); öncesi ve sonrası oturum açıldı |
| Olay günlüğü | "Destek mağazası" | Her durum geçişinin dayanıklı kaydı |
| Tekrar | "Devam Et" | İş akışını yeniden çalıştırın; tamamlanan etkinlikler, yeniden yürütülmeden günlüğe kaydedilen sonuçları döndürür |
| Kontrol noktası | "Noktayı kaydet" | Thread_id tarafından anahtarlanan kalıcı durum; özgeçmişte son zaferler |
| thread_id | "Oturum anahtarı" | Dayanıklı durumu kapsayan tanımlayıcı |
| 35 dakikalık bozulma | "Güvenilirliğin azalması" | METR: başarı oranı ~ufukla birlikte ikinci dereceden düşüyor |
| Determinizmsizlik | "Tekrar oynatıldığında sürüklenme" | Duvar saati, rastgele, LLM çıkışı; yan etki olarak kaydedilmelidir |

## Daha Fazla Okuma

- [Antropik — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) — bütçe, dönüşler ve özgeçmiş semantiği.
- [Microsoft — Agent Framework: döngüdeki insan ve denetim noktası oluşturma](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — requestInfoEvent şekli.
- [LangChain — Derin Üretimin Arkasındaki Çalışma Zamanı Agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) — somut çalışma zamanı gereksinimleri.
- [OpenAI Agents SDK + Geçici entegrasyon (Trigger.dev duyurusu)](https://trigger.dev) — Yüksek Lisans çağrıları için etkinlik şekli.
- [Antropik — agent özerkliğinin pratikte ölçülmesi](https://www.anthropic.com/research/measuring-agent-autonomy) — 35 dakikalık bozulma referansı.
