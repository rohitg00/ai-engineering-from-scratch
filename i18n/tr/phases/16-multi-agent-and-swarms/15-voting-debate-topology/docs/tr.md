# Oylama, Kendi Katkı ve Tartışma Topolojisi

> En ucuz birleştirme: örnek N bağımsız ajanlar, çoğunluk oyları. Wang et al. 2022 kendi kendine tutarlılık bunu bir model örnek N kez yaptı. Multi-agent onu genişletiyor **heterogeneous**Monoculture'den kaçmak için farklı modeller, farklı uyarılar, farklı sıcaklıklar, farklı bağlamlar. Çoğunluk oyundan öte, topoloji meseleleri tartışılır: MultiAgentBench (arXiv:2503.01935, ACL 2025) yıldız / zincir / ağaç / grafik koordinasyonu değerlendirdi ve buldu **graph best for research**AgentVerse (ICLR 2024) iki yenilikçi örneği belgelendirir  gönüllü davranışlar ve uyum davranışları  ve uyum hem bir özellik (tümleşme bulmak) hem de bir risk (grup düşüncesi, Ders 24). Bu ders topoloji alanını haritalar, her variansı inşa eder ve koordinasyon vergisini ölçer.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 14 (Consensus and BFT)
**Time:** ~75 minutes

## Sorun

Tartışma doğruluğunu artırabilir (Du et al., arXiv:2305.14325).

1. Kim kime konuşuyor (topoloji).
2. Kaç tur (Du 2023: hem turlar hem de ajanlar bağımsız olarak önemlidir).
3. Ajanların heterogen olup olmadığını (farklı temel modeller mono kültürü kırar).
4. Bir düşman sesinin var olup olmadığını (Çeliç-maning vs. Çöp-maning).

Bir göreve "beş ajanı çalıştırıp oy veren" takımlar genellikle tek bir ajanla karşılaştırılır. Başarısızlıklar rastgele değildir. Topoloji ve heterogenliği izlerler. Bu ders topoloji haritasıdır.

## Anlam

### Kendi kendine uyumlulık, tek model temel çizgi

Wang et al. 2022 ("Öz tutarlılığı Düşünce Dönüşüm zincirini geliştirir") aynı model N defaları sıcaklık > 0 ve akıl yolu cevaplarında çoğunlukla oy kullanan örnekler aldı. GSM8K'da sonuç: tek açgözlülükle çözülen bir örnekle N=40'lık önemli kazançlar.Öz tutarlılık, birden fazla ajan oy kullanmasının öncüdür.

Sınır: kendi kendine tutarlılık bir temel model kullanır. Hatalar yapı ile ilişkilendirilir. Eğer model sistematik bir önyargıya sahipse, tüm N örnekleri bunu paylaşıyor.

### Çoklu temsilci oylaması, heterogen genişleme

N örneklerini N * farklı* ajanlarla değiştirin. Farklı temel modeller (Claude, GPT, Llama), farklı istekler, farklı araç erişimleri. Fayda: ilişkisiz hatalar. Maliyet: farklı ajanlar farklı miktarlarda maliyetler öder; koordinasyonları genel maliyetler ekler.

Heterogene tartışma için 2026 tarihli isim **A-HMAD** Düşmanlı Heterogene Multi-Agent Tartışma. Evrensel olarak kabul edilmedi, ancak makaleler "mono kültür çöküşünden kaynaklanan ilişkili hataları azaltan farklı modeller tartışmaları" için terimi kullanıyor.

### Dört topoloji

```
star                chain               tree                graph

    ┌─A─┐           A─B─C─D         ┌──A──┐              A───B
    │   │                           │     │              │ × │
    B   C                           B     C              D───C
    │   │                          / \   / \
    D   E                         D   E F   G           (fully connected)
```

Yıldız: bir merkezi, diğerleri sadece merkeze konuşuyor.
Zincir: doğrusal, her ajan önceki birinin çıkışını görür.
Ağaç: hiyerarşik, hiyerarşik ajan sistemleri tarafından kullanılır (Deneyim 06).
Grafik: herhangi biri-herhangi biri. Tamamen bağlantılı kliş ve keyfi DAG'lar içerir.

### Koordinasyon vergisi (MultiAgentBench)

