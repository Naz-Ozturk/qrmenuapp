# ILNA Kafe QR

Masa bazlı QR menü ve sipariş platformu. Müşteri masadaki QR kodu okutur, menüyü tarayıcıda açar, sipariş verir, garson çağırır, hesap ister, çark çevirir ve sadakat damgası toplar. İşletme tüm bunları paneldeki canlı ekrandan takip eder.

| Adres | Ne açılır |
|---|---|
| `/cafe/sube1/masa5` | 5 numaralı masanın menüsü (QR kodlar bu adrese gider) |
| `/` | Sadece göz atılabilen menü (sipariş verilemez) |
| `/panel` | İşletme paneli (şifreyle) |
| `/healthz` | Sunucu ayakta mı kontrolü |

## Neler var

**Müşteri menüsü:** kategoriler, sepet, mutfağa not, sipariş durumu takibi (Alındı → Hazırlanıyor → Masanda), garson çağırma, hesap isteme (kart/nakit), indirim çarkı, telefonla sadakat kartı, menü asistanı, müşterinin görünüm (tema) seçimi.

**İşletme paneli:**
- Canlı akış: siparişler ve çağrılar anında düşer, sesli bildirim verir. Hesabı açık masalar listelenir, "Ödendi" ile masa kapatılır.
- Menü: ürün adı, fiyat, açıklama, görsel, stok, kategori ve reçete düzenleme; kategori sıralama.
- Masalar ve QR: masa sayısı, her masa için QR, PNG indirme, tümünü yazdırma (A4'e 3 sütun).
- Tema ve marka: hazır temalar, renkler, yazı tipleri, logo; canlı önizleme.
- Çark ve sadakat: dilimler, en az sipariş tutarı, damga hedefi, üye listesi (numaralar gizli).
- Raporlar: günlük ciro, 7 günlük tahmin (en az 14 gün veri birikince), saatlik yoğunluk, en çok satanlar, hammadde tüketimi ve sipariş önerisi.
- Yedek indir: tüm veriyi tek JSON dosyası olarak indirir.

**Güvenlik:** fiyat, indirim ve çark sonucu sunucuda hesaplanır; tarayıcıdan gelen tutara güvenilmez. Panel şifresi ve imzalı oturum çerezi kullanılır (12 saat). Hatalı şifre denemesi, sipariş ve çağrı istekleri hız sınırına tabidir. Başka sitelerden gelen veri değiştirme istekleri reddedilir.

---

## 1. Bilgisayarınızda deneme

Gereken: [Node.js 18 veya üstü](https://nodejs.org)

```bash
npm install
npm run dev
```

- Menü: http://localhost:3000/cafe/sube1/masa1
- Panel: http://localhost:3000/panel (şifre: `demo1234`)

`npm run dev`, raporların dolu görünmesi için 28 günlük örnek sipariş üretir. Örnek veriyi silmek için sunucuyu durdurup `data/` klasörünü silin.

Telefondan denemek için bilgisayar ile telefon aynı Wi-Fi'da olmalı. Adres `http://<bilgisayarın-yerel-ip-adresi>:3000/cafe/sube1/masa1` olur.

---

## 2. İnternette yayına alma

Üç yoldan birini seçin. Gerçek kafede kullanacaksanız **kalıcı disk şart**: menü, siparişler ve sadakat damgaları `data/db.json` dosyasında tutulur. Disk kalıcı değilse sunucu her yeniden başladığında hepsi silinir.

### A) Kendi sunucunuz (VPS): önerilen, en ucuz ve tam kontrollü

Uygun: Hetzner, DigitalOcean, Turhost, Natro vb. 1 CPU / 1 GB RAM Ubuntu sunucu yeterli.

1. Alan adınızın DNS ayarlarına bir **A kaydı** ekleyin: `menu.ornekkafe.com` → sunucunun IP adresi.
2. Sunucuya bağlanıp Docker kurun:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
3. Bu klasörü sunucuya kopyalayın (örn. `scp -r ilna-kafe-qr kullanici@sunucu:~/`) ya da GitHub'dan `git clone` yapın.
4. Ayar dosyasını hazırlayın:
   ```bash
   cd ilna-kafe-qr
   cp .env.example .env
   nano .env        # ADMIN_PASSWORD, SESSION_SECRET ve DOMAIN alanlarını doldurun
   ```
   `SESSION_SECRET` üretmek için: `docker run --rm node:20-alpine node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
5. Başlatın:
   ```bash
   docker compose up -d --build
   ```
   Caddy, alan adınız için HTTPS sertifikasını kendisi alır. Birkaç dakika içinde `https://menu.ornekkafe.com/panel` açılır.

Güncelleme: yeni dosyaları kopyalayıp `docker compose up -d --build`.
Kayıtları izleme: `docker compose logs -f app`.
Yedek: panelden "Yedek indir" ya da sunucuda `docker compose cp app:/data/db.json ./yedek.json`.

### B) Render.com: sunucu yönetmeden

1. Bu klasörü bir GitHub deposuna yükleyin.
2. Render'da **New → Blueprint** seçip depoyu bağlayın; `render.yaml` dosyasını otomatik okur.
3. İstendiğinde `ADMIN_PASSWORD` değerini girin.
4. Plan "Starter" olmalı: kalıcı disk ücretsiz planda yok.
5. Kendi alan adınızı Render panelinde **Settings → Custom Domains** kısmından ekleyin.

### C) Railway.app

1. GitHub deposunu Railway'de **New Project → Deploy from GitHub** ile bağlayın. Railway `Dockerfile` dosyasını kullanır.
2. **Variables** kısmına `ADMIN_PASSWORD`, `SESSION_SECRET`, `BRANCH` ekleyin.
3. **Volume** ekleyip `/data` yoluna bağlayın.
4. **Settings → Networking** kısmından alan adı alın veya kendi alan adınızı bağlayın.

---

## 3. Yayına aldıktan sonra

1. `https://alanadiniz/panel` adresine girin.
2. **Tema ve marka:** kafe adını, logoyu ve renkleri ayarlayın.
3. **Menü:** örnek ürünleri kendi ürünlerinizle değiştirin. Kahve ürünlerinde "Damga" anahtarı açık olmalı.
4. **Masalar ve QR:** masa sayısını girin, **Tümünü yazdır** ile QR kodları basın ve masalara yerleştirin.
5. Kasa ya da mutfak ekranında **Canlı akış** sekmesini açık bırakın. Tarayıcının sesi açık olmalı. Ses çalmazsa sayfaya bir kez tıklayın, tarayıcılar ilk tıklamadan önce ses çalmaya izin vermez.

## Ayarlar (ortam değişkenleri)

| Değişken | Açıklama | Varsayılan |
|---|---|---|
| `ADMIN_PASSWORD` | Panel şifresi, en az 8 karakter. **Zorunlu.** | – |
| `SESSION_SECRET` | Oturum imza anahtarı. Boş bırakılırsa her yeniden başlatmada panel oturumları kapanır. | rastgele |
| `BRANCH` | QR adresindeki şube adı | `sube1` |
| `CAFE_NAME` | İlk kurulumdaki kafe adı | `ILNA Kafe` |
| `DATA_DIR` | Veri klasörü | `./data` |
| `SEED_DEMO` | `true` ise ilk açılışta örnek sipariş üretir | `false` |
| `PORT` | Sunucu portu | `3000` |
| `TZ` | Saat dilimi (raporlar için) | `Europe/Istanbul` |

## Bilinen sınırlar ve sonraki adımlar

- **Ödeme:** masadan online ödeme henüz yok. Müşteri hesap ister, garson kart/nakit tahsil edip panelden masayı kapatır. Sanal POS (iyzico, PayTR vb.) entegrasyonu sonraki adımdır.
- **Sadakat doğrulaması:** telefon numarası SMS ile doğrulanmıyor; başkasının numarasını yazan biri onun damgalarını kullanabilir. Yaygın kullanımdan önce SMS doğrulama (OTP) eklenmeli.
- **Çark hakkı** cihaz çerezine bağlı; çerezini silen müşteri yeni hak alabilir. İndirim tutarları küçük tutulursa bu kabul edilebilir.
- **Asistan:** ürün etiketlerine dayalı kural tabanlı öneri yapıyor. Gerçek yapay zeka bağlantısı (Faz 3) için sunucuya bir LLM API anahtarı ve uç nokta eklenecek.
- **Ölçek:** veri tek bir JSON dosyasında, tek sunucu ve tek şube için tasarlandı (birkaç yüz masa ve günde binlerce sipariş sorunsuz). Çok şubeli SaaS'a geçerken PostgreSQL gibi bir veritabanına taşınmalı.
- **KVKK:** sadakat için telefon numarası saklanıyor. Menüde aydınlatma metnine bağlantı verin ve veri saklama süresini belirleyin.

## Dosyalar

```
server.js           Sunucu: API, veri saklama, canlı bildirim (SSE), raporlar
public/menu.html    Müşteri menüsü
public/panel.html   İşletme paneli
Dockerfile          Konteyner tanımı
docker-compose.yml  VPS kurulumu (uygulama + otomatik HTTPS)
Caddyfile           HTTPS ve ters vekil ayarı
render.yaml         Render.com kurulumu
.env.example        Ayar şablonu
```
