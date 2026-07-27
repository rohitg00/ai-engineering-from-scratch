# Otonom Kodlama Agent Manzarası (2026)

> SWE-bench Verified üç yıldan kısa bir sürede %4'ten %80,9'a çıktı. Aynı Claude Sonnet 4.5, SWE-agent v1'de %43,2 ve Cline otonom'da %59,8 puan aldı; modelin etrafındaki iskele artık modelin kendisi kadar önemli. OpenHands (eski adıyla OpenDevin), MIT lisanslı en aktif platformdur ve CodeAct döngüsü, Python eylemlerini JSON araç çağrıları yerine doğrudan sanal alanda yürütür. Başlık numaraları metodolojik bir sorunu gizliyor: 500 SWE-bench Verified görevinden 161'i yalnızca 1-2 satır değişikliği gerektiriyor ve SWE-bench Pro (10'dan fazla satır görevi) aynı sınır modelleri için %23-59 arasında yer alıyor.

**Tür:** Öğren
**Diller:** Python (stdlib, CodeAct ve JSON araç çağrısı karşılaştırması)
**Önkoşullar:** Aşama 14 · 07 (Alet kullanımı), Aşama 15 · 01 (Uzun ufuk agent'ler)
**Süre:** ~45 dakika

## Sorun

"Hangi agent kodlaması en iyisidir" yanlış sorudur. Doğru soru şu: İşime uygun bir görev dağılımında, üretimde çalıştıracağım iskele ile hangi uçtan uca güvenilirliğe sahip olacağım?

2022 ile 2026 yılları arasında saha, iskelenin (geri getirme katmanı, planlayıcı, korumalı alan, düzenleme-doğrulama döngüsü, geri bildirim formatı) yük taşıyıcı olduğunu öğrendi. SWE-agent v1'de Claude Sonnet 4.5, SWE-bench Verified'da %43,2 puan aldı; Cline'ın otonom iskelesindeki aynı model %59,8 puan aldı. 16,6 mutlak fark noktası, aynı ağırlıklar. Temel model bir bileşendir; döngü üründür.

Tamamlayıcı sorun, benchmark doygunluğunun regresyonları gizlemesidir. SWE-bench Verified doygunluğa yakın ve kolay görev kuyruğu (≤2 satır gerektiren 500 görevden 161'i) en yüksek puanları yukarı çekiyor. Gerçek dünyadaki kalite, aynı liderlerin hala %23-59 arasında yer aldığı SWE-bench Pro (10'dan fazla satır değişikliği) gibi dağıtımlarda daha iyi ölçülür.

## Konsept

### SWE-bank, bir paragraf

SWE-bench (Jimenez ve diğerleri), temel gerçek yamalarla gerçek GitHub sorunlarını ele alıyor ve bir agent'den test paketinin başarılı olmasını sağlayacak bir yama üretmesini istiyor. SWE-bench Verified (OpenAI, 2024), belirsiz ve bozuk görevlerin kaldırıldığı, insanlar tarafından seçilen 500 görevlik bir alt kümedir. SWE-bench Pro daha zorlu bir haleftir; mevcut sınır agent'lerin %23-59 arasında olduğu 10'dan fazla değişiklik satırı gerektiren görevler.

### 2022 → 2026 eğrisi aslında neyi gösteriyor?

- **2022**: ham SWE-bench'te ~%4 araştırma modelleri.
- **2024**: GPT-4 + Devin tarzı iskele ~%14; SWE-agent ~%12'de.
- **2025**: Aider içindeki Claude 3.5/3.7 Sonnet ve SWE-agent %40–55 aralığına giriyor.
- **2026**: Claude Sonnet 4.5 ve SWE-bench Onaylı'da %70–80+ ile öncü rakipler. Epoch AI'nin skor tablosu bunu canlı olarak takip ediyor.

Eğim üç bileşik kaynaktan geldi: daha iyi temel modeller, daha iyi iskele (CodeAct, yansıma, doğrulama döngüleri) ve daha iyi benchmark'ler (Gürültüyü ortadan kaldırdığı doğrulandı).

### CodeAct ve JSON araç çağrıları

OpenHands (All-Hands-AI, arXiv:2407.16741, önceki adıyla OpenDevin) belirli bir mimari iddiaya girdi: bir ana bilgisayarın kodunu çözüp çalıştırdığı JSON aracı çağrılarını yayan model yerine, model Python kodunu yayar ve Jupyter tarzı bir çekirdek onu bir sanal alanda çalıştırır. agent tek bir eylemle dosyalar üzerinde döngü yapabilir, araçları zincirleyebilir ve kendi istisnalarını yakalayabilir.

Takas:

- **JSON aracı çağrıları**: her eylem bir turdur; denetimi kolay; sınırlı kompozisyon; her çağrı açık bir doğrulayıcıdan geçtiği için varsayılan olarak güvenlidir.
- **CodeAct**: bir eylem bütün bir program olabilir; bileşimsel; güçlendirilmiş bir sanal alan gerektirir (OpenHands, Docker izolasyonunu kullanır); hata modları korumalı alan çalışma zamanının izin verdiği her şeyi içerir.

Her iki mimari de üretimde. CodeAct açık platformlarda baskındır (OpenHands, smolagents). JSON araç çağrıları, sağlayıcının yürütücüyü kontrol ettiği yönetilen hizmetlerde (Antropik Yönetilen Agent'ler, OpenAI Asistanları) baskın olmaya devam ediyor.

### 2026 manzarasında iskeleler

| İskele | Lisans | Uygulama modeli | Önemli mülk |
|---|---|---|---|
| OpenHands (OpenDevin) | MİT | Docker'da CodeAct | En aktif açık platform; olay akışı tekrar oynatılabilir |
| SWE-agent | MİT | Agent-Bilgisayar Arayüzü (ACI) | İlk uçtan uca SWE tezgahlı iskele |
| Yardımcı | Apache-2 | yerel depoda fark yoluyla düzenleme | Minimal iskele, güçlü regresyon kararlılığı |
| Klinik | Apache-2 | Araç politikasıyla VS Kodu agent | Sonnet 4.5'te en yüksek puanı alan açık iskele |
| Devin (Biliş) | Tescilli | Yönetilen VM + planlayıcı | İlk "Yapay Zeka Yazılım Mühendisi" ürün kategorisi |
| Claude Kodu | Tescilli | İzin modları + rutinler | Ders 10, agent loop'yi ayrıntılı olarak ele alıyor |

### Neden iskele hakimdir?

Kodlama çalışması uzun ufuklu bir yörüngedir (Ders 1). Güvenilirlik adımlar boyunca birleşir. İskelenin puan kazandırdığı üç yer:

1. **Geri alma**: Okunacak doğru dosyaları bulmak sessiz bir darboğazdır. SWE-agent'nin ACI'sı, OpenHands'ın dosya dizini ve Aider'ın repo haritasının tümü buna saldırıyor.
2. **Doğrulayıcı döngüsü**: testleri çalıştırmak, yığın izlerini okumak ve yeniden denemek, SWE-bench'te 10+ puanlık bir deltadır.
3. **Arızaların kontrol altına alınması**: Hata durumunda geri dönen bir korumalı alan, hasarın artmasını önler. Doğrulama döngüsü olan ve olmayan aynı model iki farklı ürün gibi görünüyor.

### Benchmark doygunluğu ve gerçek dağılım

OpenHands yazarları ve Epoch AI, SWE-bench Verified'ın kolay bir kuyruğu olduğunu belirtiyor: 500 görevden 161'i yalnızca 1-2 satırlık değişikliğe ihtiyaç duyuyor. Yüksek puanlar kısmen bu kuyruktan kaynaklanıyor. SWE-bench Pro, 10'dan fazla hat değişikliğiyle sınırlandırır ve sınır sistemleri için bile %23-59 aralığında puanlar döndürür. Prodüksiyon dağıtımınız neredeyse kesinlikle Verified'dan ziyade Pro'ya daha yakın.

Bir agent seçmenin anlamı: kendi hata birikiminizin Pro benzeri bir alt kümesini çalıştırın. Önemli olan puan, gönderdiğiniz şeyi temsil eden görevlerdeki puandır.

## Kullan onu

`code/main.py`, iki oyuncak agent iskelesini sabit bir mini görev dağıtımında karşılaştırır:

1. Her turda bir eylem gerçekleştiren **JSON araç çağrısı** iskelesi.
2. Eylem başına küçük bir Python parçacığı yayınlayabilen bir **CodeAct** iskelesi.

Her ikisi de bir saplama "modeli" (deterministik kurallar) kullanır, böylece karşılaştırma iskeleyi model kalitesinden izole eder. Çıktı, CodeAct iskelesinin daha büyük eylem başına patlama yarıçapı pahasına daha az dönüşte daha fazla görevi çözdüğünü gösteriyor.

## Gönderin

`outputs/skill-scaffold-audit.md`, önerilen bir kodlama-agent iskelesini benimsemeden önce denetlemenize yardımcı olur: alma kalitesi, doğrulayıcı varlığı, korumalı alan yalıtımı ve benchmark'nin dağıtıma uygunluğu.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Her iskele aynı görev setinde kaç tur yapar? Her birinin eylem başına patlama yarıçapı nedir?

2. OpenHands makalesini okuyun (arXiv:2407.16741). Makale, CodeAct'in karmaşık görevlerde JSON aracı çağrılarını geride bıraktığını savunuyor. Makalenin kabul ettiği bir arıza modunu tanımlayın ve bu modun üretimde ne zaman hakim olacağı hakkında bir cümle yazın.

3. Hata biriktirme listenizden, iki dosyada 10'dan fazla satırlık değişiklik gerektiren bir görev seçin. (a) JSON araç çağrıları ve (b) CodeAct kapsamında bir sınır modeli için uçtan uca başarı olasılığını tahmin edin. Boşluğu haklı çıkarın.

4. SWE-bench Verified'ın 161 tek dosyalı, 1-2 satırlık görevi vardır. Bunları hariç tutan bir puan oluşturun. Skor tablosu nasıl değişiyor?

5. "SWE-bench Verified'a Giriş" (OpenAI) bölümünü okuyun. Belirsiz görevleri kaldırmak için kullanılan özel metodolojiyi açıklayın ve kürasyonun gözden kaçıracağı bir kategoriyi adlandırın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|---|---|---|
| SWE-bank | "benchmark Kodlama" | Temel gerçek yamalar ve test paketleriyle ilgili gerçek GitHub sorunları |
| SWE tezgahı Doğrulandı | "Temizlenmiş alt küme" | İnsanların hazırladığı 500 görev, daha kolay kuyruk sunumu |
| SWE-tezgah Pro | "Daha sert alt küme" | 10'dan fazla satır değişikliği; sınır %23-59 seviyesinde |
| CodeAct | "Eylem olarak kod" | Agent Python'u yayar; Jupyter tarzı çekirdek sanal alanda yürütülüyor |
| JSON araç çağrısı | "İşlev çağrısı" | Her eylem, yürütülmeden önce doğrulanan yapılandırılmış bir JSON yüküdür |
| İskele | "Agent framework" | Alma + planlayıcı + yürütücü + temel model etrafında doğrulayıcı döngü |
| ACI (Agent-Bilgisayar Arayüzü) | "SWE-agent'nin biçimi" | İnsan kabukları için değil, LLM ergonomisi için tasarlanmış komut seti |
| Doğrulayıcı döngüsü | "Test et ve yeniden dene" | Testleri çalıştırın, çıktıyı okuyun, yamayı gözden geçirin; model dışı en büyük güvenilirlik kazancı |

## Daha Fazla Okuma

- [Jimenez ve ark. — SWE-bench](https://www.swebench.com/) — orijinal benchmark ve metodoloji.
- [OpenAI — SWE-bench Verified ile Tanışın](https://openai.com/index/introducing-swe-bench-verified/) — seçilmiş alt kümenin nasıl oluşturulduğu.
- [Wang ve ark. — OpenHands: Yapay Zeka Yazılım Geliştiricileri için Açık Bir Platform](https://arxiv.org/abs/2407.16741) — CodeAct mimarisi ve olay akışı tasarımı.
- [Epoch AI — SWE sıralaması lider tablosu](https://epoch.ai/benchmarks) — canlı izlenen skorlar.
- [Antropik — agent özerkliğinin ölçülmesi](https://www.anthropic.com/research/measuring-agent-autonomy) — uzun ufuklu kodlama-agent güvenilirlik çerçevesi.