MultiAgentBench (MARBLE, ACL 2025, arXiv:2503.01935) araştırma, kodlama ve planlama dahil bir görev kümesinde yıldız, zincir, ağaç, grafikle benchmarked. Anahtar ölçüm sonuçları:

- **Graph**Topoloji araştırma görevlerinde kazanır. Bilgi her yere akıyor; ajanlar birbirlerini eleştirebilir.
- **Star**HAB filtreliyor ve konsolidasyon yapılıyor.
- **Chain**adım adım boru hattlarında kazançlar (adrenal rafine).
- **Coordination tax**Grafik topolojisinde 4 ajanın ötesinde görünmektedir.

4 ajan tavanı temel değil, empiriyeldir. 2026 LLM bağlam kapasitesini yansıtır: her ajanın bağlamı eşdeğerlerin çıkışlarıyla dolur ve herkes herkesi görebildikten sonra eklemci N + 1'nin sınır değerinin düşmesi.

### Çoklu ajan tartışması stratejileri ("Çılgınlık yapmalı mıyız?")

ArXiv:2311.17371 MAD stratejilerinin 2023 son araştırmasıdır. Diğerleri tarafından tekrarlanan ana bulgu: * yapısal olarak benzer* olan MAD varianları (bağımsız örnekleme + toplama) genellikle aynı bütçeyi kullanırken kendi tutarlılığını daha düşük performans gösterir. MAD, ajanlar gerçekten heterogen olduğunda ve tartışmaların karşıtlık yapısı olduğunda (bir ajan karşı çıkıyor).

### AgentVerse ortaya çıkan kalıplar

AgentVerse (ICLR 2024, https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf) açık bir tasarım olmadan bile çoklu ajan tartışmasından ortaya çıkan iki davranışın belgelenmesini sağlar:

- **Volunteer.**Bir ajan, yardım teklif eder ("Bir sonraki adımı atabilirim") isteksiz.
- **Conformity.**Bir ajan, eleştirmen yanlış olduğunda bile, bir eleştirmenle uyumlu bir tutum geliştirir.

Uygunluk, anlaşmaya kadar tartışmaların zorbaları ödüllendirdiği neden.

### Heterogenite: doğruluk hareket eden gerçek düğme

Uygulama literatüründeki 2024-2026 model: N ajanlarından birini farklı bir temel model için değiştirmek, N'yi 1 ile artırmaktan daha büyük bir doğruluk artışı verir.

Üç farklı model, temiz bir temel gerçeği olan çoğu görevde bir modelin beş kopyasını yener.

### Jüri yöntemleri

Sibyl çerçevesinde (Minsky-LLM literatüründe alıntılanan) bir " jüri " resmileştirir. Bu, her aşamada oy kullanarak cevapları düzelten küçük bir dizi uzman ajanın oluşturduğu bir gruptur.

### Oylama ve tartışma baskısı olduğunda

- Bu sorunun temel gerçeği vardır (gerçek, matematik, kod davranış).
- Ajanlar farklı kaynaklara veya araçlara erişebilir (heterogenlik mevcuttur).
- Rondlar sınırlıdır (2-3 tipik) ve ayrı bir yargıç veya doğrulayıcı vardır.
- Bütçe 3-5 ajanı sağlar. 5-7'in dışında grafik topolojisi, koordinasyon vergisi hakimdir.

### Eğer tartışmalar ile oy kullanmak acı verirse

- Sorular, fikir şeklinde, ajanlar en güvenilir, en doğru olmayan yanıtlara birleşiyor.
- Bütün ajanlar bir temel model paylaşır.
- Rondlar sınırsızdır.
- Görev basit. N=5'te kendi kendine tutarlı bir ajan daha ucuz ve aynı derecede doğru.

```figure
sw-debate-topology
```

## Yapın

`code/main.py`Uygulamaları:

- `run_star(agents, hub, question)` Her çalışanın merkezi anketleri, toplamlar.
- `run_chain(agents, question)` sıradan gelişme.
- `run_tree(root, children, question)` derinlik-2 toplama ile hiyerarşik.
- `run_graph(agents, question, rounds)`- Tümüne açık tartışma, sınırlı döngüler.
- Bir senaryolu heterogenlik diyalog: her ajanın bir `error_bias`sistematik yanlışlığını göstermektedir.
- Her topolojinin N=3, 5, 7'de çalıştırılan ve raporlar (düzgünlik, total_tokens, wallclock_simulated) yapan bir ölçüm harnesini.

