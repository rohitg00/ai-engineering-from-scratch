# Eylem Bütçeleri, Yineleme Sınırları ve Maliyet Düzenleyicileri

> Orta ölçekli bir e-ticaret agent'ın aylık LLM maliyeti, ekibi "sipariş izleme" becerisini etkinleştirdikten sonra $1,200 to $4.800'den yükseldi. Bu bir fiyatlandırma hatası değil. Bu, yeni bir döngü bulan ve onun içinde harcama yapmaya devam eden bir agent'tır. Microsoft'un Agent Yönetişim Araç Takımı (2 Nisan 2026) bu sınıfa karşı savunmayı kodlamaktadır: istek başına `max_tokens`, görev başına token ve dolar bütçeleri, günlük/aylık sınırlar, yineleme sınırları, katmanlı model yönlendirme, prompt önbelleğe alma, context windowing, pahalı eylemlere ilişkin HITL kontrol noktaları, bütçe ihlali durumunda kill anahtarları. Anthropic'in Claude Code Agent SDK'sı aynı temel öğeleri farklı adlar altında gönderir. Finansal hız sınırları — e.g. 10 dakika içinde >50 ABD Doları tutarındaki erişimi kesin; döngüleri aylık sınırlardan daha hızlı yakalayın.

**Tür:** Öğren
**Diller:** Python (stdlib, katmanlı maliyet yönetimi simülatörü)
**Önkoşullar:** Aşama 15 · 10 (İzin modları), Aşama 15 · 12 (Kalıcı yürütme)
**Süre:** ~60 dakika

## Sorun

Otonom agent'lar her fırsatta gerçek para harcarlar. Bir sohbet robotunun kötü çıktısı kötü bir yanıttır; bir agent'ın hatalı döngüsü bir faturadır. Başarısızlık modu için sektörde belgelenen terim "Cüzdan Reddi"dir — agent mantık yürütmeye devam eder, araç çağırmaya devam eder, faturalandırmaya devam eder ve hiçbir şey bunu durduramaz çünkü hiçbir şey bunun için tasarlanmamıştır.

Çözüm tek bir sayı değil. Farklı zaman ölçeklerinde ve ayrıntı düzeylerinde bir dizi sınırdan oluşur: istek başına, görev başına, saat başına, gün başına, ay başına. İyi tasarlanmış bir yığın, kontrolden çıkan bir döngüyü dakikalar içinde, yavaş bir sızıntıyı saatler içinde ve kötü bir sürümü bir gün içinde yakalar. agent uzun ufuklu ve özerk olduğunda aynı yığın bütçeyi korur.

Bu bir mühendislik dersidir: matematik önemsizdir, disiplin ise takımların başarısız olduğu yerdir. Aşağıdaki sınırlamaların tamamı Microsoft Agent Yönetişim Araç Takımı'nda veya Antropik Claude Code Agent SDK belgelerinde adlandırılmıştır.

## Konsept

### Maliyet yöneticisi yığını

