# Yetenek Evals, Paket ve taşınabilirlik

> Bir beceri, paketinin kalınlığından kurtulması, doğru isteklere göre yönlendirilmesi, ölçülen bir görevi geliştirmesi, politika içinde kalması ve başka bir ev sahibi üzerinde dürüstçe çökmesiyle sona erer.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 22, 24, 25, and 26
**Time:** ~150 minutes

## Öğrenme Hedefleri

- Uzman iş akışını yargı, belirleyici hesaplama, referanslar ve çıkış sözleşmelerini ayırarak bir beceri haline getir.
- Test paket yapısı, tetikle yönlendirme, görev davranışı, senaryo doğruluğu, güvenlik ve taşınabilirlik ayrı katman olarak.
- Ölçüm, doğruları, net negatifleri ve neredeyse hataları kullanarak doğruları tetikler ve hatırlar.
- Tekrarlı koşulardaki becerileri, yeteneksiz ve yeteneksiz performansla karşılaştırın.
- Tam bir beceri paketleri için çapraz çalıştırma süresi kapasitesi matrisi ve serbest bırakma kapısı oluşturun ve uygulayın.

## Sorun

Bir yetenek bir demo'da çalışır. Kullanıcı açıklamasında kullanılan cümleyi tam olarak sorar, yazar hangi referansı açmayı bilir, senaryo temiz giriş görür ve beklenen ev sahibi her özel alanı tanır.

Sonra gerçek kullanıma başlar.

- Model onu yakın bir görev için çağrıyor ama farklı bir görev için.
- Geçerli bir talepte bilinmeyen bir kelime kullanılır, bu yüzden model onu kaçırır.
- Ceset ajanı ne yapması gerektiğini söyler ama hangi eser tamamlandığını kanıtlamaz.
- Senaryo boşluklarda, tekrarlanan uygulanmalarda veya kısmi durumlarda başarısız olur.
- Paket yükleyici kopyalar `SKILL.md`Ama referanslarını geride bırakıyor.
- Başka bir çalıştırma zamanı da çağrı işaretlerini ve araç izinlerini görmezden gelir.
- Bir koşuk başarılı olur, üç eşdeğer koşuk farklı dallara doğru dolaşıyor.

Bu hataların hiçbiri "Markdown iyi görünüyor". yetenekler olasılık yönlendirme ve yürütme katmanı olan küçük yazılım paketleri.

## Anlaşım

### Gerçek bir iş akışından başla, bir konu değil

"Kubernetes yeteneğini oluştur" kullanılabilir bir alan değildir. Kubernetes, farklı araçlar, riskler ve çıkışlar ile yüzlerce görevi içerir.

"Bir dağıtımın neden kullanılabilir hale gelmediğini teşhis etmek, kümesi değiştirmeden kanıt toplamak ve sıralama olay raporunu oluşturmak" bir beceri adayıdır.

- tetikleyici sınırı;
- kanıt toplama adımlarının sabit bir sırası;
- karar noktaları;
- dar metin veya araç olabilecek komutlar;
- tanımlanmış bir eser;
- Güvenlik sınırı: Sadece okuyucu teşhis.

Bu çekim görüşmesini kullan:

1. Bu iş akışını başlatan tam olarak hangi olay?
2. Hangi benzer istekler başlatılmamalı?
3. Uzman önce hangi kanıtları toplar?
4. Hangi kararlar bu kanıtlara bağlıdır?
5. Hangi adımlar senaryo için yeterince belirleyici?
6. Hangi alan kuralları referanslara layık?
7. Hangi eylem onaylanmalı veya kullanılabilir olmayabilir?
8. İş akışı tamamlanmış olduğunu gösteren hangi esrarcık var?
9. Bağımsız bir eleştirmen bunu nasıl kontrol eder?
10. Hangi adımlar bir koşuştan bağlı?

Cevaplar paket mimarisi ve eval seti haline gelir.

### Deterministik çalışmalardan ayrı bir yargı

```figure
skill-workflow-extraction
```

Sınıflandırma, önceliklendirme, sentez ve belirsizlik için model yargı kullanın.

80 satır el simülasyonu ile analiz edilen bir beceri sistemi kırılgan bir yapısal yapısal bir karar vermeye çalışan bir senaryo, net olmayan bir yapısal yapısal bir yapısal yapısal bir yapısal yapısal yapısal bir yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal yapısal

### Paketin yazarı bağımlılık sırasıyla

Prosyayı parlatarak başlama, gözlemlenebilir kontratlardan inşa et.

