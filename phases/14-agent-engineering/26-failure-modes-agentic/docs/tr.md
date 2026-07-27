# Arıza Modları: Neden AgentKopma

> MASFT (Berkeley, 2025) 3 kategoride 14 çoklu-agent arıza modunu kataloglamaktadır. Microsoft'un Taksonomisi, mevcut yapay zeka hatalarının agentic ayarlarında nasıl arttığını belgeliyor. Endüstri alanı verileri tekrar eden beş modda birleşiyor: halüsinasyonlu eylemler, kapsam kayması, basamaklı hatalar, bağlam kaybı, aracın yanlış kullanımı.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 05 (Kendini Geliştirme ve Eleştirme), Aşama 14 · 24 (Observability)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- MASFT'ın üç arıza kategorisini ve her birinde en az dört spesifik modu adlandırın.
- agentic hatasının neden mevcut AI hata modlarını (önyargı, halüsinasyon) güçlendirdiğini açıklayın.
- Sektörde tekrarlanan beş modu ve bunların azaltımlarını açıklayın.
- agent izlemeyi hata modu etiketleriyle etiketleyen bir stdlib algılayıcı uygulayın.

## Sorun

Ekipler, izlerin %90'ında çalışan agent'ları gönderir. %10'luk hatalar rastgele gürültü değildir; az sayıda tekrarlanan kategoriye girerler. Bunları adlandırdıktan sonra onları izleyebilir ve düzeltebilirsiniz.

## Konsept

### MASFT (Berkeley, arXiv:2503.13657)

Çoklu-Agent Sistem Arızası Taksonomisi. 14 arıza modu 3 kategoriye ayrılmıştır. Ek açıklama yapanlar arası Cohen'in Kappa 0.88'i — kategoriler güvenilir bir şekilde ayırt edilebilir.

Ana iddia: başarısızlıklar, çoklu agent sistemlerdeki temel tasarım kusurlarıdır, daha iyi temel modellerle düzeltilmesi gereken Yüksek Lisans sınırlamaları değildir.

### Agentic Yapay Zeka Sistemlerinde Hata Modunun Microsoft Taksonomisi

- Mevcut yapay zeka hataları (önyargı, halüsinasyon, veri sızıntısı) agentic ayarlarında artıyor.
- Özerklikten yeni başarısızlıklar ortaya çıkıyor: geniş ölçekte istenmeyen eylemler, araçların yanlış kullanımı, görevin sapması.
- Teknik inceleme, agentic ürünleri için risk kaydıdır.

### Agentic AI'deki Hataları Belirleme (arXiv:2603.06847)

- Başarısızlıklar orkestrasyondan, iç durum gelişiminden ve çevre etkileşiminden kaynaklanır.
- Yalnızca "kötü kod" veya "kötü model çıktısı" değil.

### Yüksek Lisans Agent Halüsinasyonlar Anketi (arXiv:2509.18970)

İki temel tezahür:

1. **Talimat Takip Sapması** — agent, prompt sistemini takip etmiyor.
2. **Uzun Menzilli Bağlamsal Kötüye Kullanım** — agent daha önceki sıralardaki bağlamı unutur veya yanlış uygular.

Alt niyet hataları: İhmal (kaçırılan adım), Artıklık (tekrarlanan adım), Düzensizlik (sıra dışı adımlar).

### Sektörde yinelenen beş mod

Arize, Galileo, NimbleBrain 2024-2026 saha analizleri şu noktalarda birleşiyor:

1. **Halüsinasyonlu eylemler.** Agent var olmayan bir aracı çağırır veya argümanlar üretir.
2. **Kapsam kayması.** Agent görevi kullanıcının isteğinin ötesinde genişletir (ekstra PR'ler oluşturur, fazladan e-posta gönderir).
3. **Basamaklı hatalar.** Bir yanlış çağrı, aşağı yönlü etkileri tetikler. Hayali bir SKU halüsinasyonu, çoklu sistem olayı olan dört API çağrısını tetikler.
4. **Bağlam kaybı.** Uzun ufuklu görevler, erken dönüş kısıtlamalarını unutur.
5. **Aletin yanlış kullanımı.** Yanlış argümanlarla doğru aracı veya tamamen yanlış aracı çağırır.

Basamaklı öldürücüdür. Agent'lar "Başarısız oldum"u "görev imkansız"dan ayırt edemezler ve döngüyü kapatmak için sıklıkla 400 hatayla ilgili bir başarı mesajı halüsinasyonu görürler.

### Azaltma: her adımda kapılar

Bir akıl yürütme zincirinin her adımında otomatik doğrulama kapıları, ortam durumuna göre gerçek temelleri kontrol eder. Somut olarak:

- Adım başına güvenlik sınıflandırıcısı (Ders 21).
- Araç çağrısı argümanının doğrulanması (Ders 06).
- Alınan içeriği bilinen gerçeklerle karşılaştırarak çapraz kontrol edin (Ders 05, KRİTİK).
- Durumu yeniden inceleyerek başarı halüsinasyonunu tespit edin (dosya gerçekten oluşturuldu mu?).

### Arıza izlemenin yanlış gittiği yer

- **Yalnızca etiketleme çöküyor.** Çoğu agent hatası, geçerli görünen çıktı üretir. İçerik düzeyinde kontrollere ihtiyaç var.
- **Temel çizgi yok.** Sürüklenme tespitinin bilinen son faydaya ihtiyacı vardır; onsuz "bu daha da kötüye gidiyor" diyemezsiniz.
- **Aşırı uyarı.** Her başarısızlık bir sayfa oluşturur. Küme ve hız sınırı.

## İnşa Et

`code/main.py` bir stdlib hata modu etiketleyicisini uygular:

- Beş modu kapsayan sentetik bir iz dataset.
- Mod başına dedektör işlevleri (araç çağrıları, çıkışlar, tekrarlanan eylemlerdeki imza modelleri).
- Her izlemeyi etiketleyen ve mod dağılımını bildiren bir etiketleyici.

Çalıştır:

```
python3 code/main.py
```

Çıktı: iz başına etiketler + toplu dağıtım, Phoenix'in iz kümeleme yüzeylerinin ucuz bir kopyası.

## Kullan onu

- Üretim sürüklenme kümelenmesi için **Phoenix** (Ders 24).
- Oturum tekrarı + açıklama için **Langfuse**.
- observability platformunuzun algılayamadığı alana özel imzalar için **Özel**.

## Gönderin

`outputs/skill-failure-detector.md`, alanınıza göre uyarlanmış ve bir izleme deposuna bağlanan hata modu algılayıcıları oluşturur.

## Egzersizler

1. "Başarı halüsinasyonu" için bir dedektör ekleyin: agent başarıyı döndürür ancak hedef durum değişmez.
2. Oluşturduğunuz bir üründen 100 gerçek izi etiketleyin. Hangi mod hakim? Tamir etmenin maliyeti nedir?
3. Bir "kademeli yarıçap" metriği uygulayın: N adımındaki bir başarısızlık göz önüne alındığında, bu durum aşağı yönde kaç adımı etkiledi?
4. MASFT'nin 14 arıza modunu okuyun. Ürününüz için geçerli olan üç tanesini seçin. Dedektörleri yazın.
5. Bir dedektörü bir CI işine bağlayın: izlerin >=%5'i bir modu etiketliyorsa derleme başarısız olur.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| MASFT | "Çoklu-agent başarısızlık sınıflandırması" | Berkeley 14 modlu sınıflandırma |
| Basamaklı hata | "Dalgalanma hatası" | Erken bir hata N adım boyunca yayılır |
| Bağlam kaybı | "Kısıtlamayı unuttum" | Uzun ufuk dönüşü erken dönüş gerçeklerini düşürüyor |
| Aracın yanlış kullanımı | "Yanlış araç / yanlış argümanlar" | Geçerli çağrı, yanlış çağrı |
| Başarı halüsinasyonu | "Sahte tamamlama" | Agent 400'de başarılı olduğunu iddia ediyor; durumu değişmedi |
| Kapsam kayması | "Aşırı Erişim" | Agent istenenden fazlasını yapıyor |
| Talimatlara uygun sapma | "İtaatsizlik" | prompt sistemini veya kullanıcı kısıtlamasını yok sayar |
| Alt niyet hataları | "Hataları planlayın" | Planın uygulanmasında ihmal, fazlalık, düzensizlik |

## Daha Fazla Okuma

- [Cemri ve diğerleri, MASFT (arXiv:2503.13657)](https://arxiv.org/abs/2503.13657) — 14 arıza modu, 3 kategori
- [Microsoft, Agentic Yapay Zeka Sistemlerinde](https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/microsoft/final/en-us/microsoft-brand/documents/Taxonomy-of-Failure-Mode-in-Agentic-AI-Systems-Whitepaper.pdf) Başarısızlık Modunun Sınıflandırılması - risk kaydı
- [Arize Phoenix](https://docs.arize.com/phoenix) — pratikte sürüklenme kümelemesi
- [Antropik, Etkili Agentler Oluşturma](https://www.anthropic.com/research/building-effective-agents) — daha basit kalıplar modlardan tamamen kaçındığında
