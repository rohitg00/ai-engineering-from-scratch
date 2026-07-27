# Anahtarları, Devre Kesicileri ve Kanarya Token'leri Kapatın

> Kill anahtarı, agent'nin düzenleme yüzeyinin dışında tutulan ve agent'yi tamamen devre dışı bırakan bir booledir (bir Redis anahtarı, bir özellik bayrağı, imzalı bir yapılandırma). Devre kesici daha hassastır: belirli bir düzende açar (arka arkaya beş aynı alet çağrısı), rahatsız edici yolu duraklatır ve bir insana iletir. Bir kanarya token, klasik aldatmacadan miras alır: agent'nin dokunmak için meşru bir nedeni olmayan ve erişimi bir uyarıyı tetikleyen sahte bir kimlik bilgisi veya bal küpü kaydı. eBPF tabanlı veri yolları (e.g. Cilium), karantinaya alınmış bir kapsülün çekirdek katmanındaki adli balküpüne çıkışını yeniden yazabilir; yayınlanan Cilium benchmark'ler, yük altında P99 veri yolu gecikmesini milisaniyenin altında rapor ediyor (yayılım bütçeniz, veri yolunun kendisine değil, bir politika güncellemesinin düğüme nasıl ulaştığına bağlıdır). Hareketli bir taban çizgisine uyum sağlayan istatistiksel dedektörler (EWMA, CUSUM), sapmayı sessizce kabul edecek ve bunları bükülmeyen katı yapısal sınırlarla katmanlandıracaktır.

**Tür:** Öğren
**Diller:** Python (stdlib, üç dedektörlü simülatör: acil anahtar, devre kesici, kanarya)
**Önkoşullar:** Aşama 15 · 13 (Maliyet yöneticileri), Aşama 15 · 10 (İzin modları)
**Süre:** ~60 dakika

## Sorun

Maliyet yöneticileri (Ders 13) agent'nin harcayabileceği tutarı sınırlar. agent'nin bütçe dahilinde yapabileceklerini sınırlamazlar. 50 $ hız sınırına sahip bir agent yine de bir sırrı sızdırabilir, yanlış gönderiyi yayınlayabilir veya bir kaynağı silebilir; pahalı eylem genellikle token'lerdeki ucuz eylemdir.

Bu ders, maliyet katmanının yanında yer alan üç dedektörü kapsar:

1. **Kill anahtarı**: agent'nin erişim alanı dışında tutulan boolean kapatma düğmesi.
2. **Devre kesici**: belirli bir yolu duraklatan eylem modeli dedektörü.
3. **Kanarya token**: dokunmak için geçerli bir nedeni olmayan bir agent'nin dokunarak kendini açığa çıkaracağına dair yem.

Üçü de LLM öncesi mühendisliktir. Klasik aldatma, hız sınırı ihlalleri ve özellik işaretli öldürmeler, otonom agent'lerden öncesine dayanır. Yeni olan şey ise saldırı yüzeyidir: agent'ler güvenilmeyen içeriği okur (Ders 11), kendi hafızalarını düzenler ve güvenli görünen birçok eylemi güvenli olmayan bir eyleme dönüştürebilir. Burada adı geçen dedektörler agent'nin kendi raporuna güvenmedikleri için çalışıyorlar.

## Konsept

### Anahtarları sonlandır

Kill switch, agent'nin okuduğu ancak yazamadığı bir boole değeridir. Uygulama seçenekleri:

- **Yönetilen bir hizmette özellik işareti.** LaunchDarkly, Statsig, Unleash. Güncellemeler saniyeler içinde yayılır.
- **agent anketlerini yeniden düzenleyin.** Basit; agent işleminin her fırsatta kontrol etmesini gerektirir.
- **Nesne depolamada imzalı yapılandırma.** Agent, önyükleme sırasında bir imzayı doğrular; imzasız durumları reddeder.
- **İşletim sistemi düzeyinde sinyal veya konteyner yaşam döngüsü sonlandırması.** Docker `kill`, Kubernetes `kubectl delete pod`, sistem durdurma.

Doğru bir kill anahtarının sahip olduğu özellikler:

- agent bunu `off` olarak ayarlayamaz. (agent'nin kimlik bilgilerinin yazılmadığı bir sistemde yaşıyor.)
- Yalnızca başlangıçta değil, her sonuçsal eylemde kontrol edilir.
- Kapalıyken agent, agent'nin erişebileceği sistemlerde oturum açmak da dahil olmak üzere harici olarak gözlemlenebilir hiçbir şey yapmaz.
- Yeniden etkinleştirme, otomatik bir zaman aşımı değil, açık bir insan eylemidir.

### Devre kesiciler

Bir devre kesici agent'nin tamamını değil, belirli bir modeli duraklatır. Klasik şekil (2007 Nygard kitabından, hala güncel):

- **Kapalı**: eyleme izin verilir.
- **Açık**: eylem engellenir.
- **Yarı açık**: soğuma sonrasında 1-3 prob denemesine izin verilir (varsayılan 1); başarı kesiciyi kapatır, kalan başarısızlık onu yeniden açar.

Agent ile ilgili tetikleyiciler:

- Arka arkaya beş özdeş araç çağrısı (tekrarlayan döngü).
- Aynı alet üzerinde farklı girdilerle art arda beş arıza (sistemik arıza).
- Bir eşiğin üzerindeki takım çağrılarının oranı (Ders 13 hız).
- Güvenilmeyen bir içerik okunduktan sonra özel aracın çağrılması (e.g., `file.delete`) (Ders 11).

### Kanarya tokens

Canary token'ler (baltoken'ler olarak da bilinir), agent'nin asla dokunmaması gereken girdilerdir. Erişim alarmdır.

agent örnekleri:

- Ortamda gerçek bir ayrıcalığa sahip olmayan sahte bir `AWS_SECRET_ACCESS_KEY`. Dışarı sızma girişimleri anında ilişkilendirilebilir.
- Bilinen bir sentinel değeriyle işaretlenmiş sahte bir veritabanı kaydı. Bu kaydın okunması veya güncellenmesi bir uyarıyı tetikler.
- Çalışma alanında sahte bir dosya. Bu dosyanın okunması veya düzenlenmesi şüphelidir.
- Oturum başlangıcında enjekte edilen sahte bir hafıza girişi. Daha sonraki bir çıktıda görünüyorsa, bellek dışarı sızdırılmıştır.

Canary tasarımı iş akışına özeldir. agent'nin dokunmak için meşru bir nedeni olan bir kanarya gürültüdür.

### Neden istatistiksel ve kesin sınırlar katmanlandırılır?

İstatistiksel dedektörler (EWMA, CUSUM, araç çağırma oranlarındaki z puanı) hareketli bir taban çizgisine uyum sağlar. Bu, meşru drift için bir özelliktir ve düşmanca drift için bir hatadır. Sabırlı bir saldırgan, taban çizgisini hiçbir alarmın tetiklenmeyeceği kadar yavaş bir şekilde değiştirebilir.

Katı anayasal sınırlar (Ders 17) esnemez. "`secrets@`'ye asla e-posta göndermeyin" anayasal bir kural olarak daha basittir, denetlenebilirdir ve yavaş kayma ile oynanamaz. Katmanlama modeli: istatistiksel dedektörler gürültünün çoğunu yakalar, katı sınırlar ise dedektörün yanından geçen saldırıları yakalar.

### eBPF veri yolu yönlendirmesi yoluyla karantina

