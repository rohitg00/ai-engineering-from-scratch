# Rol Uzmanlığı — Planlayıcı, Eleştirmen, Yürütücü, Doğrulayıcı

> 2026'da en yaygın çoklu-agent ayrıştırması: bir agent planlar, biri yürütür, biri eleştirir veya doğrular. MetaGPT (arXiv:2308.00352) bunu, `Code = SOP(Team)`'yi takip eden prompt rollerine (Ürün Yöneticisi, Mimar, Proje Yöneticisi, Mühendis, Kalite Güvence Mühendisi) kodlanan SOP'lar olarak resmileştirir. ChatDev (arXiv:2307.07924) tasarımcıyı, programcıyı, incelemeciyi ve testçiyi "iletişimsel halüsinasyon" içeren bir "sohbet zinciri" aracılığıyla zincirler (agent'lar açıkça eksik ayrıntıları ister). Doğrulayıcı yük taşıyor: Cemri ve ark. (MAST, arXiv:2503.13657) her çoklu-agent arızanın eksik veya bozuk doğrulamaya kadar izlenebileceğini gösterir. PwC, CrewAI'deki yapılandırılmış doğrulama döngülerinden 7 kat doğruluk artışı (%10 → %70) bildirdi.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 16 · 04 (İlkel Model), Aşama 16 · 05 (Danışman)
**Süre:** ~60 dakika

## Sorun

Genel çoklu-agent sistemleri genel çıktı üretir. Bir grup sohbetindeki üç kodlayıcı, aynı vasat kodun üç farklı versiyonunu yazıyor. Daha fazla agent ekleyebilir, daha fazla tur ekleyebilir ve yine de kalite eşiğini geçemezsiniz.

Düzeltme daha fazla agent değil, *farklı* agent saniyedir. Farklı roller atayın. Planlayıcının sahip olmadığı eleştiri araçlarını verin. Doğrulayıcıya objektif bir test paketi verin. Artık sistemin yalnızca paralel tahminde değil, temelli düzeltmede de dahili bir anlaşmazlığı var.

## Konsept

### Dört standart rol

**Planlayıcı.** Hedefi okur, bir adım listesi veya spesifikasyon üretir. Araçlar: bilgiye erişim, dokümanlar. Çıktı: yapılandırılmış plan.

**Yürütücü.** Her seferinde bir plan adımını okur, artifact'yı üretir. Araçlar: gerçek çalışma araçları (kod derleyicisi, kabuk, API istemcisi). Çıktı: artifact.

**Eleştirmen.** Planlayıcının amacına aykırı olarak uygulayıcının çıktısını okur. Araçlar: artifact, statik analize salt okunur erişim. Çıktı: nedenlerle birlikte kabul/ret.

**Doğrulayıcı.** artifact'yı okur ve deterministik bir kontrol gerçekleştirir. Araçlar: test çalıştırıcısı, tür denetleyicisi, şema doğrulayıcı. Çıktı: kanıtla birlikte başarılı/başarısız.

Eleştirmen özneldir, sabit fikirlidir ve çoğunlukla yüksek lisansa dayalıdır. Doğrulayıcı nesneldir, deterministiktir ve çoğunlukla kod tabanlıdır. Aynı rol değiller.

### MetaGPT'nin SOP modeli

MetaGPT (arXiv:2308.00352), yazılım mühendisliği SOP'lerini rol prompt'lar olarak kodlar:

- **Ürün Yöneticisi** PRD'yi yazar.
- **Mimar** sistem tasarımını üretir.
- **Proje Yöneticisi** görevleri böler.
- **Mühendis** uygular.
- **QA Mühendisi** testleri yürütür.

Her rolün katı bir giriş/çıkış şeması vardır. prompt rolü, rolün *ne olduğunu* ve *neyi üretmesi gerektiğini* belirtir. `Code = SOP(Team)` formülasyonu — deterministik SOP'lar, LLM'lerden oluşan bir ekibi öngörülebilir bir boru hattına dönüştürür.

### ChatDev'in iletişimsel halüsinasyonu

