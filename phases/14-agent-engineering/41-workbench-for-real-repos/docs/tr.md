# Gerçek Bir Repo Üzerindeki Çalışma Tezgahı

> Yüzeylerle ilgili on bir ders, eğer gerçek bir kod tabanıyla temasa geçmezlerse hiçbir işe yaramaz. Bu ders, aynı görevi küçük bir örnek uygulamada iki kez çalıştırır: prompt-yalnızca ve çalışma tezgahı kılavuzlu. Tartışmayı sayılar yapıyor.

**Tür:** Yapım
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 32 - 14 · 40
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Küçük bir uygulamada yedi tezgah yüzeyini bir araya getirin.
- Aynı görevi iki kez çalıştırın (yalnızcaprompt-yalnızca ve çalışma tezgahı kılavuzlu) ve beş sonucu ölçün.
- Öncesi/sonrası raporunu okuyun ve hangi yüzeylerin en fazla etkiyi sağladığına karar verin.
- Çalışma tezgahını "ama benim modelim yeterince iyi" tepkisine karşı savunun.

## Sorun

Bir oyuncak görevine ilişkin bir demo kimseyi ikna etmez. Workbench için durum, gerçek hissi veren bir depodaki gerçek hissi veren bir görevin daha az hatayla, daha az geri dönüşle ve bir sonraki oturumun kullanabileceği bir paketle üretime geçmesiyle ortaya çıkar.

Bu ders, gerçek hissi veren repoyu gönderiyor ve aynı görevi her iki işlem hattı üzerinden de yürütüyor. Sonuç, şüpheciye verebileceğiniz bir öncesi/sonrası raporudur.

## Konsept

```mermaid
flowchart TD
  Task[Task: validate /signup and add tests] --> A[Prompt-only run]
  Task --> B[Workbench-guided run]
  A --> M[Measure: 5 outcomes]
  B --> M
  M --> Report[before-after-report.md]
```

### Örnek uygulama

`sample_app/`'da minimum FastAPI tarzı işleyici:

- `/signup` ile `app.py` (henüz doğrulama yok).
- Bir mutlu yol testiyle `test_app.py`.
- Yasak bölge yemi olarak `README.md` ve `scripts/release.sh`.

### Görev

> `/signup`'ye giriş doğrulaması ekleyin: 8 karakterden kısa şifreleri reddedin, yazılan bir hata zarfıyla 422'yi döndürün. Yeni davranışı kanıtlayan bir test ekleyin.

### İki boru hattı

Yalnızca Prompt-yalnızca:

1. README'yi okuyun.
2. `app.py`'yi okuyun.
3. Dosyaları düzenleyin.
4. Talep yapıldı.

Tezgah yönlendirmeli:

1. init betiğini çalıştırın (Ders 35).
2. Kapsam sözleşmesini okuyun (Ders 36).
3. Durumu okuyun (Ders 34).
4. Yalnızca izin verilen dosyaları düzenleyin.
5. Geri bildirim çalıştırıcısı aracılığıyla kabul komutunu çalıştırın (Ders 37).
6. Doğrulama kapısını çalıştırın (Ders 38).
7. Gözden geçireni çalıştırın (Ders 39).
8. Aktarımı oluşturun (Ders 40).

### Ölçülen beş sonuç

| Sonuç | Neden önemlidir |
|---------|----------------|
| `tests_actually_run` | Çoğu "test başarılı" iddiası doğrulanamaz |
| `acceptance_met` | Hedefi kanıtlayan test, çalıştırılan test olmalıdır |
| `files_outside_scope` | Kapsam kayması baskın sessiz başarısızlıktır |
| `handoff_quality` | Bir sonraki oturum bunun bedelini öder veya bundan faydalanır |
| `reviewer_total` | Kapının üstünde niteliksel yargı |

## İnşa Et

