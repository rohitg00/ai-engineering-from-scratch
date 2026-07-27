# Anahtarları, Devre Kesicileri ve Kanarya Token'ları Kapat

> Bir kill anahtarı, agent'ın düzenleme yüzeyinin dışında tutulan ve agent'ı tamamen devre dışı bırakan bir booledir (bir Redis anahtarı, bir özellik bayrağı, imzalı bir yapılandırma). Devre kesici daha hassastır: belirli bir düzende açar (arka arkaya beş aynı alet çağrısı), rahatsız edici yolu duraklatır ve bir insana iletir. Bir kanarya token, klasik aldatmacadan miras alır: sahte bir kimlik bilgisi veya bal küpü kaydı, bir agent'ın dokunmak için meşru bir nedeni yoktur ve erişimi bir uyarıyı tetikler. eBPF tabanlı veri yolları (e.g. Cilium), karantinaya alınan bir kapsülün çekirdek katmanındaki adli balküpüne çıkışını yeniden yazabilir; Cilium benchmark'ın yük altında milisaniyeden kısa P99 veri yolu gecikmesi raporunu yayınladı (yayılma bütçeniz veri yolunun kendisine değil, bir politika güncellemesinin düğüme nasıl ulaştığına bağlıdır). Hareketli bir taban çizgisine uyum sağlayan istatistiksel dedektörler (EWMA, CUSUM), sapmayı sessizce kabul edecek ve bunları bükülmeyen katı yapısal sınırlarla katmanlandıracaktır.

**Tür:** Öğren
**Diller:** Python (stdlib, üç dedektörlü simülatör: acil anahtar, devre kesici, kanarya)
**Önkoşullar:** Aşama 15 · 13 (Maliyet yöneticileri), Aşama 15 · 10 (İzin modları)
**Süre:** ~60 dakika

## Sorun

Maliyet yöneticileri (Ders 13) agent'ın harcayabileceği miktarı sınırlar. agent'ın bütçe dahilinde yapabileceklerini sınırlamazlar. Hız sınırı 50$ olan bir agent yine de bir sırrı sızdırabilir, yanlış gönderiyi yayınlayabilir veya bir kaynağı silebilir — pahalı eylem genellikle token saniyelerindeki ucuz eylemdir.

Bu ders, maliyet katmanının yanında yer alan üç dedektörü kapsar:

1. **Kill anahtarı**: agent'ın erişim alanı dışında tutulan boolean kapatma düğmesi.
2. **Devre kesici**: belirli bir yolu duraklatan eylem modeli dedektörü.
3. **Kanarya token**: dokunmak için geçerli bir nedeni olmayan bir agent'ın dokunarak kendini açığa çıkarmasına yönelik yem.

Üçü de LLM öncesi mühendisliktir. Klasik aldatma, hız sınırı ihlalleri ve özellik işaretli öldürmeler, otonom agent'lardan önce ortaya çıkar. Yeni olan, saldırı yüzeyindeki yeniliktir: agentgüvenilmeyen içeriği okur (Ders 11), kendi hafızasını düzenler ve güvenli görünen birçok eylemi güvenli olmayan bir eyleme dönüştürebilir. Burada adı geçen dedektörler agent'ın kendi raporuna güvenmedikleri için çalışıyorlar.

## Konsept

### Anahtarları sonlandır

Kill switch, agent'ın okuduğu ancak yazamadığı bir boole değeridir. Uygulama seçenekleri:

- **Yönetilen bir hizmette özellik işareti.** LaunchDarkly, Statsig, Unleash. Güncellemeler saniyeler içinde yayılır.
- **agent anketini yeniden düzenleyin.** Basit; agent işleminin her fırsatta kontrol edilmesini gerektirir.
- **Nesne depolamada imzalı yapılandırma.** Agent önyükleme sırasında bir imzayı doğrular; imzasız durumları reddeder.
- **İşletim sistemi düzeyinde sinyal veya kapsayıcı yaşam döngüsü sonlandırması.** Docker `kill`, Kubernetes `kubectl delete pod`, sistem durdurma.

Doğru bir kill anahtarının sahip olduğu özellikler:

- agent onu `off` olarak ayarlayamaz. (agent'ın kimlik bilgilerinin yazılmadığı bir sistemde yaşıyor.)
- Yalnızca başlangıçta değil, her sonuçsal eylemde kontrol edilir.
- Kapalıyken, agent, agent'ın erişebileceği sistemlere giriş yapmak dahil, harici olarak gözlemlenebilir hiçbir şey yapmaz.
- Yeniden etkinleştirme, otomatik bir zaman aşımı değil, açık bir insan eylemidir.

### Devre kesiciler

Bir devre kesici, agent'ın tamamını değil, belirli bir düzeni duraklatır. Klasik şekil (2007 Nygard kitabından, hala güncel):

- **Kapalı**: eyleme izin verilir.
- **Açık**: eylem engellenir.
- **Yarı açık**: soğuma sonrasında 1-3 prob denemesine izin verilir (varsayılan 1); başarı kesiciyi kapatır, kalan başarısızlık onu yeniden açar.

Agent-ilgili tetikleyiciler:

- Arka arkaya beş aynı araç çağrısı (tekrarlayan döngü).
- Aynı alet üzerinde farklı girdilerle art arda beş arıza (sistemik arıza).
- Bir eşiğin üzerindeki takım çağrılarının oranı (Ders 13 hız).
- Güvenilmez içerik okunduktan sonra belirli bir araç çağrıldı (e.g., `file.delete`) (Ders 11).

### Kanarya tokens

Kanarya token'lar (baltoken'lar olarak da adlandırılır), agent'ın asla dokunmaması gereken girdilerdir. Erişim alarmdır.

agent'lar için örnekler:

- Ortamda gerçek ayrıcalığı olmayan sahte bir `AWS_SECRET_ACCESS_KEY` . Dışarı sızma girişimleri anında ilişkilendirilebilir.
- Bilinen bir sentinel değeriyle işaretlenmiş sahte bir veritabanı kaydı. Bu kaydın okunması veya güncellenmesi bir uyarıyı tetikler.
- Çalışma alanında sahte bir dosya. Bu dosyanın okunması veya düzenlenmesi şüphelidir.
- Oturum başlangıcında enjekte edilen sahte bir hafıza girişi. Daha sonraki bir çıktıda görünüyorsa, bellek dışarı sızdırılmıştır.

Canary tasarımı iş akışına özeldir. agent'ın dokunmak için meşru bir nedeni olan bir kanarya gürültüdür.

### Neden istatistiksel ve kesin sınırlar katmanlandırılır?

İstatistiksel dedektörler (EWMA, CUSUM, araç çağırma oranlarındaki z puanı) hareketli bir taban çizgisine uyum sağlar. Bu, meşru drift için bir özelliktir ve düşmanca drift için bir hatadır. Sabırlı bir saldırgan, taban çizgisini hiçbir alarmın tetiklenmeyeceği kadar yavaş bir şekilde değiştirebilir.

Katı anayasal sınırlar (Ders 17) esnemez. " `secrets@`'a asla e-posta gönderme" anayasal bir kural olduğundan daha basit, denetlenebilir ve yavaş sürüklenerek oynanamaz. Katmanlama modeli: istatistiksel dedektörler gürültünün çoğunu yakalar, katı sınırlar ise dedektörün yanından geçen saldırıları yakalar.

### eBPF veri yolu yönlendirmesi yoluyla karantina

Cilium'un eBPF tabanlı ağ politikası, karantinaya alınan bir kapsülün çekirdek katmanındaki adli balküpüne çıkışını yeniden yazabilir. Cilium'un genel benchmarks raporu TCP_RR'de milisaniyenin altındaki P99 veri yolu gecikmesini; Kümenizde bir karantinayı *tetiklemek* için gereken duvar saati bütçesi, bir politika güncellemesinin kontrol düzleminizden düğüme nasıl yayıldığı tarafından belirlenir (operatörün önceden yüklendiği Kubernetes'te birkaç yüz milisaniye gerçekçidir; kuyruk gecikmesi küme boyutuna ve uyum ritmine bağlıdır). Bu size iki şey verir: agent gerçek hiçbir şeyi dışarı sızdırmaz ve agent'ın bal küpü içindeki davranışı tamamen gözlemlenir. Kanarya token ile aynı model, farklı katman: agent, kontrol altındayken yapmaya çalıştığı şeyle amacını ortaya koyar.

### Hiçbir dedektörün yakalayamadığı şey

- **İzin verilen ilkellerden oluşan anlamsal saldırılar.** Her bireysel eylem, her dedektörden geçer; kompozisyon sorundur. Bu, Ders 10'daki Otomatik Mod bileşik hatasıdır.
- **Yük yükünün bir parçası olarak dedektörü içeren saldırılar.** Bir agent, "harekete geçmeden önce kanaryayı devre dışı bırakın" yazan bir sayfayı okursa ve agent bu yeteneğe sahipse, dedektörün güvenliği ihlal edilir. Kanarya token'lar, agent'ın değiştiremeyeceği sistemlerde olmalıdır.