ChatDev önemli bir hamle daha ekliyor: Bir uygulayıcı, planda olmayan belirli bir ayrıntıya ihtiyaç duyduğunda, devam etmeden önce bunu açıkça tasarımcıya sorar. Bu, detayı makul bir şekilde icat etme konusundaki klasik LLM başarısızlığını önler.

Uygulama: prompt rolü şunu içerir: "size verilmeyen belirli bir bilgiye ihtiyaç duyduğunuzda, çıktı üretmeden önce ilgili rolün adına göre sorun."

### Doğrulayıcı neden en önemli şeydir?

Cemri ve ark. (MAST) 1642 çoklu-agent yürütme hatasının izini sürdü. %21,3'ü doğrulama boşluklarından kaynaklanıyordu; sistem kimsenin kontrol etmediği bir yanıt gönderdi. Geriye kalan %79'un izi genellikle "sessizce başarısız olan veya hiç çalıştırılmayan bir kontrol vardı"ya dayanmaktadır. Doğrulama yük taşıyan roldür.

PwC, yapılandırılmış bir doğrulama döngüsü eklemenin doğruluğu %10'dan %70'e çıkardığını bildirdi (CrewAI deployments, 2025). Tek rolden 7 kat kazanç.

### Eleştirmen ve doğrulayıcı

- Eleştirmen, bir artifact dosyasını kalite açısından inceleyen bir LLM'dir. Öznel. Makul düzyazıyla kandırılabilir.
- Doğrulayıcı, artifact üzerinde çalışan deterministik bir programdır. Amaç. Kanıtlarla birlikte başarılı/başarısız verir.

Her ikisini de kullanın. Eleştirmen, doğrulayıcının dile getiremediği beğeni sorunlarını yakalar. Doğrulayıcı, eleştirmenlerin göremediği hataları yakalar çünkü bunlar yalnızca çalışma zamanında ortaya çıkar.

### Anti-desen

Sisteminizdeki her rol bir Yüksek Lisans'tır ve her rolün çıktısı "bana iyi görünüyor." Klasik MAST arıza modu. Başarılı/başarısız olduğuna yüksek lisansla değil kodla karar verilen en az bir doğrulayıcı ekleyin.

### Framework eşlemesi

- **CrewAI** — `Agent(role, goal, backstory)` ders kitabı uzmanlık yüzeyidir.
- **LangGraph** — düğümler özel prompt'lara sahip olabilir; kenarlar boru hattını zorlar.
- **AutoGen** — Grup Sohbetinde tek kelimelik adlara sahip, role özgü DönüştürülebilirAgentler.
- **OpenAI Agent'nin SDK'sı** — role özel Agent'ler arasında geçiş araçları.

## Build It — Kendin Geliştir

`code/main.py` , basit bir Python işlevi oluşturan 4 rollü bir ardışık düzen uygular:

- **Planner** bir spesifikasyon üretir.
- **Yürütücü** bir kod dizesi oluşturur.
- **Eleştirmen** (Yüksek Lisans simülasyonu) bariz sorunları işaretler.
- **Doğrulayıcı**, oluşturulan kodu bir sanal alanda (`exec`) bir test senaryosuna karşı çalıştırır.

Demo iki kez çalışır: bir kez yürütücü doğru kodu ürettiğinde (eleştirmen + doğrulayıcı her ikisi de geçer), bir kez yürütücü spesifikasyon dışı kod ürettiğinde (eleştirmen makul göründüğü için hatayı gözden kaçırır, doğrulayıcı ise test başarısız olduğu için onu yakalar).

Koşmak:

```
python3 code/main.py
```

## Use It — Hazır Araçla Uygula

`outputs/skill-role-designer.md` bir görevi alır ve rol listesini (3-5 rol), rol başına giriş/çıkış şemasını ve doğrulayıcı kontrolünü üretir. agent'ları bir framework'ye kablolamadan önce bunu kullanın.

## Ship It — Kullanıma Sun

Kontrol listesi:

- **En az bir deterministik doğrulayıcı.** Asla tamamı Yüksek Lisans değil.
- **Rol başına açık G/Ç şeması.** Planlayıcı düzyazı değil spesifikasyon döndürür; uygulayıcı bu şemayı okur.
- **İletişimsel halüsinasyon.** Yürütücü, bilgi eksik olduğunda planlamacıya sormalıdır; asla icat etmeyin.
- **Eleştirmen/doğrulayıcı sıralaması.** Önce eleştiriyi çalıştırın (ucuz, tasarım sorunlarını yakalar), ikinci olarak doğrulayıcıyı çalıştırın (yavaş, hataları yakalar).
- **Döngü bütçesi.** İnsana iletilmeden önce maksimum 2 eleştirmen-yürütücü revizyon turu.