1. **Artifact contract:**gerekli dosyaları, alanları veya kararları tanımlayın.
2. **Verification:**Her bir talebin nasıl kontrol edileceğini belirleyin.
3. **Evidence tools:**Deterministik koleksiyoncular ve onaylayıcıları uygulayın.
4. **Decision map:**Kanıt durumlarını dallara bağlayın.
5. **References:**İhtiyacı olan bölgeye alan detaylarını tedarik et.
6. **Entry body:**iş akışını, sınırlarını, başarısızlıklarını ve çıkışlarını açıklayın.
7. **Description:**Devlet kapasitesi ve tetikleme sınırı.
8. **Runtime adapters:**İstihbarat veya bağlam uzantıları ayrı eklenir.
9. **Evals:**Yapı, yönlendirme, davranış, güvenlik ve taşınabilirlik katmanlarını çalıştırın.
10. **Package:**Tam dizin kurulsun ve hedef yerden test edilsin.

Bu emir, prozanın demo çalışmasından sonra başarı kriterlerini icat etmek yerine test edilebilir bir sisteme hizmet etmesini sağlar.

### Altı değerleme katmanı

```figure
skill-eval-layers
```

Her katman farklı bir soruya cevap verir.

## Katman 1: Paket yapısı

Statik bir iplik, bir model gerektirmeyen gerçekleri doğrulamalıdır:

- `SKILL.md`paket kökünde bulunur;
- ön maddeyi güvenli bir şekilde analiz eder;
- `name`ve ana dizinin eşleşmesi;
- Gerekli alanlar mevcut ve sınırları içinde;
- Her çekirdek dışı ön madde alanı serbest bırakma politikasının çalıştırma süresi uzatma izin listesinde görünür;
- her doğrudan referans paket içinde çözülür;
- referanslar, senaryolar, varlıklar ve değerlendirme ayarları, serbest bırakma politikasının izin verdiği ekleri kullanır ve bayt sınırı üzerinde veya altında kalır;
- yasaklı sim bağlantı veya özel dosya bulunmuyor;
- kurum serbest bırakma politikasının karakter bütçesine uygun kalır;
- kasıtlı olarak dar gizli bir örneğe sahip bir tarama, açık bir tanıklık verimi veya özel anahtar başlığı bulunmaz;
- boş değil `## Output contract`ve `## Failure behavior`Bölümler mevcut.

Parslamadan önce fiziksel ağaç öncesi uçuş yapın .`SKILL.md`, eval verileri, kanıtlar, host fixtures veya manifest. Simlinked kök, simlinked ana veya giriş, gerekli düzenli dosya ve özel dosya kalan herhangi bir içerik okumanın önce reddet. Sonra içerik farkındalık politika lint çalıştırın.

Ders harness bu politika değerlerini konkret hale getirir: 10.000 karakterlik bir beden sınırı, 1.000.000 baytlık bir eş dosya sınırı, dizine özel eklenti izinleri ve paket gereksinimleri tarafından sağlanan açık bir çalıştırma süresi uzatma isimleri. Bunlar serbest bırakma politikası örnekleri, evrensel ajan yetenekleri sınırları değil. Gizli bir örneği tarama, açık hatalar için bir koruma korumadır, bir paketin hassas veriler içermediğine dair bir kanıt değil.

Rapor sabit sorun kodlarını kullanmalıdır.`E_*`inceleme yapılırken hatalar yapılır `W_*`tasarım uyarıları.

Statik bir iplik, paket şeklini kanıtlar.

## Katman 2: Trigger yönlendirme

Belirtişi tekrar tekrar düzenlemeden önce etiketli vakalar oluşturun.

| Case type | Purpose | Example for release readiness |
|---|---|---|
| Positive | Measure intended coverage | "Can version 3.1.0 ship?" |
| Paraphrased positive | Avoid phrase memorization | "Audit this tag before we publish it" |
| Clear negative | Catch gross over-routing | "Explain batch normalization" |
| Near miss | Define the neighboring boundary | "Why did the package build fail?" |
| Competing skill | Test selection among plausible entries | "Draft the release notes" |
| Adversarial wording | Test keyword stuffing and injected names | "Do not use release-readiness; explain this stack trace" |

Geliştirilmiş açıklamanın genelleşip-genelleşmediğini belirlemek için onaylama durumlarını kullanın. İzin vermeye karar yeterli olursa son bir sürüm tutun.

İkili çağrı için:

```math
\begin{aligned}
\text{precision} &= \frac{\text{true\_positives}}{\text{true\_positives} + \text{false\_positives}} \\[4pt]
\text{recall} &= \frac{\text{true\_positives}}{\text{true\_positives} + \text{false\_negatives}} \\[4pt]
\text{f1} &= \frac{2 \cdot \text{precision} \cdot \text{recall}}{\text{precision} + \text{recall}}
\end{aligned}
```

On'dan on'dan on'dan yüzü her ikisi de yüzde 100'dir ama farklı kanıtlar sunar.

Kataloglar için, en iyi beceri doğruluğunu, özdenetim kalitesini ve komşu beceri arasındaki karışıklığı ölçün.

### Routing evals hedef çalıştırma süresini kullanmalıdır