1. İstek başına **`max_tokens` .** Basit. Herhangi bir çağrının sınırsız bir tamamlama yaymasını engeller.
2. **Görev başına token bütçe.** Tüm çalıştırma boyunca N token saniyeyi aşmayın. Kapakta sert duruş.
3. **Görev başına dolar bütçesi.** token'larla aynı ancak para biriminde. Claude Kodunda `max_budget_usd` .
4. **Araç başına çağrı sınırı.** En fazla N `WebFetch` çağrı, N `shell_exec` çağrı vb.
5. **Yineleme sınırı (`max_turns`).** Toplam agent loop yineleme; sonsuz akıl yürütme döngülerini önler.
6. **Dakika başına / saat başına / gün başına / ay başına sınır.** Dönen pencereler. Farklı zaman ölçeklerindeki sızıntıları yakalar.
7. **Finansal hız sınırı.** E.g., "harcama 10 dakika içinde 50 doları aşarsa erişimi kesin." Aylık kapak ateşinden önce döngü tabanlı yanıkları yakalar.
8. **Katmanlı model yönlendirme.** Varsayılan olarak daha küçük bir modele geçin; ancak bir sınıflandırıcı görevin bunu gerektirdiğine karar verdiğinde daha büyük bir göreve yükseltilebilir.
9. **Prompt önbelleğe alma.** Sistem prompt ve sağlayıcı önbelleğinde depolanan kararlı içerik; token yeniden göndermenin maliyeti sıfıra yakın.
10. **Context windowing.** Aktif bağlamı bir eşiğin altında tutmak için sıkıştırma / özetleme; doğrudan token-maliyet azaltımı.
11. **Pahalı eylemlere ilişkin HITL kontrol noktaları.** Pahalı olduğu bilinen bir eylemden (uzun araç çağrısı, büyük indirme, maliyetli model yükseltme) önce insan dokunuşu gerekir.
12. **Bütçe ihlali durumunda anahtarı sonlandırın.** Herhangi bir sınır etkinleştiğinde oturum iptal edilir. Kapak kaydedilir; ayrı bir yeniden etkinleştirme yolu gerektirir.

### Neden tek bir sınır değil, yığın

Tek bir aylık sınır, kaçak bir agent'ı ancak cüzdan gittikten sonra yakalar. İstek başına tek bir sınır, oturum düzeyinde hiçbir şeyi yakalamaz. Farklı arıza modları farklı zaman ölçekleri gerektirir:

- **Kaçak döngü** (agent 5 saniyelik yeniden denemede takılıp kaldı): hız sınırına yakalandı.
- **Yavaş sızıntı** (agent, görev başına beklenen işin ~2 katını yapıyor): günlük sınıra yakalandı.
- **Kötü sürüm** (yeni sürüm 5x tokens kullanır): haftalık/aylık sınıra yakalandı.
- **Yasal artış** (gerçek talep, hata değil): net kayıtla saat/gün sınırına göre yakalandı.

### Bir koşum bütçesi yüzeyi

Claude Kodu Agent SDK'sı şunları gösterir (genel belgeler):

- `max_turns` — yineleme sınırı.
- `max_budget_usd` — dolar sınırı; ihlal durumunda oturum iptal edilir.
- `allowed_tools` / `disallowed_tools` — araç izin verilenler listesi ve reddedilenler listesi.
- Özel maliyet muhasebesi için aleti kullanmadan önce noktaları kancalayın.

İzin modu merdiveniyle birleştirin (Ders 10). `max_budget_usd` 'nin olmadığı bir `autoMode` oturumu, yönetilmeyen özerkliktir. Anthropic, Otomatik Modun bütçe kontrolleri gerektirdiğini açıkça ifade ediyor; sınıflandırıcı maliyete diktir.

### AB Yapay Zeka Yasası, OWASP Agentilk İlk 10

Microsoft'un Agent Yönetişim Araç Takımı, OWASP Agentic İlk 10 ve AB Yapay Zeka Yasası Madde 14 (insan gözetimi) gerekliliklerini kapsar. AB'deki üretim için kayıt tutma ve üst sınırın uygulanması isteğe bağlı değildir.

### Gözlemlenen $1,200 → $4.800 vaka

Microsoft belgelerindeki gerçek durum: yeni bir araç eklendikten sonra aylık maliyeti üç katına çıkan bir e-ticaret agent. Araç, agent'ın her oturum sırasında sipariş durumunu yoklamasına izin verdi. Döngü tespiti yok. Alet başına kapak yok. Haftadan haftaya büyüme konusunda uyarı yok. Çözüm, takım başına üst sınır artı günlük büyüme uyarısıydı. Bu bir şablondur: her yeni takım yüzeyi yeni bir potansiyel döngüdür; her yeni aracın kendi başlığına ve kendi uyarısına ihtiyacı vardır.

## Use It — Hazır Araçla Uygula

