# 81 Okey Web Oyunu — Opus 4.6 Thinking Prompt

---

## ROL VE BAĞLAM

Sen deneyimli bir full-stack oyun geliştiricisin. Türkiye'de özellikle Karaman bölgesinde oynanan **81 Okey** adlı kart/taş oyununun web tabanlı, çok oyunculu versiyonunu geliştiriyorsun. Referans tasarım olarak Zynga'nın **101 Okey Plus** oyununun görsel dili ve kullanıcı deneyimi benimseniyor. Oyun **Antigravity** platformunda çalışacak ve model olarak **Claude Opus 4.6 Thinking** kullanılacak.

---

## OYUN KURALLARI (KESİN REFERANS — HİÇBİR KURAL ATLANAMAZ)

### Genel Yapı
- 4 oyunculu, **eşli** oynanan bir okey türüdür (2 takım, her takımda 2 oyuncu)
- Standart **106 taşlık** klasik okey seti kullanılır (1-13 arası 4 renk × 2 set + 2 joker)
- Her oyuncuya oyun başında **14 taş** dağıtılır (101 okeyden farklı; 22 değil 14)
- Taşlar **7'li gruplar** halinde ayrılır; gösterge taşı **iki aşamalı zar** atılarak belirlenir
- Birinci zar gösterge taşının çekileceği grubu, ikinci zar o gruptaki taşı belirler

### El Açma Koşulları
- Oyuncular iki yöntemden biriyle el açabilir:
  1. **Seri/per kombinasyonlarla** minimum **81 puan** toplamak *(12-13-1 dizilimi GEÇERSİZDİR)*
  2. **Minimum 4 çift** toplayarak açmak
- Oyun başında oyuncular anlaşarak el açma eşiğini **101 puana** da yükseltebilir

### Seri ve Per Kombinasyonları
- **Per:** Aynı sayıdan 3 veya 4 farklı renk taş
- **Seri:** Aynı renkten ardışık en az 3 taş (12-13-1 GEÇERSİZ)
- Joker (okey taşı) her kombinasyonda herhangi bir taşın yerine geçebilir

### Çift Açma Kuralları ve Kafa Atma Sistemi

| Açılan Çift Sayısı | Sonuç |
|---|---|
| 4 çift | Normal açış — ıstakaya göre ceza hesaplanır |
| 5 çift | **Kafa atma** → oyuncudan **-100 puan** silinir |
| 6 çift | **Çift kafa atma** → oyuncudan **-200 puan** silinir |

### Seri Kombinasyonla Kafa Atma

| Açılan Toplam Puan | Sonuç |
|---|---|
| 81–100 puan | Normal açış |
| 101–120 puan | **Kafa atma** → **-100 puan** silinir |
| 121+ puan | **Çift kafa atma** → **-200 puan** silinir |

### Çifte Gitme Mekanizması
- Sıra sende değilken rakibin attığı taşı almak için **önce o oyuncudan izin istemen** gerekir
- Rakip **izin verirse:** taşı alıp elinizi açabilirsin
- Rakip **izin vermezse:**
  - Sen taşı **alamazsın**
  - Rakip **"çifte geçmiş"** sayılır → o oyuncunun ceza puanları **iki katına** çıkar
- **Çifte giden oyuncu:** Rakibin attığı her taşı, kombinasyonda kullanmasa bile alabilir; ancak rakip **işlek taş** attıysa alamaz
- **Çifte gitme ilanı:** Bir oyuncu "Çifte Gidiyorum" ilan ederse, diğer tüm oyuncular seri kombinasyonla açmak için **minimum 101 puan** yapmak zorundadır (normal 81 eşiği değil)

### İşlek Taş Kuralı
- Rakibin attığı **işlek taş** (o an en değerli/kritik taş) alınamaz
- Ortadan çekilen işlek taş, el açıksa kullanılabilir (kombinasyona işlenebilir)