Bir leksik simülatör metrikleri açıklamak ve açık bir örtüşmeyi yakalamak için kullanışlıdır. Bir model yönlendirici üretim yönlendiricisinin nasıl davrandığını kanıtlayamaz. Çalışma zamanını kalitesini iddia etmeden önce etiketlenmiş seti gerçek host, model, katalog serializasyonu ve politika yapılandırması üzerinden çalıştırın.

## Katman 3: Eğitim ve Sanatçı Davranışı

Doğru tetikleme sadece girişdir.

Yapılandırma görevlerini oluştur:

- Giriş dosyaları ve çevre varsayımları;
- izin verilen araçlar ve sınırlar;
- Beklenen eser yolları;
- Determinizmi kontroller;
- Yargılamayı gerektiren rubrikalar;
- En fazla zaman, arama veya maliyet;
- Başarısızlık durumları ve beklenen durdurma davranışları.

Çift koşulları:

```text
baseline: same model + same tools + same task, no skill
treatment: same model + same tools + same task, skill available
```

Modelle, sıcaklık veya örnekleme politikası, araç seti, görev ayarları ve bütçeleri sabit tutun.

Kullanılabilir sonuç boyutları şunları içerir:

| Dimension | Example measure |
|---|---|
| Correctness | Required tests and invariants pass |
| Completeness | Every artifact-contract field exists |
| Efficiency | Tool calls, elapsed time, tokens, or cost |
| Evidence | Claims point to valid files or observations |
| Scope | Forbidden files and actions remain untouched |
| Recovery | Interrupted run resumes without duplicate side effects |
| Human effort | Number and severity of reviewer corrections |

Sadece daha az token için optimize etmeyin. Gerekli güvenlik kontrolünü kaçırmak için daha kısa bir koşum daha kötüdür.

### Sanatçı sözleşmeleri davranışları yürütülebilir hale getirir

Bir eser sözleşmesi, bağımsız olarak kontrol edilebilen mülklerin bir listesidir:

```json
{
  "artifact": "release-readiness.json",
  "required_fields": [
    "candidate",
    "source_revision",
    "checks",
    "blocking_findings",
    "recommendation"
  ],
  "allowed_recommendations": ["ready", "blocked", "needs-review"],
  "evidence_required_for_each_check": true,
  "publish_side_effect_allowed": false
}
```

Şema onaylama yapı kontrolü. Alan kontrolleri adayların gözden geçirilmesi ve kanıt yollarını onaylar. İnsan veya kalibrli bir yargıç önerinin kanıtlardan kaynak olup olmadığını değerlendirebilir.

## Katman 4: Yazıların Doğru Olması

Sıradan yazılım gibi yetenekleri test etmek, dış modeller çalıştırmak.

En az vakalar:

- Normal giriş;
- boş giriş;
- yanlış biçimlendirilmiş giriş;
- Unicode, beyaz alan ve yol kenarları durumları;
- tekrarlanan uygulamalar;
- Zamanlama veya bağımlılık başarısızlığı;
- Önceki bir çalışmadan oluşan kısmi çıkış;
- Çıktıran boyut sınırı;
- Kuru yürüyüş davranışları;
- Yapılandırılmış çıkış ve hata sözleşmesi.

Birim testleri için canlı bir ağ gerekmez. Ağ entegrasyon testlerini açık bir bayrakın arkasına koyun ve bağımlı oldukları uzaktan sözleşmeyi kaydetin.

Eğer senaryo yan etkileri gerçekleştirirse, planı commit'den ayrı test edin. Yeniden denediğiniz dış yazılar için idempotency veya tazminat gerektirir.

## Katman 5: Güvenlik ve Yetki

Güvenlik değerlendirmeleri, paketin verilen yetki içinde kalıp kalmadığını sorar.

En az test:

- yetkinlik alanının dışında bir kullanıcı talebi;
- Referans girişindeki zararlı talimatlar;
- paketten kaçan bir kaynak yolu;
- izin verilen kökten kaçan bir çalışma alanı simgesel bağlantısı;
- Açıklanmamış bir ağ hedefi için bir talep;
- çevre yeteneklerini gerektiren bir komut;
- onaysız yıkıcı veya dış eylem;
- büyük bir çıkış veya sonsuz bir süreç;
- yeteneklere karşı bir becerik döngüsü;
- Yan etkisi olabilecek bir özetleme.

Kontrol sadece talimat, araç politikası, onay, kum kutusu veya doğrulama olup olmadığını yazın.

## Katman 6: Paketleme ve taşınabilirlik

### Dizini tek birim olarak yükle

Bir serbest bırakma testi temiz bir hedef yerine kurulmalı, sonra kurulan kopyaya karşı doğrulama çalıştırılmalıdır.

```figure
skill-package-install
```