## Egzersizler

1. `code/main.py` komutunu çalıştırın ve doğrulayıcının, eleştirmenin gözden kaçırdığı hatayı nasıl yakaladığını gözlemleyin. Ek doğrulayıcı olarak bir statik analiz kontrolü ekleyin ( `return` oluşumlarını sayın). Çalışma zamanı testinin kaçırdığı neyi yakalıyor?
2. 5. rolü ekleyin: Kullanıcı isteklerini planlayıcıya hazır spesifikasyonlara dönüştüren "gereksinim analisti". Hangi iletişimsel halüsinasyon giderme talepleri ona doğru akmalıdır?
3. MetaGPT Bölüm 3'ü okuyun ("Agents"). MetaGPT'nin 5 rolünün her birinin giriş/çıkış şemasını listeleyin.
4. ChatDev'in sohbet zinciri diyagramını okuyun (arXiv:2307.07924 Şekil 3). İletişimsel halüsinasyonun, normalde sonsuz olacak bir döngüyü nerede kırdığını belirleyin.
5. PwC'nin 7 kat doğruluk artışı doğrulama döngülerinden geldi. Bir doğrulayıcı eklemenin işe yaramayacağı (doğruluğun deterministik kontrolünün imkansız olduğu veya aşırı derecede pahalı olduğu) üç görevi hipotezleyin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Rol uzmanlığı | "Farklı agent'lar, farklı işler" | Planlayıcı/yürütücü/eleştirmen/doğrulayıcı rolleri için farklı sistem promptayarlanmıştır. |
| SOP modeli | "Kodlanmış standart işletim prosedürü" | MetaGPT'nin çerçevesi: Rol başına katı I/O şemaları, ekibi bir boru hattına dönüştürür. |
| İletişimsel halüsinasyon | "İcat etmeden önce sorun" | ChatDev modeli: uygulayıcı, bir detayı tamamlamak yerine eksik olduğunda planlayıcıya sorar. |
| Eleştirmen | "LLM incelemecisi" | Öznel, sabit fikirli eleştirmen. Tat sorunlarını yakalar. Makul düzyazıyla kandırılabilir. |
| Doğrulayıcı | "Deterministik kontrol" | Kod tabanlı başarılı/başarısız. Test çalıştırıcısı, tür denetleyicisi, şema doğrulayıcı. Kandırılamaz. |
| Doğrulama boşluğu | "Kimse kontrol etmedi" | MAST başarısızlıklarının %21,3'ü. Yanıt, hatayı yakalayabilecek bir kontrol olmadan gönderildi. |
| Revizyon döngüsü | "Eleştirmen onu geri gönderiyor" | Eleştirmenin reddedilmesi, uygulayıcının geri bildirimle yeniden çalışmasını tetikler. Bütçeye ihtiyacı var. |
| All-LLM anti-desen | "Bana iyi görünüyor" | Her rol bir LLM'dir, deterministik bir kontrol yoktur. Klasik MAST hatası. |

## Daha Fazla Okuma

- [Hong ve ark. — MetaGPT: Çoklu-Agent İşbirliği için Meta Programlama](https://arxiv.org/abs/2308.00352) — Rol olarak SOP-prompt referans belgesi
- [Qian ve diğerleri. — Yazılım Geliştirme için İletişimsel Agent'ler (ChatDev)](https://arxiv.org/abs/2307.07924) — sohbet zinciri + iletişimsel halüsinasyon
- [Cemri ve ark. — Çoklu-Agent Yüksek Lisans Sistemleri Neden Başarısız Olur?](https://arxiv.org/abs/2503.13657) — MAST taksonomisi; Doğrulama boşlukları başarısızlıkların %21,3'üdür
- [CrewAI docs — Agent roller](https://docs.crewai.com/en/introduction) — üretim rolü spesifikasyonu yüzeyi