### Çift Açma Sonrası Kurallar
- Herhangi bir oyuncu 5 veya 6 çiftle el açarsa → diğer oyuncular da ellerindeki **çiftleri** yere açabilir
- Çift açan oyuncu: **yere taş işleyebilir** ama **yeni seri/per kombinasyon açamaz**

### Tur Sonu Koşulları
- Ortadaki kapalı taş yığını (ıstaka) tamamen bittiğinde **tur sona erer**
- Bir oyuncu elindeki tüm taşları yere açtığında **tur sona erer**

### Puanlama Sistemi (Tam Referans)

| Durum | Puan Etkisi |
|---|---|
| Elini açamayan oyuncu | **+100 ceza puanı** |
| Elini açamayan + rakibe izin vermeyen | **+200 ceza puanı** |
| Elini açan oyuncu | Istakada kalan taşların **toplam değeri** kadar ceza eklenir |
| Çift açan + rakibe izin vermeyen | Istakada kalan taşların **iki katı** ceza eklenir |
| Kafa atma (5 çift veya 101–120 puan seri) | **-100 puan** silinir |
| Çift kafa atma (6 çift veya 121+ puan seri) | **-200 puan** silinir |
| Elini bitiren oyuncu | **-100 puan** silinir |
| Okey taşıyla el bitirme | **-200 puan** silinir + rakip oyunculara **iki kat** ceza |

---

## TEKNİK MİMARİ GEREKSİNİMLERİ

### Frontend
- **Vanilla JavaScript (ES6+)** veya **React** — tek dosya öncelikli
- **HTML5 Canvas** — taş çizimi, animasyonlar, masa render
- **CSS3** — yeşil çuha masa dokusu, responsive layout, geçişler
- **Drag & Drop** — taşları elden masaya, elden ele sürükleme (interact.js veya native HTML5 DnD)
- Taşlar arasına **boşluk bırakabilme** (gruplama için)

### Oyun Motoru (Game Engine — UI'dan Bağımsız)
- Tamamen **pure JavaScript modülü** olarak yazılmalı
- Test edilebilir, UI-agnostik fonksiyonlar:
  - `dealTiles(players, tileSet)` — taş dağıtma
  - `validateCombination(tiles)` — seri/per geçerlilik kontrolü
  - `calculateHandScore(combinations)` — el puanı hesaplama
  - `calculatePenalty(player)` — ceza puanı hesaplama
  - `checkKafaAtma(score)` — kafa atma durumu tespiti
  - `requestPermission(fromPlayer, toPlayer, tile)` — çifte gitme akışı
  - `declareCifte(player)` — çifte ilan mekanizması
  - `isValidOpen(tiles, threshold)` — el açma geçerlilik kontrolü

### Multiplayer (Çok Oyunculu)
- **WebSocket** (Socket.io) ile gerçek zamanlı oda sistemi
- Her aksiyon sunucuya **event** olarak gönderilir, sunucu doğrular ve herkese **broadcast** eder
- Kritik event'ler: `DRAW_TILE`, `DISCARD_TILE`, `OPEN_HAND`, `REQUEST_PERMISSION`, `GRANT_PERMISSION`, `DENY_PERMISSION`, `DECLARE_CIFTE`, `END_TURN`, `END_ROUND`

### Backend
- **Node.js + Socket.io** — gerçek zamanlı iletişim
- **Redis** — oda yönetimi, oturum durumu
- **PostgreSQL veya MongoDB** — kullanıcı puanları, istatistikler

### Bot (Tek Oyunculu Mod)
- Basit **kural tabanlı öncelik sistemi** (değil rastgele)
- Öncelik sırası: kombinasyonu tamamla → puan yükselt → gereksiz taşı at
- Çifte gitme kararını puana göre hesapla

---

## KULLANICI ARAYÜZÜ GEREKSİNİMLERİ (UI/UX)

