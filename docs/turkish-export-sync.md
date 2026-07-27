# Türkçe Hafif Dağıtımı Güncelleme

Bu depo, ana curriculum deposundan yeniden üretilen bir dağıtımdır; doğrudan burada
ders anlatımı düzenlemeyin. Düzeltmeleri önce kaynak depodaki `docs/tr.md` dosyalarına
uygulayın.

## Yeniden üretme

Kaynak deponun temiz ve doğrulanmış bir checkout'unda:

```bash
python3 scripts/localize_curriculum.py check
revision="$(git rev-parse HEAD)"
python3 scripts/export_turkish_curriculum.py \
  --source-revision "$revision" \
  --output ../ai-engineering-from-scratch-tr \
  --archive ../ai-engineering-from-scratch-tr.tar.gz
```

Komut, hedef dizin zaten varsa üzerine yazmaz. Önce eski hedefi arşivleyin veya yeni
bir hedef adı kullanın. Üretilen `MANIFEST.json`; kaynak revizyonunu, kapsamı, bağlantı
kontrolünü, dosya sayısını ve içerik boyutunu kaydeder.

## Yayınlama

1. Kaynak revizyonunun testlerden geçtiğini doğrulayın.
2. Üretilen deponun `MANIFEST.json` dosyasındaki kapsamın `%100` olduğunu doğrulayın.
3. Hafif depo branch'ini üretilen dizinin içeriğiyle güncelleyin; kaynak deponun
   `.git` geçmişini taşımayın.
4. Aynı revizyon etiketiyle `.tar.gz` dosyasını indirilebilir release asset'i olarak
   yükleyin ve SHA-256 değerini release notlarına ekleyin.
5. `source_revision` değerini kaynak depodaki commit ile karşılaştırarak
   senkronizasyonu denetleyin.

Arşiv girdilerinin sahiplik ve zaman damgası metadata'sı sabitlendiğinden aynı içerik
ve kaynak revizyonuyla tekrar üretim aynı SHA-256 değerini verir.