Çık:

```
python3 code/main.py
npx tsx code/main.ts
```

Beklenen çıkış: topoloji bir tablo × N → (doğrulık, tokenler, gecikme). Araştırma tarzı görevlerde grafik N=3-5'te kazanır; hızlı gerçeklik görevlerinde yıldız kazanır; N=7'deki grafik koordinasyon vergisini gösterir (gecikme doğruluğundan daha hızlı şişer).

## Kullan

`outputs/skill-topology-picker.md`Bir görev açıklamasını okuyan ve topoloji (yıldız / zincir / ağaç / grafik), bir N (ajan sayısı), bir heterogenite profili (kullanılacak temel modeller) ve yuvarlak bir çizgi öneren bir beceri.

## Gönder

Herhangi bir grup için:

- Başlayın .**self-consistency at N=5**Bu ucuz bir temel model.
-  yükselt**heterogeneous voting at N=3**Eğer doğruluk önemlise, delta'yı ölç.
- Sadece **debate topology**Eğer görev yapılandırılmışsa ( Araştırma, çok adımlı) ve sınırlı döngüler mümkünse.
- Küçük bir azınlık sürekli haklı olduğunda, bir çeşitlilik sinyali var.
- "10 kat daha iyi bir fiyatla daha iyi bir doğruluk" bir iş kararıdır.

## Egzersizler

1. Çık .`code/main.py`Graf topolojisi için koordinasyon-davranış eğriyi çiz: doğruluk vs N, simgeler vs N.
2. A-HMAD uygulaması: kasıtlı olarak farklı önyargılar olan üç ajan.
3. Grafik topolojisine oy kullanmayan, sadece son konsensüs oranını belirleyen bir "hakim" rolü ekleyin.
4. AgentVerse makalesini okuyun (ICLR 2024). Uygulamalarınızın en güçlü şekilde hangi yeni davranışları gösterdiğini belirleyin.
5. MultiAgentBench (arXiv:2503.01935) Bölüm 4 (topoloji deneyleri).

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Self-consistency | "Sample N times, vote" | Wang 2022. Single model, N temperature>0 samples, majority vote on reasoning paths. |
| Heterogeneity | "Different models" | Ensemble of different base models or prompt families. Breaks monoculture. |
| MAD | "Multi-agent debate" | Generic term for agents exchanging critiques over rounds. See Du 2023. |
| A-HMAD | "Adversarial Heterogeneous MAD" | MAD variant emphasizing different models + adversarial structure. |
| Topology | "Who talks to whom" | Star, chain, tree, graph. Determines information flow. |
| Coordination tax | "Diminishing returns" | Above ~4 agents on graph, cost grows faster than quality. |
| Volunteer behavior | "Unprompted help" | AgentVerse emergent pattern: an agent offers to take a step. |
| Conformity behavior | "Agreement under pressure" | AgentVerse emergent pattern: an agent aligns with a critic. |
| Jury | "Small specialized panel" | Sibyl-style ensemble with roles (examiner, context, scorer). |

## Daha Fazla Okumak

- [Wang et al. — Self-Consistency Improves Chain of Thought Reasoning](https://arxiv.org/abs/2203.11171) Tek model için başlangıç
- [Du et al. — Improving Factuality and Reasoning via Multiagent Debate](https://arxiv.org/abs/2305.14325) Her iki ajan da ve atış da bağımsız olarak önemlidir.
- [MultiAgentBench / MARBLE](https://arxiv.org/abs/2503.01935) Topoloji referans gösterme grafik araştırma için en iyi, boru hattları için zincir
- [Should we be going MAD?](https://arxiv.org/abs/2311.17371) MAD stratejisi araştırması; MAD'nin genellikle eşit bütçeye sahipken kendi kendine uyumsuzluktan dolayı kaybediyor olduğunu buldu
- [AgentVerse (ICLR 2024)](https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf) Gönüllülik ve uyumlulık belirgin modelleri
- [MARBLE repo](https://github.com/ulab-uiuc/MARBLE) Referans referans değerinin uygulanması