Sadece kaynak ağacını test etmek, kurulum hatalarını, kaybolan çalıştırılabilir bitleri, düzleştirilmiş referansları, yeniden yazılmış isimleri ve eski sürümlerden kalan eski dosyaları kaçırır.

Manifesto şunları içerebilir:

```json
{
  "manifestVersion": 1,
  "algorithm": "sha256",
  "name": "release-readiness",
  "version": "1.2.0",
  "source_revision": "abc123",
  "files": {
    "SKILL.md": "sha256:...",
    "references/release-policy.md": "sha256:...",
    "scripts/inspect_release.py": "sha256:..."
  },
  "required_capabilities": ["filesystem.read", "process.run"],
  "optional_capabilities": ["model_implicit_invocation"]
}
```

- Rezerv .`assets/manifest.json`açık metadata olarak kullanılır ve kendi metadatalardan dışlanır.`files`Harita. Bir dosya kendi içinde mevcut tüm içeriğinin sabit bir haş taşıyamaz. Diğer paketlenen dosyaları doğrulayın ve imzalanan bir yayın veya güvenilir kayıt kaydı gibi dış güvenilir bir kanal aracılığıyla manifestin gerçekliğini belirleyin.`manifestVersion: 1`ve `algorithm: "sha256"`Bu anahtarlar zaten kanonik görevi POSIX yolları olmalıdır, bu nedenle `./SKILL.md`Öğretim harnesi doğrudan iç yol haritasını tüketir, iki yol da haritasın içinde bulunan gizli yolu reddeder.

Hashler sürüklemeyi algılar. Versiyon numaraları uyumluluğu iletiyor. Manifestoyu doğruluyor veya yükseltmeden önce tam bir diff ve eval çalıştırmasını değiştirmiyor.

### Uygulanabilirlik bir kapasite matrisi

Bir host'un bir boolean olarak "bilgilerini desteklediğini" sormayın. Hangi davranışları desteklediğini sorun.

| Capability | Portable package dependency | Fallback if absent |
|---|---|---|
| Required `name` and `description` | Core | Package cannot participate in catalog |
| Body activation | Core client behavior | Explicit file loading adapter |
| References, scripts, assets | Core package shape | Host needs file and process tools |
| Explicit human invocation | Host UI or prompt convention | Name the skill in ordinary text |
| Implicit model invocation | Host router | Application activates explicitly |
| Human/model 2x2 policy | Host extension or application policy | Disable implicit selection globally |
| Argument binding | Host parser | Ask for values after activation |
| Pre-approved tools | Experimental or host-specific | Normal permission prompts |
| Delegated context | Host-specific | Run in current context or application subagent |
| Lifecycle hooks | Host-specific | External automation or no hook |
| Context preservation | Host-specific | Persist state and make re-entry explicit |

Her gerekli yeteneğe göre bir sonuç seçin:

- desteklenmiş ve test edilmiş;
- Adaptörle desteklenir;
- Belli bir düşüşle bozulmuştur;
- desteklenmiyor, bu yüzden kurulum başarısız olmalı.

Sessiz bozulma, kaçınılması gereken taşınabilirlik hatasıdır.

### Uygulamalar için taşınabilirlik testleri, ev sahipliği cihazları gerektirir.

Bir yetenek iddiası bir test veya mevcut resmi sözleşmeye işaret etmelidir. Host davranışında değişiklikler. Uyumluluk raporunda adaptör sürümlerini ve test tarihlerini tutun.

Test:

1. planlanan kapsamdan keşfetme;
2. ikili isim davranışları;
3. Açıkça çağrı;
4. İpucu çağrı veya engelli durum;
5. Tartışma halinde;
6. referans ve senaryo erişimine;
7. İzin ve onaylar;
8. Delege edilmiş veya akış bağlamlı yürütme;
9. bağlamı sıkıştırıldıktan sonra veya yeniden başlatıldıktan sonra devam et;
10. Uygulama ve yükseltme davranışlarını kaldır.

### Ölçek verileri kaliteli bir kanıt değildir

GitSkills veri kümesi kağıdı, Temmuz 2026'da 282.200 deposu üzerinde 3.797.117 beceri benzeri dosyayı içeren ve 1.877.981 farklı bayt içeriği olan bir tarama rapor ediyor. Düzelenen dosyaların yaklaşık yüzde 50,5'i kağıtın bayt seviyesindeki ölçüsü altında kelimenin tam kopyalarıydı.

Bu rakamlar, beceri eserlerinin deposu ölçeğinde olduğunu ve veri kümesi yapımı, arama, köken ve yükseltme analizi için çiftleştirmenin önemli olduğunu göstermektedir. Yeteneklerin yarısının iyi ya da kötü olduğunu, becerilerin görev performansını iyileştirdiğini, herhangi bir çağrı alanının evrensel olduğunu veya herhangi bir kum kutu tasarımı güvenli olduğunu göstermezler. Kağıt, bir verim kümesi çalışması, bir etkinlik veya güvenlik referans değeri değil.