Cilium'un eBPF tabanlı ağ politikası, karantinaya alınan bir kapsülün çekirdek katmanındaki adli balküpüne çıkışını yeniden yazabilir. Cilium'un halka açık benchmark'leri TCP_RR'de milisaniyenin altındaki P99 veri yolu gecikmesini rapor ediyor; Kümenizde bir karantinayı *tetiklemek* için gereken duvar saati bütçesi, bir politika güncellemesinin kontrol düzleminizden düğüme nasıl yayıldığı tarafından belirlenir (operatörün önceden yüklendiği Kubernetes'te birkaç yüz milisaniye gerçekçidir; kuyruk gecikmesi küme boyutuna ve uyum ritmine bağlıdır). Bu size iki şey sağlar: agent gerçek hiçbir şeyi dışarı sızdırmaz ve agent'nin bal küpü içindeki davranışı tamamen gözlemlenir. Kanarya token ile aynı model, farklı katman: agent, kontrol altındayken yapmaya çalıştığı şeyle amacını ortaya koyuyor.

### Hiçbir dedektörün yakalayamadığı şey

- **İzin verilen ilkellerden oluşan anlamsal saldırılar.** Her bireysel eylem, her dedektörden geçer; kompozisyon sorundur. Bu, Ders 10'daki Otomatik Mod bileşik hatasıdır.
- **Yük yükünün bir parçası olarak dedektörü içeren saldırılar.** Bir agent, "harekete geçmeden önce kanaryayı devre dışı bırakın" yazan bir sayfayı okursa ve agent bu yeteneğe sahipse, dedektörün güvenliği ihlal edilir. Canary token'ler, agent'nin değiştiremeyeceği sistemlerde olmalıdır.

## Kullan onu

`code/main.py`, üç dedektör aracılığıyla kısa bir agent yörüngesini simüle eder. Harici bir dict'de tutulan bir öldürme anahtarı; beş aynı alet çağrısında devreye giren bir devre kesici; okunması bir uyarıyı tetikleyen bir kanarya dosyası. Sentetik bir yörüngedeki beslemeler: yasal eylemler, tekrarlayan döngü, kanarya araştırması ve agent'nin eylemlerinin durdurulduğu bir öldürme anahtarıyla tetiklenen senaryo.

## Gönderin

`outputs/skill-tripwire-design.md`, agent deployment için önerilen dedektör yığınını inceler ve boşlukları işaretler (eksik öldürme anahtarı, eksik kanarya, devre kesici eşiği çok gevşek).

## Egzersizler

1. `code/main.py`'yi çalıştırın. Devre kesicinin 5. virajda (beşinci aynı çağrı) ve kanaryanın 9. virajda (sahte anahtar okuma) ateşlendiğini doğrulayın.

2. İstatistiksel bir dedektör ekleyin: Araç çağırma oranına ilişkin EWMA z puanı. Yavaşça kayan ve dedektörün asla ateşlenmediğini gösteren bir yörüngede ilerleyin. Şimdi bir kesin sınır ekleyin (10 dakika içinde en fazla 50 araç çağrısı) ve aynı yörüngedeki kesin sınır atışlarını gösterin.

3. agent tarayıcısı için bir token kanarya seti tasarlayın (Ders 11). En az üç kanaryayı ve her birinin neyi tespit edeceğini listeleyin.

4. Cilium ağ politikası belgelerini okuyun. Çıkış yönlendirmeli karantina akışını somut bir şekilde tanımlayın: hangi politika seçici, hangi bölme, hangi çıkış yeniden yazma, hangi uyarı. "Karantinaya almaya karar verme" aşamasından "ilk yeniden yönlendirilen pakete" kadar duvar saati gecikmesini ne yönetir?

5. Acil anahtarlamalı agent için yeniden etkinleştirme prosedürünü tanımlayın. Kimler yeniden etkinleştirebilir? Neler belgelenmelidir? Yeniden etkinleştirmeden önce agent'de nelerin değişmesi gerekir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|---|---|---|
| Kapatma anahtarı | "Kapatma düğmesi" | agent'nin düzenleme yüzeyinin dışında Boolean; her sonuçsal eylemde kontrol edildi |
| Devre kesici | "Desen duraklatma" | Tekrarlama, başarısızlık oranı veya hız sınırı nedeniyle eyleme özel hata |
| Kanarya token | "Baltoken" | Yemin agent'ye dokunmak için meşru bir nedeni yoktur; erişim bir uyarı tetikliyor |
| Balküpü | "Adli sanal alan" | Karantinaya alınan bir agent'nin gözlemlendiği yeniden yönlendirilen trafik/çalışma alanı |
| EWMA | "Hareketli ortalama" | Üstel ağırlıklı; sürüklenmeye uyum sağlar (özellik + hata) |
| ÖZEL | "Kümülatif toplam" | Temel çizgiden sürekli değişimi algılar |
| Kesin sınır | "Anayasa kuralı" | Uyum sağlamaz; geçmişten bağımsız olarak sabit |
| Anayasal sınır | "Her zaman doğru kuralı" | Ders 17'nin tüzüğüne bağlı; agent tarafından düzenlenemez |

## Daha Fazla Okuma

- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — kill-switch and circuit-breaker framing for autonomous agents.
- [Microsoft Agent Framework — HITL ve gözetim](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — üretim yönetişim modelleri.
- [OWASP LLM / Agentic Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/) — tespit ve yanıt gereksinimleri.
- [Cilium — Ağ politikası ve eBPF](https://docs.cilium.io/en/stable/security/network/) — bölme düzeyinde çıkış yönlendirmesi ve adli bal küpü modelleri.
- [Antropik — Claude's Anayasası (Ocak 2026)](https://www.anthropic.com/news/claudes-constitution) — "anayasal sınırlar" olarak sabit kodlu yasaklar.