### Masa Düzeni
- **Yeşil çuha dokulu** oval veya dikdörtgen masa
- 4 oyuncu konumu: **Güney (sen)**, **Kuzey (karşı)**, **Doğu (sağ)**, **Batı (sol)**
- Aktif oyuncunun avatarı **parlıyor / çerçeveleniyor** (tur göstergesi)
- Her oyuncunun üstünde: **avatar + isim + mevcut puan**

### Merkez Alan
- Ortada kapalı taş yığınları **(ıstaka)** — kalan taş sayısı görünür
- Yanında **atılan son taş** açık olarak görünür
- **Gösterge taşı** ayrıca belirgin şekilde gösterilir

### Oyuncu Eli (Alt Panel)
- Taşlar altta **yatay raf (rack)** üzerinde
- **Sürükle-bırak** ile yeniden sıralama
- Taşlar arası **boşluk bırakılabilir** (gruplama)
- Hover'da taş **büyür**; seçilince **altın çerçeve**
- Geçerli kombinasyon **yeşil highlight**, geçersiz **kırmızı uyarı**

### Açılmış Kombinasyonlar
- El açıldığında taşlar masanın ilgili köşesine seri/per gruplar halinde görünür
- Açılan kombinasyonun puanı **canlı sayaç** ile gösterilir

### Özel UI Bileşenleri — 81 Okey'e Özgü

**Çifte Gitme Akışı:**
- Rakibin attığı taşı almak isteyince: **"İzin İste"** butonu belirir
- Rakibin ekranında: **"İzin Ver / Reddet"** popup'ı çıkar
- Redde durumunda: rakibin ekranında **"ÇİFTE GEÇTİNİZ"** banner animasyonu
- Tüm oyunculara bildirim gider

**Çifte İlan Etme:**
- Masada her zaman görünür **"Çifte Git"** butonu
- Basınca tüm oyunculara bildirim → diğer oyuncuların açma eşiği otomatik 101'e yükselir
- Ekranda belirgin **"ÇİFTE GİDİLDİ"** göstergesi

**Kafa Atma Animasyonu:**
- El açılırken toplam puan **canlı olarak sayılır**
- 101–120 puana ulaşınca: **"KAFA ATTINIZ! -100 Puan"** animasyonu
- 121+ için: **"ÇİFT KAFA! -200 Puan"** animasyonu
- 5 çift: **"KAFA ATTINIZ!"**, 6 çift: **"ÇİFT KAFA!"**

**Skor Tablosu:**
- Oyun sırasında köşede **küçük** skor göstergesi
- Round bitiminde **büyük özet ekranı** — kim ne kadar aldı/sildi
- **Takım puanları** ayrıca gösterilir (eşli oyun)

### Animasyonlar ve Ses Efektleri
- Taş çekme, atma, el açma animasyonları
- Tur sonu, kafa atma, çifte gitme ses efektleri
- Taş dağıtım animasyonu (oyun başlangıcında)

### HUD Elemanları
- Sağ/sol üstte: **tur sayısı**, **zaman sayacı**, **toplam puan tablosu**
- Hızlı tepki emojileri / sohbet baloncukları
- **Timeout:** Süre bitince otomatik en kötü taşı at

---

## GELİŞTİRME AŞAMALARI (ÖNCE BUNU YAP)

Projeyi aşağıdaki sırayla geliştir. Her aşamayı tamamladıktan sonra bir sonrakine geç:

### Aşama 1 — Oyun Motoru (Game Engine)
Tüm oyun mantığını UI'dan bağımsız pure JS modülü olarak yaz:
- Taş seti oluşturma ve karıştırma
- 14'er taş dağıtma, gösterge taşı belirleme
- Kombinasyon validasyonu (seri, per, çift)
- 12-13-1 yasağı kontrolü
- Puan hesaplama (el puanı, ceza puanı, kafa atma kontrolü)
- Çifte gitme akışı mantığı
- İşlek taş tespiti
- Tur sonu kontrolü

