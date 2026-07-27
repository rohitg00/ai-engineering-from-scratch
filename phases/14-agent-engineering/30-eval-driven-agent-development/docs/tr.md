# Değerlendirme Odaklı Agent Geliştirme

> Anthropic'in rehberliği: "basit prompt'lerle başlayın, bunları kapsamlı değerlendirmeyle optimize edin ve yalnızca gerektiğinde çok adımlı agentic sistemleri ekleyin." Değerlendirme son adım değildir. Aşama 14'teki diğer tüm seçimleri yönlendiren dış döngüdür.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** 14. Aşamanın tamamı.
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Üç değerlendirme katmanını (statik benchmark'ler, özel çevrimdışı, çevrimiçi üretim) ve her birinin ne işe yaradığını adlandırın.
- Değerlendirici-iyileştirici sıkı döngüsünü açıklayın.
- 2026'nın en iyi uygulamasını açıklayın: Değerlendirmeler kodun yanında canlı olarak yayınlanır, CI'da çalıştırılır, PR'lere geçiş yapılır.
- Her Aşama 14 dersini oluşturduğu değerlendirme vakasına bağlayın.

## Sorun

Agent'ler demoları geçer. Demoların tahmin edemeyeceği şekilde üretimde başarısız oluyorlar. Benchmark'nin yanıtı "bu model genel anlamda yetenekli mi?" "Bu agent ürünüm için doğru yamaları mı gönderiyor?" Cevap: Her korkuluk ve öğrenilen kuralın bir değerlendirme vakasına eşlendiği, sürekli çalışan üç katmanlı değerlendirme.

## Konsept

### Üç değerlendirme katmanı

1. **Statik benchmark'ler** — Kod için SWE-bench Onaylı (Ders 19), göz atma/masaüstü için WebArena/OSWorld (Ders 20), genel amaçlı GAIA (Ders 19), araç kullanımı için BFCL V4 (Ders 06). Modeller arası karşılaştırma ve regresyon geçişi için kullanın. Kirlenme gerçek: SWE-bench+ %32,67 oranında çözelti sızıntısı buldu. Her zaman Doğrulanmış / +-denetlenmiş puanları rapor edin.

2. **Özel çevrimdışı değerlendirmeler** — ürününüzün şekli:
   - Yargıç olarak Yüksek Lisans (Langfuse, Phoenix, Opik — Ders 24).
   - Yürütme tabanlı (yamayı çalıştırın, testleri kontrol edin).
   - Yörünge tabanlı (aksiyon dizilerini altınla karşılaştırın; OSWorld-Human, en iyi agent'leri altından 1,4-2,7 kat daha fazla gösteriyor).

3. **Çevrimiçi değerlendirmeler** — üretim:
   - Oturum tekrarları (Langfuse).
   - Korkulukla tetiklenen uyarılar (Ders 16, 21).
   - Adım başına maliyet / gecikme takibi (Ders 23 OTel aralıkları).

### Değerlendirici-iyileştirici (Antropik)

Sıkı döngü:

1. Teklif sahibi çıktı üretir.
2. Değerlendirici hakemler.
3. Değerlendirici geçene kadar hassaslaştırın.

Bu, Kendini Arıtmanın (Ders 05) genelleştirilmiş halidir. Önemsediğiniz herhangi bir agent akışı, güvenilirlik için değerlendirici-optimizasyon aracına sarılabilir.

### 2026'nın en iyi uygulaması

- Evals kodun yanında yaşıyor.
- Her PR'da CI'da çalıştırın.
- Değerlendirme puanlarında kapı birleştirme (e.g. "regresyon yok > %5'e karşı ana").
- Her korkuluk bir değerlendirme vakasına eşlenir.
- Öğrenilen her kural (Yansıma, iş akışı yanlısı öğrenme kuralı) bir başarısızlık durumuyla eşleşir.

### Aşama 14'ü birbirine bağlamak

Aşama 14'teki her ders değerlendirme vakaları oluşturur:

| Ders | Oluşturduğu durumu değerlendirin |
|--------|------------------------|
| 01 Agent Loop | Bütçe tükendi, sonsuz döngü koruması |
| 02 YenidenWOO | Planner, bir araç arızalandığında doğru şekilde yeniden planlama yapıyor |
| 03 Yansıma | Öğrenilen düşünceler yeniden denemede uygulanır |
| 05 Kendini İyileştirme/ELEŞTİRME | Yargıç, rafine edilmiş çıktıyı kabul etti |
| 06 Araç Kullanımı | Tartışma zorlaması işe yarar; bilinmeyen araçlar reddedildi |
| 07-10 Bellek | Alıntıların kaynaklarla eşleşmesi; bayat gerçekler geçersiz kılıyor |
| 12 İş Akışı Modelleri | Her desen doğru çıktıyı üretir |
| 13 LangGrafik | Devam durumu tam olarak yeniden üretir |
| 14 AutoGen Aktörleri | DLQ, çöken işleyicileri yakalıyor |
| 16 OpenAI Agent SDK'sı | Doğru girişlerde korkuluk tetiklemeleri |
| 17 Claude Agent SDK'sı | Subagent sonuçları orkestratöre geri dönüyor |
| 19-20 Benchmark | SWE-bench Onaylı puanı, WebArena başarı oranı, OSWorld verimliliği |
| 21 Bilgisayar Kullanımı | Adım başına emniyet mandalları enjekte edilmiş DOM |
| 23 Otel | Yayılmalar gerekli nitelikleri yayar |
| 26 Arıza Modu | Dedektörler bilinen arızaları etiketler |
| 27 Prompt Enjeksiyon | PVE zehirli geri alımları reddediyor |
| 28 Orkestrasyon | Süpervizör doğru uzmana giden yolları |
| 29 Çalışma Zamanı Şekilleri | DLQ %N hatayla başa çıkıyor |

Değerlendirme paketinizin her biri için vakaları varsa, Aşama 14'ü ele almışsınız demektir.

### Değerlendirmeye dayalı geliştirmenin başarısız olduğu yer

- **Temel çizgi yok.** Bilinen son faydası olmayan değerlendirmeler okunamaz. Temel çizgileri saklayın.
- **Yüksek Lisans-cezalandırma olmadan yargıç.** Yargıçlar da halüsinasyon görüyor. ELEŞTİRİ modeli (Ders 05) – dış araçlara dayanarak karar verin.
- **Değerlendirmelere aşırı uyum.** Değerlendirme için optimizasyon, üretim kullanışlılığından farklıdır. Kasaları döndürün.
- **Kesintili değerlendirmeler.** Deterministik olmayan durumlar yanlış alarmlara neden olur. Tohumları sabitle, anlık görüntü durumu.

## İnşa Et

`code/main.py` bir stdlib değerlendirme donanımıdır:

- Kategorilere sahip vaka kaydı (benchmark, özel, çevrimiçi).
- Komut dosyasıyla yazılmış bir agent test ediliyor.
- Değerlendirici-optimizasyon döngüsü: öneride bulunun, değerlendirin, geçene veya maksimum turlara kadar hassaslaştırın.
- CI kapısı: toplam geçiş oranı + taban çizgisine göre regresyon.

Çalıştır:

```
python3 code/main.py
```

Çıktı: vaka başına başarılı/başarısız, regresyon bayrağı, CI geçit kararı.

## Kullan onu

- Değerlendirme vakalarını agent kodunuzla aynı depoya yazın.
- Bunları CI aracılığıyla her PR'da çalıştırın.
- Regresyon oluşturmada başarısız olun.
- Zaman içindeki geçiş oranını takip edin.
- Her üretim arızasını yeni bir vakaya bağlayın.

## Gönderin

`outputs/skill-eval-suite.md`, bir agent ürünü için CI geçitleri ve regresyon izleme özelliğine sahip üç katmanlı bir değerlendirme paketi oluşturur.

## Egzersizler

1. Üretim hatalarınızdan birini alın. Bunu yeniden üreten bir değerlendirme durumu yazın. agent'niz şimdi bu sınavı geçiyor mu?
2. Alanınız için üç boyutlu (gerçek, üslup, kapsam) bir Yüksek Lisans değerlendirme tablosu oluşturun. 50 seans puanlayın.
3. Değerlendirme paketini CI'ya bağlayın. >=%5 regresyonda derlemede başarısız olun.
4. Bir yörünge verimliliği ölçüsü ekleyin: agent, altın yörüngeye kıyasla kaç adım attı?
5. Her Aşama 14 dersini süitinizdeki bir değerlendirme vakasıyla eşleştirin. Kayıp var mı? Bu kapanması gereken bir boşluk.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Statik benchmark | "Hazır değerlendirme" | SWE-bench, GAIA, AgentBench, WebArena, OSWorld |
| Özel çevrimdışı değerlendirme | "Etki alanı değerlendirmesi" | Yüksek Lisans-yargıç / yönetici / ürün şeklinize göre yörünge |
| Çevrimiçi değerlendirme | "Üretim değerlendirmesi" | Oturum tekrarı, korkuluk uyarıları, maliyet/gecikme takibi |
| Değerlendirici-iyileştirici | "Teklif Et-Yargıl-İnceleştir" | Yargıç geçene kadar tekrarlayın |
| CI kapısı | "Engelleyiciyi birleştir" | Değerlendirme regresyonu derlemesinde başarısız olun |
| Temel | "Son bilinen-iyi" | Regresyonun tespiti için referans puanı |
| Yörünge verimliliği | "Altının ötesine geçen adımlar" | Agent adım sayısı minimum insan uzman sayısına bölünür |

## Daha Fazla Okuma

- [Antropik, Etkili Agent'ler Oluşturma](https://www.anthropic.com/research/building-effective-agents) — "basit başlayın, değerlendirmelerle optimize edin"
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) — seçilmiş benchmark
- [Berkeley İşlev Çağırma Skor Tablosu](https://gorilla.cs.berkeley.edu/leaderboard.html) — araç kullanımı benchmark
- [Langfuse docs](https://langfuse.com/) — pratikte değerlendirmeler + oturum tekrarı