`code/main.py` , katmanlı maliyet yöneticisi yığını olan ve olmayan bir agent çalışmasını simüle eder. Simüle edilen agent, birkaç dönüşten sonra bir oylama döngüsüne sürüklenir; katmanlı yığın onu hız penceresi içinde yakalarken, tek bir aylık sınır günler sonrasına kadar tetiklenmez.

## Ship It — Kullanıma Sun

`outputs/skill-agent-budget-audit.md` , önerilen bir agent deployment'nin maliyet yöneticisi yığınını denetler ve eksik katmanları işaretler.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Yoklama döngüsü yörüngesindeki yineleme sınırından önce hız sınırının tetiklendiğini doğrulayın. Şimdi hız sınırını devre dışı bırakın ve yineleme sınırı onu yakalamadan önce agent'ın ne kadar "harcadığını" ölçün.

2. Tarayıcı için takım başına bir sınır seti tasarlayın agent (Ders 11). Hangi aletin en sıkı kapağa ihtiyacı var? Hangi araç sınırsız ve risksiz çalışabilir?

3. Microsoft Agent Yönetişim Araç Seti belgelerini okuyun. Her büyük harf tipinin araç seti adlarını listeleyin. Her birini arıza modlarından biriyle eşleştirin (kaçak döngü, yavaş sızıntı, kötü salınım, dalgalanma).

4. Gerçekçi bir görev için bir gecelik gözetimsiz çalıştırmayı fiyatlandırın (e.g., "bir depoda 50 sorunu önceliklendirin"). `max_budget_usd` 'yi puan tahmininizin 2 katı olarak ayarlayın. 2x'i gerekçelendirin.

5. Claude Kodunun `max_budget_usd` 'si oturumun toplam maliyetine göre tetiklenir. Dışarıdan uygulayacağınız tamamlayıcı bir hız sınırı tasarlayın. Kesimi ne tetikler ve yeniden etkinleştirme neye benzer?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|---|---|---|
| Cüzdan Reddi | "Kaçak fatura" | Agent loop üst sınırı olmayan harcama oluşturma |
| max_tokens | "İstek başına sınır" | Tek tamamlama boyutunda tavan |
| max_turns | "Yineleme sınırı" | Bir oturumda agent loop yinelemede tavan |
| max_budget_usd | "Dolar öldürme anahtarı" | Oturum maliyeti sınırı; ihlal durumunda iptal |
| Hız sınırı | "Ücret tavanı" | Kısa pencere başına harcama sınırı (e.g., 50 ABD Doları / 10 dakika) |
| Katmanlı yönlendirme | "Önce küçük model" | Ucuz model varsayılanı; yalnızca sınıflandırıcı izin verdiğinde üst kademeye ilet |
| Prompt önbelleğe alma | "Önbelleğe alınmış sistem prompt" | Sağlayıcı tarafı önbelleği, token yeniden gönderme maliyetini neredeyse sıfıra indirir |
| HITL kontrol noktası | "İnsan onay kapısı" | Pahalı eylemden önce insan dokunuşu gerekir |

## Daha Fazla Okuma

- [Antropik Claude Code Agent SDK — agent loop ve bütçeler](https://code.claude.com/docs/en/agent-sdk/agent-loop) — `max_turns`, `max_budget_usd`, araç izin verilenler listeleri.
- [Microsoft Agent Framework — döngüdeki insan ve yönetişim](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — maliyet yöneticisi kontrol noktaları.
- [Antropik — Claude Managed Agent'ye genel bakış](https://platform.claude.com/docs/en/managed-agents/overview) — sağlayıcı tarafı maliyet kontrolleri.
- [Antropik — Prompt önbelleğe alma (Claude API docs)](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — önbelleğe alma mekaniği.
- [Antropik — Uygulamada agent özerkliğinin ölçülmesi](https://www.anthropic.com/research/measuring-agent-autonomy) — uzun ufuklu agent'lar için maliyet profili.