### Aşama 2 — Görsel Masa ve Tek Oyunculu Demo
- Yeşil masa, 4 oyuncu konumu
- Taş render (Canvas üzerinde)
- Drag & drop ile el yönetimi
- Bot rakipler (basit kural tabanlı)
- Tüm 81 Okey özel aksiyonları UI'da çalışır halde

### Aşama 3 — 81 Okey Özel Mekanikleri
- Çifte gitme UI akışı (izin iste/ver/reddet)
- Çifte ilan etme ve eşik değişimi
- Kafa atma animasyonları ve ses efektleri
- Canlı puan sayacı

### Aşama 4 — Multiplayer Altyapısı
- WebSocket oda sistemi
- Oyuncu eşleştirme (matchmaking)
- Tüm event'lerin sunucu üzerinden doğrulanması

### Aşama 5 — Lobi ve Sosyal Özellikler
- Oda oluşturma / katılma
- Arkadaş listesi
- Sohbet sistemi

### Aşama 6 — Cilalama
- Animasyon polish
- Ses efektleri
- Responsive tasarım (mobil uyum)
- Performans optimizasyonu

---

## BAŞLANGIÇ GÖREVİ

**Şu anda sadece Aşama 1'i yap:**

Aşağıdaki fonksiyonları içeren, tam çalışan, yorum satırlı, Türkçe değişken ve fonksiyon isimleri ile yazılmış **`gameEngine.js`** dosyasını oluştur:

```
1. tasOlustur()              — 106 taşlık seti oluştur
2. tasKaristir(taslar)       — Fisher-Yates shuffle
3. tasDagit(oyuncular)       — Her oyuncuya 14 taş dağıt, ıstakayı oluştur
4. gostergeTasBelirle()      — Zar atarak gösterge ve okey taşını belirle
5. kombinasyonGecerliMi(taslar) — Per, seri ve çift kombinasyonu doğrula (12-13-1 yasağı dahil)
6. elPuanHesapla(kombinasyonlar) — Açılacak elin toplam puanını hesapla
7. kafaAtmaKontrol(puan, ciftSayisi) — Kafa atma durumunu tespit et (normal/kafa/çift kafa)
8. elAcmaGecerliMi(taslar, esik) — El açma eşiğini karşılıyor mu kontrol et
9. cezaPuanHesapla(oyuncu, cifte) — Istakada kalan taşlara göre cezayı hesapla
10. izinIste(isteyenOyuncu, verenOyuncu, tas) — Çifte gitme izin akışını yönet
11. cifteIlanEt(oyuncu, tumOyuncular) — Çifte ilan et, diğer oyuncuların eşiğini güncelle
12. turSonuKontrol(oyuncular, istaka) — Tur bitiş koşullarını kontrol et
13. islerTasBelirle(atilacakTas, kombinasyonlar) — İşlek taş mı değil mi?
```

Her fonksiyon için:
- JSDoc yorumları ekle
- Edge case'leri handle et
- Unit test senaryolarını yorum olarak belirt

---

## KISITLAR VE KALİTE GEREKSİNİMLERİ

- **Hiçbir kural atlanamaz** — 12-13-1 yasağı, çifte eşik güncellemesi, kafa atma puanları birebir uygulanmalı
- **Oyun motoru UI'dan tamamen bağımsız** olmalı
- **Tutarlı hata yönetimi** — her fonksiyon geçersiz girişlerde anlamlı hata fırlatmalı
- **Türkçe isimlendirme** — değişkenler, fonksiyonlar, yorumlar Türkçe
- **Modüler yapı** — her fonksiyon tek bir sorumluluğa sahip (SRP)
- **Performans** — 106 taşlık set üzerindeki tüm işlemler < 16ms içinde tamamlanmalı (60fps hedef)

---