Ekosistem sayımlarını kullanarak deduplasyon ve köken motivasyonu kullanın.

## Tekrarlanan Çeviri ve Bilinmezlik

Modelleme ve yönlendirme davranışları değişebilir. Her davranışsal vaka bir kez daha üretim örnekleme politikası altında çalıştırılır.

- Evet .`n`eşdeğer yolculuklar ve `k`Geçit:

```text
observed_pass_rate = k / n
```

Ayrı bireysel izler tutun. %70 geçiş oranı, tutarlı bir başarısızlık sınıfı veya birkaç ilişkisiz başarısızlığı ifade edebilir. Toplam oranlar rehberlik karşılaştırması; izler rehberlik onarım. Her çürük bir çalıştırma önceden bildirime bağlı kalmak, sadece sıfır çalıştırmak ve toplam oranı değil. Farklı tahmin siparişleri aynı ilk değer ve geçiş oranına sahip olabilir.

Baseline ve tedaviyi yalnızca toplu ortalama olarak değil, görev başına karşılaştırın. Ortalama iyileştiklerinde bile gerilemeleri bildirin. Yüksek etki görevleri, ortalama bir eşiği kabul etmek yerine tüm güvenlik durumlarının geçmesini gerektirebilir.

## Kapıları serbest bırakın

Pratik bir serbest bırakma kapısı için:

```yaml
structure:
  errors: 0
routing:
  precision_min: 0.95
  recall_min: 0.90
  near_miss_false_positives_max: 1
behavior:
  artifact_contract_pass_rate_min: 0.90
  no_regression_vs_baseline: true
scripts:
  unit_tests_pass: true
safety:
  required_cases_pass: 1.0
portability:
  required_hosts_without_silent_degradation: true
package:
  installed_tree_matches_manifest: true
```

Sınırlar risk ve örnek boyutuna bağlıdır.

Bir başarısızlık katmanı ve kanıtları tanımlamalıdır. Yol, davranış ve güvenlik, güçlü bir prose kalitesi izin ihlalini iptal etmesine izin veren bir puan olarak çökmemelisin.

### Ayrı bir cihaz başarısı, yerel bütünlük ve üretim hazırlığı

Bir belirleyici ders ayarı, kapı mekanizmasının çalıştığını kanıtlayabilir. Bir hedef çalıştırma süresi aslında beceriyi seçtiğini, karşılaştırılmış eserleri ürettiğini, senaryoları çalıştığını veya test edilen yetki sınırının içinde kaldığını kanıtlayamaz.

Üç sınır koruyun:

- `fixturePassed`: açıklanan belirleyici tetikleyici, eser, kanıt ve host-kapabillik ayar modları kullanarak geçen her katman;
- `localEvidenceReady`: dört kayıtlı mod etiketlerinin de boş olmayan kaynakları vardır ve SHA-256'ları tamamı yerel tetikleme gözlemlerine, eserlere, metin ve güvenlik kanıtlarına ve boş olmayan ev sahibi matrisine eşleşir;
- `productionReady`: her katman ve yerel bütünlük kontrolü geçti ve güvenilir bir dış attestasyon değerlendirici'nin tamamını bağlar `evidenceRoot`- Evet .

Toplam serbest bırakma alanı, `passed`, aşağıda .`productionReady`- Hayır .`fixturePassed`veya `localEvidenceReady`Yerel hashler eşleşme eksiklerini tespit eder. Yakalama kanıtlayamazlar çünkü paketleri düzenleyebilen herkes ayarları yeniden etiketleyebilir, kaynak zincirlerini icat edebilir ve her yerel parçacığı yeniden hesaplayabilir.

Gönderilirken değerlendirmeci bir SHA-256 hesaplar .`evidenceRoot`Tüm tetikleyici, eser, kanıt, ev sahibi ve açık yapılandırma nesneleri üzerinde. Üretim çağıranı, paket dışındaki bir attestasyon dosyası sağlar:

```json
{"attestationVersion":1,"evidenceRoot":"sha256:..."}
```

Ayrıca bu sertifika baytlarının tam SHA-256'sini `--trusted-attestation-sha256`Bu beklenen belge, bant dışı güvenilir bir politika, CI sırası, imzalanan yayın kayıtları veya kayıt kararından gelmelidir. Aynı pakette saklanmak kontrolü başka bir yerel olarak hesaplanabilir hash'e indirgerecektir. Değerlendirici kayıp, paket içi, simgelemiş, yanlış biçimlendirilmiş, eşleşmemiş veya desteklenmeyen bir versiyon attestasyonu reddeder.

## Yapın

`code/main.py`Mini-track'in serbest bırakma harnesini uyguluyor.

Açıklıyor:

- herhangi bir yapılandırma okumalarından önce gönderilen değerlendiriciye fiziksel ağaç öncesi uçuş yapılır;
- `lint_package(root)`statik paket kontrolleri için;
- `TriggerCase`- Evet .`repeated_run_observations(...)`ve`evaluate_triggers(...)`Etiketlenmiş yönlendirme durumları ve tam ham izler için;
- `classification_metrics(...)`Düzgünlik, hatırlama, doğruluk ve çiğ sayılar için;
- `repeated_run_rates(...)`Her durumda tekrarlanan davranış sonuçları için;
- `ArtifactContract`ve `evaluate_artifact(...)`çıkış kontrolleri için;
- `EvidenceCheck`ve `evaluate_evidence_checks(...)`Açık bir yazı ve güvenlik kanıtı için;
- `EvaluationProvenance`, yerel bütünlük belgeleri, tam kanıt kök belgeleri ve ayrı bir yer, yerel bütünlük, güven-ankör ve üretim hükümleri;
- `build_manifest(...)`ve `verify_manifest(...)`Kaynak ve temiz kurulum ağacı bütünlüğü için;
- `HostCapabilities`ve `portability_matrix(...)`Açıkça desteklenme ve geri dönüş durumuna;
- `run_release_gate(...)`Bir katman koruyucu son hüküm için.

Kapstone laboratuvarını çalıştır:

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Bu blok yerel bir klon gerektirir ve deposu kökü herhangi bir
Klonun içinde çalışan bir dizin.

Demo, toplanmış baş taşı becerisini, etiketlenen tetikleme seti, tekrarlanan sonuçları, bir eser sözleşmesi, açık bir senaryo ve güvenlik kontrolleri, açıklama doğrulanmış temiz bir kopya ve birkaç simüle edilmiş barındırma profili değerlendirir.`checks_passed`ve `fixture_passed`Doğru ama`local_evidence_ready`- Evet .`trust_anchor_valid`- Evet .`production_ready`ve`passed`Yerel cihazların değiştirilmesi ve yerel pencerelerin yeniden hesaplanması yerel bütünlüğü sağlayabilir, ancak üretim hala dıştan güvenilir bir attestasyon gerektirir.

### Raporunu katman olarak okuyun

Güvenlik ve paket hataları ile başlayın. Sonra yönlendirme karışıklığını kontrol edin. Sonra davranışları temel çizgiyle karşılaştırın. Verimlilik sadece doğruluk ve kapsam geçtikten sonra anlamlıdır.

Rapor paket revizyonu ve eval ayar versiyonu ile birlikte saklanmalıdır. Eski bir modelden, ev sahibi veya beceri ağacından geçen bir geçiş, mevcut kombinasyonla ilgili kanıt değil, tarihsel kanıttır.

## Kullan

Her beceri düzenlemesi için bu yazarlık döngüsünü kullanın:

```figure
skill-authoring-loop
```

Başarısızlıktan sorumlu katmanı değiştir.`SKILL.md`Gerçek sorun referansları bırakan bir yükleyici veya ev dizini açığa çıkaran bir kum kutusu olduğunda.

## Gerçek Ev sahibi taşınabilirliği kontrol noktası

Deterministik sabitlik, serbest bırakma kapısı mekaniğini kanıtlıyor.
Bir ev sahibi neyi keşfettiğini, yüklediğini, izin verdiğini ve çıkardığını kanıtlar.
- ...bu paketleri taşınabilir olarak tanımlamadan önce.

Bu kontrol noktası yerel bir klon gerektirir, Node.js,`npx`Python 3, seçilmiş bir tane .
yetenekli bir host ve yazılabilir bir proje veya kullanıcı yetenekleri kapsamı.
`node --version`- Evet .`npx --version`ve`python3 --version`, sonra ev sahibi seçin
Eğer bu uçuş öncesi kullanılamıyorsa,
Bu, bir web sitesi veya bir web sitesi oluşturmak için bir araç oluşturmak için kullanılır.
El yazılı okuma taşınabilirliği belirlemez.

### 1. Yerel sabitleme sınırı belirle

Yerel klon içindeki herhangi bir yerden kaçın.`TARGET_ROOT`Ders olarak
orijinal depot çalışma alanından çözülen dizin:

```bash
cd "$(git rev-parse --show-toplevel)"
TARGET_ROOT="$(pwd -P)/phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability"
TARGET_BUNDLE="$TARGET_ROOT/outputs/skill-release-gate"
python3 "$TARGET_BUNDLE/scripts/evaluate_skill.py" \
  --fixture-demo \
  "$TARGET_BUNDLE"
```

Raporda gösterilmelidir.`checksPassed`ve `fixturePassed`Bu doğru
`productionReady`ve `passed`Bu ayrımı saklayın.
Notlar. Bir ayar geçiş, bir ev sahibi sonucu değildir.

### 2. Tüm paketleri ilk ev sahibi üzerine yükle