## Use It — Hazır Araçla Uygula

`code/main.py` , üç dedektör aracılığıyla kısa bir agent yörüngesini simüle eder. Harici bir dict'de tutulan bir öldürme anahtarı; beş aynı alet çağrısında devreye giren bir devre kesici; okunması bir uyarıyı tetikleyen bir kanarya dosyası. Sentetik bir yörüngedeki beslemeler: meşru eylemler, tekrarlayan döngü, kanarya araştırması ve agent'ın eylemlerinin durdurulduğu, öldürme anahtarıyla tetiklenen bir senaryo.

## Ship It — Kullanıma Sun

`outputs/skill-tripwire-design.md` , bir agent deployment için önerilen dedektör yığınını inceler ve boşlukları işaretler (eksik öldürme anahtarı, eksik kanarya, devre kesici eşiği çok gevşek).

## Egzersizler

1. `code/main.py`'yı çalıştırın. Devre kesicinin 5. virajda (beşinci aynı çağrı) ve kanaryanın 9. virajda (sahte anahtar okuma) ateşlendiğini doğrulayın.

2. İstatistiksel bir dedektör ekleyin: Araç çağırma oranına ilişkin EWMA z puanı. Yavaşça kayan ve dedektörün asla ateşlenmediğini gösteren bir yörüngede ilerleyin. Şimdi bir kesin sınır ekleyin (10 dakika içinde en fazla 50 araç çağrısı) ve aynı yörüngedeki kesin sınır atışlarını gösterin.

3. Tarayıcı agent için bir kanarya token seti tasarlayın (Ders 11). En az üç kanaryayı ve her birinin neyi tespit edeceğini listeleyin.

4. Cilium ağ politikası belgelerini okuyun. Çıkış yönlendirmeli karantina akışını somut bir şekilde açıklayın: hangi politika seçici, hangi bölme, hangi çıkış yeniden yazma, hangi uyarı. "Karantinaya almaya karar verme" aşamasından "ilk yeniden yönlendirilen pakete" kadar duvar saati gecikmesini ne yönetir?

5. Kill-switched agent için yeniden etkinleştirme prosedürünü tanımlayın. Kimler yeniden etkinleştirebilir? Neler belgelenmelidir? Yeniden etkinleştirmeden önce agent ile ilgili nelerin değişmesi gerekir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|---|---|---|
| Kapatma anahtarı | "Kapatma düğmesi" | agent'ın düzenleme yüzeyinin dışındaki Boolean; her sonuçsal eylemde kontrol edildi |
| Devre kesici | "Desen duraklatma" | Tekrarlama, başarısızlık oranı veya hız sınırı nedeniyle eyleme özel hata |
| Kanarya token | "Tatlımtoken" | Yemin agent'a dokunmak için meşru bir nedeni yok; erişim bir uyarı tetikliyor |
| Balküpü | "Adli sanal alan" | Karantinaya alınan bir agent'ın gözlemlendiği trafik/çalışma alanı yönlendirildi |
| EWMA | "Hareketli ortalama" | Üstel ağırlıklı; sürüklenmeye uyum sağlar (özellik + hata) |
| ÖZEL | "Kümülatif toplam" | Temel çizgiden sürekli değişimi algılar |
| Kesin sınır | "Anayasa kuralı" | Uyum sağlamaz; geçmişten bağımsız olarak sabit |
| Anayasal sınır | "Her zaman doğru kuralı" | Ders 17'nin tüzüğüne bağlı; agent tarafından düzenlenemez |

## Daha Fazla Okuma

- [Antropik — Uygulamada agent özerkliğinin ölçülmesi](https://www.anthropic.com/research/measuring-agent-autonomy) — özerk agent'lar için devre kesici ve devre kesici çerçeveleme.
- [Microsoft Agent Framework — HITL ve gözetim](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — üretim yönetişim kalıpları.
- [OWASP LLM / Agentic Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/) — tespit ve yanıt gereksinimleri.
- [Cilium — Ağ politikası ve eBPF](https://docs.cilium.io/en/stable/security/network/) — bölme düzeyinde çıkış yönlendirmesi ve adli bal küpü modelleri.
- [Antropik — Claude Anayasası (Ocak 2026)](https://www.anthropic.com/news/claudes-constitution) — "anayasal sınırlar" olarak sabit kodlu yasaklar.