`code/main.py`, iki ardışık düzeni aynı örnek uygulama fikstürüne göre düzenler. Her iki işlem hattı da kodlanmıştır (döngüde LLM yoktur), dolayısıyla ölçüm tekrarlanabilir. Komut dosyası, karşılaştırmayı `before-after-report.md` ve {`comparison.json`'ye yazar.

Çalıştır:

```
python3 code/main.py
```

Çıktı: işlem hattı başına sonuçların konsol tablosu, betiğin yanında kaydedilen işaretleme raporu ve grafiğini oluşturmak isteyenler için JSON.

## Vahşi doğada üretim modelleri

Şüphecinin sorusu şu: "Çalışma tezgahı gerçekte ne kadar yardımcı oluyor?" 2026 rakamları açıklamadan çok daha fazlasını söylüyor.

**Aynı modelde Terminal Bench Top-30'dan Top-5'e.** LangChain'in *Bir Agent Kablo Demeti Anatomisi* (Nisan 2026): kodlamalı bir agent, yalnızca kablo demetini değiştirerek Terminal Bench 2.0'da ilk 30'un dışından beşinci sıraya yükseldi. Aynı model. Farklı yüzeyler. Yirmi beş dereceli delta.

**Araçları silerek Vercel %80'den %100'e.** Vercel, agent araçlarının %80'ini silmenin başarı oranını %80'den %100'e çıkardığını bildirdi. Daha küçük takım yüzeyi, daha keskin kapsam, daha az arızalanma olasılığı. Negatif alan kazanır.

**Harvey yalnızca kablo demeti aracılığıyla 2 kat doğruluk.** Legal agent, model değişikliği olmadan, kablo demeti optimizasyonu yoluyla doğruluğunu iki kattan fazla artırdı.

**Kurumsal AI agent projelerinin %88'i üretime ulaşamıyor.** preprints.org *Harness Engineering for Language Agents* makalesi (Mart 2026), başarısızlıkların izini mantık yürütmeden değil çalışma zamanından alıyor: eski durum, hassas yeniden denemeler, aşırı büyümüş bağlam, ara hatalardan zayıf kurtarma.

**Uzun bağlam çöküşü.** WebAgent temel %40-50 başarısı, çoğunlukla sonsuz döngüler ve hedef kaybı nedeniyle, uzun bağlam koşullarında %10'un altına düşer. Ralph Döngüsü ve aktarım paketi bunu absorbe etmek için var.

**Yanlış negatifler hâlâ mevcuttur.** Tek adımlı gerçek görevler, tek satırlık tüyolar, biçimlendirici çalıştırmaları, modelin birebir ezberlediği her şey — bunlar yalnızca daha hızlı çalışır prompt. benchmark bunları dürüstçe numaralandırmalıdır, böylece çalışma tezgahı aşırı olarak çerçevelenmez.

Paket servisi "koşum takımı sonsuza kadar kazanır" değildir. Modeller zamanla koşum hilelerini absorbe eder. Çıkarılan sonuç, bugün mühendislik yükünün yedi yüzeyde olduğu ve sayıların da bunu kanıtladığıdır.

## Kullan onu

Bu ders şu durumlarda alıntı yaptığınız vaka dosyasıdır:

- Birisi neden her PR'nin bir `agent-rules.md` ve kapsam sözleşmesi taşıdığını soruyor.
- Bir takım "sadece bu sprint için" doğrulama kapısını kaldırmak istiyor.
- Yeni bir agent ürünü piyasaya sürüldü ve gerçekten zaman kazandırıp kazandırmadığını görmek için taşınabilir bir benchmark ürününe ihtiyacınız var.

Rakamlar açıklamanın ötesine geçiyor.

## Gönderin

`outputs/skill-workbench-benchmark.md`, herhangi bir agent ürününü her iki işlem hattı üzerinden bir projenin kendi örnek uygulamasına karşı çalıştıran ve beş sonucu raporlayan taşınabilir bir değerlendirme donanımıdır.

## Egzersizler

1. Altıncı bir sonuç ekleyin: ilk anlamlı düzenlemeye kadar geçen süre. Temiz bir şekilde nasıl ölçülür?
2. Karşılaştırmayı kod tabanınızdaki gerçek bir ikinci gün görevi üzerinde çalıştırın. Tezgah numaraları nereye kayıyor?
3. Bir "yanlış negatif" geçişi ekleyin: yalnızca prompt-daha hızlı olacağı ve çalışma tezgahı yükünün gerçek maliyet olacağı görevler. Yine de tezgahı korumayı savunun.
4. Komut dosyasıyla yazılan "agent" ifadesini gerçek bir LLM çağrısıyla değiştirin. Hangi sonuçlar daha gürültülü oluyor?
5. Mühendis olmayan birine yönelik tek sayfalık bir özet yazın. Kesimden ne kurtulur?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Örnek uygulama | "Oyuncak deposu" | Yedi yüzeyin tamamını çalıştırabilecek kadar küçük ama gerçekçi |
| Boru hattı | "İş Akışı" | Yüzey okuma/yazma işlemlerinin sıralı sırası agent aşağıdaki gibidir |
| Öncesi/sonrası raporu | "Makbuzlar" | Bir şüpheciye verdiğiniz artifact |
| Yanlış negatif | "Çalışma tezgahının aşırı yüklenmesi" | prompt-only'nin daha hızlı olduğu görevler; dürüstçe sıralamak faydalı |
| Tezgah benchmark | "Güvenilirlik puanı" | Karşılaştırmayı kod tabanınızda çalıştıran taşınabilir donanım |

## Daha Fazla Okuma

- [LangChain, The Anatomy of an Agent Harness](https://blog.langchain.com/the-anatomy-of-an-agent-harness/) — Terminal Bench İlk 30'dan İlk 5'e makbuz
- [MongoDB, Agent Donanımı: Yüksek Lisans Neden Agent Sisteminizin En Küçük Parçasıdır](https://www.mongodb.com/company/blog/technical/agent-harness-why-llm-is-smallest-part-of-your-agent-system) — Vercel + Harvey sayıları
- [preprints.org, Harness Engineering for Language Agents](https://www.preprints.org/manuscript/202603.1756) — %88 kurumsal başarısızlık oranı, çalışma zamanı temel nedenleri
- [HN: Bir Öğleden Sonra Kodlama alanında 15 Yüksek Lisans Derecesinin Geliştirilmesi. Yalnızca Kayış Takımı Değiştirildi](https://news.ycombinator.com/item?id=46988596) — 15 modele kopyalandı
- [Cloudflare, AI Kod İncelemesini Geniş Ölçekte Düzenleme](https://blog.cloudflare.com/ai-code-review/) — 131 bin inceleme çalıştırması / üretimde 30 gün
- [Antropik, Etkili Agentler Oluşturma](https://www.anthropic.com/research/building-effective-agents)
- Aşama 14 · 32 - 14 · 40 — bu derste uçtan uca uygulanan yüzeyler
- Aşama 14 · 19 — SWE-bench, GAIA, AgentBench, bu dersin tamamladığı makro benchmark olarak
- Aşama 14 · 30 — aynı kablo demetinin takıldığı değerlendirme odaklı agent geliştirme