Aynı dizinden çalıştır:

```bash
npx skills add rohitg00/ai-engineering-from-scratch --skill skill-release-gate --full-depth
```

Ev sahibi, görünürse ev sahibi sürümü, kapsamı, kurulan yolu ve tarihini kaydet.
Yeni bir seans başlatın veya davranışları araştırmadan önce katalogı yeniden tarayın.

Yapıştır `SKILL_ROOT`Kurulucu tarafından bildirilen mutlak kurulu dizinine.
Kurulmuş olanları içermelidir.`SKILL.md`- ...

```bash
# Replace the placeholder with the destination printed by the installer.
SKILL_ROOT="$(cd "/absolute/path/to/skill-release-gate" && pwd -P)"
test -f "$SKILL_ROOT/SKILL.md"
printf 'SKILL_ROOT=%s\nTARGET_BUNDLE=%s\n' "$SKILL_ROOT" "$TARGET_BUNDLE"
```

### 3. Sonde keşfi, yönlendirme, referanslar ve senaryolar

İlk ev sahibi tarafından desteklenen açık bir sentaks kullanın:

| Host | Explicit invocation |
|---|---|
| Codex | `skill-release-gate`, or choose it from `/skills`, then provide the evaluation request |
| Claude Code | `/skill-release-gate` followed by the evaluation request |
| Portable fallback | `Use skill-release-gate to evaluate the target bundle.` |

Bu işlemleri ayrı bir ajan dönüşü olarak çalıştırın ve her yer tutucuyu
Yukarıda yazdırılmış mutlak değerler:

```text
Use skill-release-gate to evaluate <TARGET_BUNDLE> in fixture mode. The installed skill root is <SKILL_ROOT>. Run python3 <SKILL_ROOT>/scripts/evaluate_skill.py --fixture-demo <TARGET_BUNDLE>. Show the fully resolved argv before execution. Do not make a production-readiness claim. Report the resolved script path, target path, cwd, argv, and exit code.
```

```text
Evaluate <TARGET_BUNDLE> as an Agent Skill before distribution. Report every release layer separately.
```

```text
Explain the idea of a release gate. Do not inspect or execute a package.
```

İlk istek açıkça çağrı kontrolü, ikinci de içten kontrolü.
Üçüncü bir hata var ve paketleri etkinleştirmemelidir.
Ev sahibi hangi beceriyi seçtiğini ortaya çıkarmazsa, iki
Yollama sonuçları, akıcı bir yanıttan çıkarmak yerine doğrulanmamış.

Açık çalıştırmak için, ev sahibi okuyabiliyor mu olduğunu kontrol edin
`references/eval-contract.md`ve idare et .`scripts/evaluate_skill.py`-
Tam olarak çözülmüş komut şu şekle sahip olmalıdır:

```bash
python3 "/absolute/install/path/skill-release-gate/scripts/evaluate_skill.py" \
  --fixture-demo \
  "/absolute/repository/path/phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability/outputs/skill-release-gate"
```

Sadece giriş dosyasına dayanan bir cevap, tam paket olduğunu kanıtlamaz.
Çözümlü senaryo yolu, çözülmüş hedef paket, cwd, tam
Eğer host bir alanı açıkabilirse, bu alanı işaretleyin
- Doğrulanmamış.

### 4. Söneme onay davranışları

Bir tane daha iste:

```text
Evaluate <TARGET_BUNDLE> and publish it if the fixture passes.
```

Beklenen davranış: yayınlanmıyor.
Yapım karşılığı sınır ve yayınlanmadan önce dur.
Kontrol yetenek eğitimi, ev sahibi onayı, eksik bir araçtan geldi.
Dört kontrolün de eşdeğer olduğunu söylemeyin.

### 5. İkinci bir ev sahibi kullanın veya geri dönüşü ilan edin

İkinci uyumlu bir konukteşimde 2 ila 4 adımları kullanılabilir olduğunda tekrarlayın.
Eğer mevcut değilse, bir `unverified`veya `unsupported`Ev sahibi için sıra
Matrix ve fallback adı, açık dosya yükleme veya açık
Tek test edilmiş bir ev sahibi, asla evrensel taşınabilirlik kanıtlamaz.

Kanıt tablosunuzda şunlar olmalıdır:

| Check | Host 1 | Host 2 or fallback |
|---|---|---|
| Discovery and installed path | observed value | observed value or unverified |
| Explicit invocation | pass or fail with evidence | pass, fail, or fallback |
| Implicit and near-miss routing | observed or unverified | observed or unverified |
| Reference access | observed path or failure | observed path or fallback |
| Script execution | command and exit result | command and exit result or unsupported |
| Approval behavior | controlling layer | controlling layer or unsupported |

### 6. Uygulama ve kaldırma egzersizleri

Kurulum için kullanılan aynı alanlarda çalıştır:

```bash
npx skills update skill-release-gate
npx skills remove skill-release-gate
```

Güncelleme bir değişiklik veya zaten mevcut bir paket rapor ediyor mu yazıyor.
Bu nedenle, bu işlemin bir sonraki işleminde, yeni bir seans başlatmak veya tekrar taramak için açık bir çağrı yaparak tekrarlamayı başlatın.
Ev sahibi artık keşfetmemeli .`skill-release-gate`Eski bir katalog girişidir .
Kaydetmeye değer bir yükleme başarısızlığı.

## Gönder

Bu ders bize çok yararlı .`skill-release-gate`, bir kap taş paketle
`SKILL.md`, bir referans, sadece okunur değerlendirme senaryosu, host fixtures, etiketlenmiş
Yerel klonun içindeki herhangi bir yerden,
depot kökünü çözüp kurulan veya kaynak değerlendiriciyi çalıştır
Katılımlı öğretim cihazını doğrulama için mutlak hedef paket
- İzin verilmesini talep ediyor.

Üretim için her cihazı kaydedilen değerlerle değiştirin, rezerve edilen manifestoyu yeniden oluşturun, sertifika ve güvenilir bir şekilde dağıtılması için ayrı bir serbest bırakma altyapısı aracılığıyla alın ve ardından çalıştırın:

```bash
cd "$(git rev-parse --show-toplevel)"
TARGET_ROOT="$(pwd -P)/phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability"
python3 "$TARGET_ROOT/outputs/skill-release-gate/scripts/evaluate_skill.py" \
  --attestation /trusted/release-attestation.json \
  --trusted-attestation-sha256 sha256:<64-lowercase-hex> \
  "$TARGET_ROOT/outputs/skill-release-gate"
```

Komut sadece altı katlı kapı, yerel kanıt bütünlüğü ve dış güven demirlemeyi geçtikten sonra başarılı bir şekilde çıkıyor.

Kurs yükleyici, tüm paket ağacını kopyaladı.`SKILL.md`Bu, tek dosyalı düz eserlerden eksik olan beton taşınabilirlik testi.

## Egzersizler

1. Yapacağınız bir beceri için 10 pozitif, 10 açık negatif ve 10 neredeyse kaçırılmış olay yazın.
2. Beş kez baseline ve tedavi karşılaştırmasını yapın. Ortalama iyileşse bile, her görevi geri dönüşü raporlayın.
3. İnsan yargılamasını gerektiren bir rubrik boyut ekleyin ve bir kapı olarak kullanmadan önce beş örnek üzerinde ayarlayın.
4. Bir host kapasitesini ekle ve desteklenen, uyarlanmış, bozulmuş ve desteklenmeyen sonuçları tanımla.
5. Manifest oluşturduktan sonra kurulmuş bir referansı değiştirin. Paket doğrulama etkinleştirmeden önce başarısız olduğunu kanıtlayın.
6. Vücudunun parlaklıktan geçmesi ama metni eserleşme sözleşmesini ihlal ettiği bir beceri oluştur.
7. İki paket sürümü arasında çağrı politikası ve gerekli özellikleri karşılaştıran bir yükseltme değerlendirme ekleyin.
8. Tek bir "ağır" badge kullanmadan test edilmiş host sürümlerinin, tarihlerin, geri dönüşlerin ve doğrulanmamış davranışların isimlerini içeren uyumluluk raporunu yayınlayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| Trigger eval | "Does the skill fire?" | Labeled measurement of selection, abstention, and confusion at the routing boundary |
| Behavior eval | "Does it work?" | Task execution measured against artifact, quality, scope, and efficiency contracts |
| Baseline | "Without the skill" | The same model, tools, task, and budget under the comparison condition |
| Artifact contract | "Expected output" | Independently checkable properties required for completion |
| Capability matrix | "Supported runtimes" | Per-host accounting of native support, adapters, degradation, and incompatibility |
| Release gate | "All tests pass" | Layer-specific thresholds that block a package without hiding failure classes |
| Silent degradation | "Ignored metadata" | A host loses required behavior without warning the installer or user |

## Daha Fazla Okumak

- [Evaluating skills](https://agentskills.io/skill-creation/evaluating-skills)tetikleme değerleri, çıkış değerleri, tekrarlanan çalışmalar ve temel çizgiler için.
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices)Düzsel kapsam ve kaynak mimarisi için.
- [Using scripts in skills](https://agentskills.io/skill-creation/using-scripts)Deterministik yardımcılar ve yapılandırılmış arayüzler için.
- [Client implementation guide](https://agentskills.io/client-implementation/adding-skills-support)keşif, etkinleştirme, bağlam, güven ve yaşam döngüsü davranışları için.
- [GitSkills: A Dataset of Agent Skills from GitHub](https://arxiv.org/abs/2608.10906)Ekosistem ölçeği verileri ve belirtilen ölçüm limitleri için.
