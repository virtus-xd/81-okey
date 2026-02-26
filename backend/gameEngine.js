/**
 * 81 Okey — Oyun Motoru (Game Engine)
 * 
 * Türkiye'de özellikle Karaman bölgesinde oynanan 81 Okey oyununun
 * tüm mantığını UI'dan bağımsız olarak yöneten saf JavaScript modülü.
 * 
 * @module gameEngine
 * @version 1.0.0
 */

// ============================================================================
// SABİTLER
// ============================================================================

/** Taş renkleri */
const RENKLER = Object.freeze(['kirmizi', 'sari', 'mavi', 'siyah']);

/** Her renkten taş sayısı (1-13) */
const MAKS_SAYI = 13;

/** Her oyuncuya dağıtılacak taş sayısı */
const DAGITIM_TAS_SAYISI = 14;

/** Toplam oyuncu sayısı */
const OYUNCU_SAYISI = 4;

/** Varsayılan el açma eşiği */
const VARSAYILAN_ESIK = 81;

/** Çifte durumunda el açma eşiği */
const CIFTE_ESIK = 101;

/** Taşların gruplara ayrılacağı boyut (gösterge taşı seçimi için) */
const GRUP_BOYUTU = 7;

// ============================================================================
// YARDIMCI FONKSİYONLAR
// ============================================================================

/**
 * Bir taşın okey (joker) taşı olup olmadığını kontrol eder.
 * Gösterge taşının bir üstündeki değer okey taşıdır.
 * 
 * @param {Object} tas - Kontrol edilecek taş
 * @param {Object} okeyTasi - Okey (joker) taşının tanımı
 * @returns {boolean} Taş okey mi
 */
function okeyMi(tas, okeyTasi) {
  if (!tas) return false;
  // Hem sahte okey hem de gerçek okey (gösterge + 1) joker sayılır
  if (tas.jokerMi) return true;
  return !!okeyTasi && tas.sayi === okeyTasi.sayi && tas.renk === okeyTasi.renk;
}

/**
 * Taş değerini (puanını) döndürür.
 * 
 * @param {Object} tas - Taş objesi
 * @returns {number} Taşın puan değeri
 */
function tasDeger(tas) {
  if (!tas) return 0;
  if (tas.jokerMi) return 0; // Joker değeri bağlama göre değişir
  return tas.sayi;
}

// ============================================================================
// ANA FONKSİYONLAR
// ============================================================================

/**
 * 106 taşlık standart okey setini oluşturur.
 * 
 * Set içeriği:
 * - 4 renk × 13 sayı × 2 kopya = 104 taş
 * - 2 sahte joker (jokerMi: true)
 * Toplam: 106 taş
 * 
 * @returns {Array<Object>} 106 taş objesi dizisi
 * 
 * @example
 * const taslar = tasOlustur();
 * console.log(taslar.length); // 106
 * 
 * // Test senaryoları:
 * // 1. Toplam 106 taş döndürmeli
 * // 2. Her renkten 26 taş olmalı (13 sayı × 2 kopya)
 * // 3. 2 joker olmalı
 * // 4. Her taşın benzersiz id'si olmalı
 */
function tasOlustur() {
  const taslar = [];
  let id = 1;

  // 4 renk × 13 sayı × 2 kopya = 104 taş
  for (let kopya = 0; kopya < 2; kopya++) {
    for (const renk of RENKLER) {
      for (let sayi = 1; sayi <= MAKS_SAYI; sayi++) {
        taslar.push({
          id: id++,
          sayi,
          renk,
          jokerMi: false
        });
      }
    }
  }

  // 2 sahte joker
  taslar.push({ id: id++, sayi: 0, renk: 'joker', jokerMi: true });
  taslar.push({ id: id++, sayi: 0, renk: 'joker', jokerMi: true });

  return taslar;
}

/**
 * Taş dizisini Fisher-Yates algoritması ile karıştırır.
 * Orijinal diziyi değiştirmez, yeni bir karıştırılmış dizi döndürür.
 * 
 * @param {Array<Object>} taslar - Karıştırılacak taş dizisi
 * @returns {Array<Object>} Karıştırılmış yeni taş dizisi
 * @throws {Error} Geçersiz veya boş dizi verilirse
 * 
 * @example
 * const karisik = tasKaristir(taslar);
 * 
 * // Test senaryoları:
 * // 1. Döndürülen dizi orijinalle aynı uzunlukta olmalı
 * // 2. Orijinal dizi değişmemiş olmalı
 * // 3. Karıştırılmış dizi orijinalden farklı sırada olmalı (büyük olasılıkla)
 * // 4. Boş dizi verilirse hata fırlatmalı
 */
function tasKaristir(taslar) {
  if (!Array.isArray(taslar) || taslar.length === 0) {
    throw new Error('tasKaristir: Geçerli ve boş olmayan bir taş dizisi gerekli.');
  }

  // Orijinal diziyi kopyala
  const karisik = [...taslar];

  // Fisher-Yates shuffle
  for (let i = karisik.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [karisik[i], karisik[j]] = [karisik[j], karisik[i]];
  }

  return karisik;
}

/**
 * Taşları 4 oyuncuya 14'er adet dağıtır ve kalan taşları ıstaka olarak döndürür.
 * Taşlar dağıtılmadan önce otomatik olarak karıştırılır.
 * 
 * @param {Array<string>} oyuncular - 4 oyuncu ismi dizisi
 * @returns {Object} { eller: { [oyuncuAdi]: Array<Object> }, istaka: Array<Object> }
 * @throws {Error} Tam 4 oyuncu verilmezse
 * 
 * @example
 * const sonuc = tasDagit(['Ali', 'Veli', 'Ayşe', 'Fatma']);
 * console.log(sonuc.eller['Ali'].length); // 14
 * 
 * // Test senaryoları:
 * // 1. Her oyuncuya tam 14 taş dağıtılmalı
 * // 2. Istakada 106 - (14×4) = 50 taş kalmalı
 * // 3. Hiçbir taş tekrar etmemeli (tüm id'ler benzersiz)
 * // 4. 4'ten az/fazla oyuncuda hata fırlatmalı
 */
function tasDagit(oyuncular) {
  if (!Array.isArray(oyuncular) || oyuncular.length !== OYUNCU_SAYISI) {
    throw new Error(`tasDagit: Tam ${OYUNCU_SAYISI} oyuncu gerekli. Verilen: ${oyuncular?.length}`);
  }

  const tumTaslar = tasKaristir(tasOlustur());
  const eller = {};
  let index = 0;

  // Her oyuncuya 14 taş dağıt
  for (const oyuncu of oyuncular) {
    eller[oyuncu] = tumTaslar.slice(index, index + DAGITIM_TAS_SAYISI);
    index += DAGITIM_TAS_SAYISI;
  }

  // Kalan taşlar ıstaka
  const istaka = tumTaslar.slice(index);

  return { eller, istaka };
}

/**
 * İki aşamalı zar atarak gösterge taşını ve okey taşını belirler.
 * 
 * Mekanizma:
 * 1. Istaka taşları 7'li gruplara ayrılır
 * 2. Birinci zar → hangi gruptan çekileceğini belirler
 * 3. İkinci zar → o gruptaki hangi taş olduğunu belirler
 * 4. Gösterge taşının bir üstündeki sayı okey (joker) taşı olur
 *    (13 ise 1'e döner; aynı renk korunur)
 * 
 * @param {Array<Object>} istaka - Dağıtım sonrası kalan taşlar (ıstaka)
 * @returns {Object} { gostergeTasi: Object, okeyTasi: { sayi, renk }, birZar: number, ikiZar: number }
 * @throws {Error} Istaka boş veya geçersizse
 * 
 * @example
 * const sonuc = gostergeTasBelirle(istaka);
 * console.log(sonuc.gostergeTasi); // { id: 5, sayi: 3, renk: 'kirmizi', jokerMi: false }
 * console.log(sonuc.okeyTasi);     // { sayi: 4, renk: 'kirmizi' }
 * 
 * // Test senaryoları:
 * // 1. Gösterge taşı ıstakadaki bir taş olmalı
 * // 2. Okey taşı gösterge taşının bir üstü olmalı
 * // 3. Gösterge taşı 13 ise okey 1 olmalı (aynı renk)
 * // 4. Gösterge taşı joker ise özel durum yönetilmeli
 * // 5. Boş ıstaka ile çağrılırsa hata fırlatmalı
 */
function gostergeTasBelirle(istaka) {
  if (!Array.isArray(istaka) || istaka.length === 0) {
    throw new Error('gostergeTasBelirle: Geçerli ve boş olmayan bir ıstaka gerekli.');
  }

  // Taşları 7'li gruplara ayır
  const grupSayisi = Math.ceil(istaka.length / GRUP_BOYUTU);

  // Birinci zar: hangi grup (1-based)
  const birZar = Math.floor(Math.random() * grupSayisi) + 1;

  // Seçilen gruptaki taşlar
  const grupBaslangic = (birZar - 1) * GRUP_BOYUTU;
  const grupBitis = Math.min(grupBaslangic + GRUP_BOYUTU, istaka.length);
  const gruptakiTasSayisi = grupBitis - grupBaslangic;

  // İkinci zar: gruptaki hangi taş (1-based)
  const ikiZar = Math.floor(Math.random() * gruptakiTasSayisi) + 1;

  // Gösterge taşını belirle
  const gostergeTasi = istaka[grupBaslangic + ikiZar - 1];

  // Okey taşını hesapla (göstergenin bir üstü)
  let okeyTasi;
  if (gostergeTasi.jokerMi) {
    // Joker gösterge olduysa, okey taşı da joker olarak kalır
    // (Bu durumda sahte jokerler okey olur)
    okeyTasi = { sayi: 0, renk: 'joker', jokerMi: true };
  } else {
    const okeySayi = gostergeTasi.sayi >= MAKS_SAYI ? 1 : gostergeTasi.sayi + 1;
    okeyTasi = { sayi: okeySayi, renk: gostergeTasi.renk };
  }

  // Gösterge taşını ıstakadan çıkar (açık olarak gösterilir)
  const gostergeIndex = istaka.indexOf(gostergeTasi);
  if (gostergeIndex > -1) {
    istaka.splice(gostergeIndex, 1);
  }

  return {
    gostergeTasi,
    okeyTasi,
    birZar,
    ikiZar
  };
}

/**
 * Verilen taş grubunun geçerli bir kombinasyon (seri, per veya çift) olup olmadığını kontrol eder.
 * 
 * Kurallar:
 * - **Per:** Aynı sayıdan 3 veya 4 farklı renk taş
 * - **Seri:** Aynı renkten ardışık en az 3 taş (12-13-1 DİZİLİMİ GEÇERSİZ)
 * - **Çift:** Aynı sayı ve renkte tam 2 taş
 * - Joker (okey taşı) herhangi bir taşın yerine geçebilir
 * 
 * @param {Array<Object>} taslar - Kontrol edilecek taş grubu
 * @param {Object} [okeyTasi=null] - Okey taşı tanımı (joker olarak kullanılacak taşları belirlemek için)
 * @returns {Object} { gecerli: boolean, tip: 'seri'|'per'|'cift'|null, hata: string|null }
 * @throws {Error} Taş dizisi boş veya geçersizse
 * 
 * @example
 * // Geçerli seri
 * kombinasyonGecerliMi([{sayi:3,renk:'kirmizi'},{sayi:4,renk:'kirmizi'},{sayi:5,renk:'kirmizi'}]);
 * // { gecerli: true, tip: 'seri', hata: null }
 * 
 * // Geçersiz: 12-13-1
 * kombinasyonGecerliMi([{sayi:12,renk:'mavi'},{sayi:13,renk:'mavi'},{sayi:1,renk:'mavi'}]);
 * // { gecerli: false, tip: null, hata: '12-13-1 dizilimi geçersizdir.' }
 * 
 * // Test senaryoları:
 * // 1. Geçerli 3'lü seri → { gecerli: true, tip: 'seri' }
 * // 2. Geçerli 3'lü per → { gecerli: true, tip: 'per' }
 * // 3. 12-13-1 dizilimi → { gecerli: false }
 * // 4. Joker ile tamamlanmış seri → { gecerli: true }
 * // 5. Geçerli çift → { gecerli: true, tip: 'cift' }
 * // 6. 2 taştan az → hata
 * // 7. Aynı renk farklı sayılar ama ardışık değil → { gecerli: false }
 */
function kombinasyonGecerliMi(taslar, okeyTasi = null) {
  if (!Array.isArray(taslar) || taslar.length < 2) {
    throw new Error('kombinasyonGecerliMi: En az 2 taş gerekli.');
  }

  // Joker (wildcard) ve normal taşları ayır
  const jokerler = [];
  const normalTaslar = [];

  // Önce grubun baskın rengini bul (seri/per kontrolü için yardımcı)
  // Okey harici taşların renklerini al
  const grupNormalTaslar = taslar.filter(t => !t.jokerMi && !(okeyTasi && t.sayi === okeyTasi.sayi && t.renk === okeyTasi.renk));
  const baskinRenk = grupNormalTaslar.length > 0 ? grupNormalTaslar[0].renk : (okeyTasi ? okeyTasi.renk : 'kirmizi');

  for (const tas of taslar) {
    // Hem sahte okey hem de gerçek okey wild card (joker) olarak kabul edilir
    const isWildCard = okeyMi(tas, okeyTasi);

    if (isWildCard) {
      jokerler.push(tas);
    } else {
      // Sahte Okey (jokerMi: true), gerçek okeyin DEĞERİNİ alır.
      // Rengi ise bulunduğu grubun rengine uyum sağlar.
      if (tas.jokerMi) {
        normalTaslar.push({
          ...tas,
          sayi: okeyTasi ? okeyTasi.sayi : 0,
          renk: (grupNormalTaslar.every(t => t.renk === baskinRenk)) ? baskinRenk : (okeyTasi ? okeyTasi.renk : 'joker')
        });
      } else {
        normalTaslar.push(tas);
      }
    }
  }

  // --- ÇİFT KONTROLÜ ---
  if (taslar.length === 2) {
    // Çift: Aynı sayı ve renk, 2 taş
    if (normalTaslar.length === 2) {
      if (normalTaslar[0].sayi === normalTaslar[1].sayi &&
        normalTaslar[0].renk === normalTaslar[1].renk) {
        return { gecerli: true, tip: 'cift', hata: null };
      }
    }
    // 1 joker + 1 normal taş da geçerli çift
    if (jokerler.length === 1 && normalTaslar.length === 1) {
      return { gecerli: true, tip: 'cift', hata: null };
    }
    // 2 joker de geçerli çift
    if (jokerler.length === 2) {
      return { gecerli: true, tip: 'cift', hata: null };
    }
    // 2 taş ama çift değil, seri/per olamaz (minimum 3)
    return { gecerli: false, tip: null, hata: '2 taş sadece çift olabilir. Aynı sayı ve renk gerekli.' };
  }

  // 3+ taş: seri veya per kontrolü (çift değil)
  if (taslar.length < 3) {
    return { gecerli: false, tip: null, hata: 'Seri veya per için en az 3 taş gerekli.' };
  }

  // --- PER KONTROLÜ ---
  const perSonuc = _perKontrol(normalTaslar, jokerler);
  if (perSonuc.gecerli) return perSonuc;

  // --- SERİ KONTROLÜ ---
  const seriSonuc = _seriKontrol(normalTaslar, jokerler, taslar.length);
  if (seriSonuc.gecerli) return seriSonuc;

  return { gecerli: false, tip: null, hata: 'Geçerli bir seri, per veya çift kombinasyonu bulunamadı.' };
}

/**
 * Per (aynı sayıdan farklı renkler) kontrolü yapar.
 * @private
 */
function _perKontrol(normalTaslar, jokerler) {
  if (normalTaslar.length === 0 && jokerler.length >= 3) {
    // Hepsi joker — per olarak geçerli (3 veya 4 taş)
    return { gecerli: jokerler.length <= 4, tip: 'per', hata: null };
  }

  if (normalTaslar.length === 0) {
    return { gecerli: false, tip: null, hata: 'Per için en az bir normal taş gerekli.' };
  }

  // Tüm normal taşlar aynı sayıda olmalı
  const hedefSayi = normalTaslar[0].sayi;
  const tumAyniSayi = normalTaslar.every(t => t.sayi === hedefSayi);
  if (!tumAyniSayi) {
    return { gecerli: false, tip: null, hata: 'Per: Tüm taşlar aynı sayıda olmalı.' };
  }

  // Normal taşların renkleri farklı olmalı
  const renkler = new Set(normalTaslar.map(t => t.renk));
  if (renkler.size !== normalTaslar.length) {
    return { gecerli: false, tip: null, hata: 'Per: Tüm renkler farklı olmalı.' };
  }

  // Toplam taş sayısı 3 veya 4 olmalı
  const toplamTas = normalTaslar.length + jokerler.length;
  if (toplamTas < 3 || toplamTas > 4) {
    return { gecerli: false, tip: null, hata: 'Per: 3 veya 4 taştan oluşmalı.' };
  }

  // Joker ile birlikte toplam farklı renk sayısı 4'ü geçmemeli
  if (renkler.size + jokerler.length > 4) {
    return { gecerli: false, tip: null, hata: 'Per: En fazla 4 farklı renk olabilir.' };
  }

  return { gecerli: true, tip: 'per', hata: null };
}

/**
 * Seri (aynı renk ardışık sayılar) kontrolü yapar. 12-13-1 yasağı uygulanır.
 * @private
 */
function _seriKontrol(normalTaslar, jokerler, toplamTas) {
  if (normalTaslar.length === 0 && jokerler.length >= 3) {
    // Hepsi joker — seri olarak geçerli
    return { gecerli: true, tip: 'seri', hata: null };
  }

  if (normalTaslar.length === 0) {
    return { gecerli: false, tip: null, hata: 'Seri için en az bir normal taş gerekli.' };
  }

  // Tüm normal taşlar aynı renkte olmalı
  const hedefRenk = normalTaslar[0].renk;
  const tumAyniRenk = normalTaslar.every(t => t.renk === hedefRenk);
  if (!tumAyniRenk) {
    return { gecerli: false, tip: null, hata: 'Seri: Tüm taşlar aynı renkte olmalı.' };
  }

  // Sayılara göre sırala
  const siraliSayilar = normalTaslar.map(t => t.sayi).sort((a, b) => a - b);

  // Tekrar eden sayı kontrolü (aynı renk aynı sayı seri olamaz)
  for (let i = 1; i < siraliSayilar.length; i++) {
    if (siraliSayilar[i] === siraliSayilar[i - 1]) {
      return { gecerli: false, tip: null, hata: 'Seri: Aynı sayı tekrar edemez.' };
    }
  }

  // Jokerlerle boşlukları doldurmaya çalış
  let kalanJoker = jokerler.length;
  let toplam = normalTaslar.length;

  for (let i = 1; i < siraliSayilar.length; i++) {
    const fark = siraliSayilar[i] - siraliSayilar[i - 1] - 1;
    if (fark > 0) {
      // Arada boşluk var, jokerle doldur
      if (fark > kalanJoker) {
        return { gecerli: false, tip: null, hata: 'Seri: Ardışık sayılar arasındaki boşluk jokerlerle doldurulamadı.' };
      }
      kalanJoker -= fark;
      toplam += fark;
    }
  }

  // Kalan jokerler serinin başına veya sonuna eklenebilir
  // En düşük sayıdan önce ve en yüksek sayıdan sonra ekleme
  const enDusuk = siraliSayilar[0];
  const enYuksek = siraliSayilar[siraliSayilar.length - 1];

  // Başa eklenebilecek joker sayısı (1'in altına inemez)
  const basaEklenebilir = enDusuk - 1;
  // Sona eklenebilecek joker sayısı (13'ün üstüne çıkamaz)
  const sonaEklenebilir = MAKS_SAYI - enYuksek;

  // Kalan jokerleri başa veya sona ekle
  const basaEklenen = Math.min(kalanJoker, basaEklenebilir);
  kalanJoker -= basaEklenen;
  toplam += basaEklenen;

  const sonaEklenen = Math.min(kalanJoker, sonaEklenebilir);
  kalanJoker -= sonaEklenen;
  toplam += sonaEklenen;

  // Gerçek kullanılan taş sayısı eşleşmeli
  if (toplam !== toplamTas - kalanJoker) {
    // Kalan joker varsa yerleştirilememiş demektir
  }

  // Toplam taş sayısı kontrol
  if (toplamTas < 3) {
    return { gecerli: false, tip: null, hata: 'Seri: En az 3 taş gerekli.' };
  }

  // 12-13-1 yasağı: Serinin muhtemel aralığını hesaplayalım
  const seriBaslangic = enDusuk - basaEklenen;
  const seriBitis = enYuksek + sonaEklenen;

  // Yeni hesaplanan aralıktaki boşlukları kontrol et
  // Seri 13'ü geçip 1'e dönebilir mi? HAYIR — 12-13-1 YASAK
  if (seriBitis > MAKS_SAYI) {
    return { gecerli: false, tip: null, hata: '12-13-1 dizilimi geçersizdir.' };
  }
  if (seriBaslangic < 1) {
    return { gecerli: false, tip: null, hata: 'Seri 1\'in altına inemez.' };
  }

  // Arada 12-13-1 geçişi var mı kontrol et (jokerle tamamlanmış olabilir)
  // Bu zaten yukarıda seriBitis > 13 kontrolüyle engellenmiş oluyor

  // Kontrol: Toplam kullanılan taş sayısı verilen toplam taş sayısına eşit mi
  const kullanilanJoker = jokerler.length - kalanJoker;
  if (normalTaslar.length + kullanilanJoker !== toplamTas) {
    // Bazı jokerler kullanılmadıysa, seri geçersiz olabilir
    if (kalanJoker > 0) {
      return { gecerli: false, tip: null, hata: 'Seri: Tüm taşlar seriye sığmadı.' };
    }
  }

  return { gecerli: true, tip: 'seri', hata: null };
}

/**
 * Açılacak elin toplam puanını hesaplar.
 * 
 * Her kombinasyondaki taşların sayı değerleri toplanır.
 * Joker, yerine geçtiği taşın değerini alır (bu fonksiyona gelen kombinasyonlarda
 * joker değeri çağıran tarafından ayarlanmış olmalıdır).
 * 
 * @param {Array<Array<Object>>} kombinasyonlar - Kombinasyon dizilerinin dizisi
 * @returns {number} Toplam puan
 * @throws {Error} Kombinasyon dizisi geçersizse
 * 
 * @example
 * const puan = elPuanHesapla([
 *   [{sayi:3,renk:'kirmizi'},{sayi:4,renk:'kirmizi'},{sayi:5,renk:'kirmizi'}],
 *   [{sayi:7,renk:'mavi'},{sayi:7,renk:'sari'},{sayi:7,renk:'kirmizi'}]
 * ]);
 * console.log(puan); // (3+4+5) + (7+7+7) = 33
 * 
 * // Test senaryoları:
 * // 1. Tek seri → doğru toplam
 * // 2. Birden fazla kombinasyon → toplam doğru
 * // 3. Boş dizi → 0
 * // 4. Geçersiz giriş → hata
 */
function elPuanHesapla(kombinasyonlar) {
  if (!Array.isArray(kombinasyonlar)) {
    throw new Error('elPuanHesapla: Geçerli bir kombinasyon dizisi gerekli.');
  }

  let toplamPuan = 0;

  for (const kombinasyon of kombinasyonlar) {
    if (!Array.isArray(kombinasyon)) {
      throw new Error('elPuanHesapla: Her kombinasyon bir dizi olmalı.');
    }

    for (const tas of kombinasyon) {
      if (tas.jokerMi) {
        // Joker, seri içinde yerine geçtiği taşın puanını alır
        // Joker değeri çağıran tarafından atanmamışsa, 0 olarak sayılır
        // Ancak daha iyi bir yaklaşım: kombinasyon bağlamında hesapla
        toplamPuan += tas.jokerdegeri || tas.sayi || 0;
      } else {
        toplamPuan += tas.sayi;
      }
    }
  }

  return toplamPuan;
}

/**
 * Kafa atma durumunu kontrol eder.
 * 
 * Seri kombinasyonla açış:
 * - 81–100 puan → Normal açış
 * - 101–120 puan → Kafa atma (-100 puan silinir)
 * - 121+ puan → Çift kafa atma (-200 puan silinir)
 * 
 * Çift açmayla açış:
 * - 4 çift → Normal açış
 * - 5 çift → Kafa atma (-100 puan silinir)
 * - 6 çift → Çift kafa atma (-200 puan silinir)
 * 
 * @param {number} puan - Seri/per ile açılan toplam puan (çift açmada kullanılmaz)
 * @param {number} [ciftSayisi=0] - Çift açma ile açılan çift sayısı
 * @returns {Object} { durum: 'normal'|'kafa'|'ciftKafa', bonus: number }
 * 
 * @example
 * kafaAtmaKontrol(85);    // { durum: 'normal', bonus: 0 }
 * kafaAtmaKontrol(110);   // { durum: 'kafa', bonus: -100 }
 * kafaAtmaKontrol(130);   // { durum: 'ciftKafa', bonus: -200 }
 * kafaAtmaKontrol(0, 5);  // { durum: 'kafa', bonus: -100 }
 * kafaAtmaKontrol(0, 6);  // { durum: 'ciftKafa', bonus: -200 }
 * 
 * // Test senaryoları:
 * // 1. 81 puan → normal
 * // 2. 100 puan → normal
 * // 3. 101 puan → kafa
 * // 4. 120 puan → kafa
 * // 5. 121 puan → çift kafa
 * // 6. 4 çift → normal
 * // 7. 5 çift → kafa
 * // 8. 6 çift → çift kafa
 */
function kafaAtmaKontrol(puan, ciftSayisi = 0) {
  // Çift açma kontrolü (öncelik çiftte)
  if (ciftSayisi >= 6) {
    return { durum: 'ciftKafa', bonus: -200 };
  }
  if (ciftSayisi >= 5) {
    return { durum: 'kafa', bonus: -100 };
  }
  if (ciftSayisi >= 4) {
    return { durum: 'normal', bonus: 0 };
  }

  // Seri/per kombinasyonla açış kontrolü
  if (puan >= 121) {
    return { durum: 'ciftKafa', bonus: -200 };
  }
  if (puan >= 101) {
    return { durum: 'kafa', bonus: -100 };
  }

  return { durum: 'normal', bonus: 0 };
}

/**
 * Oyuncunun elindeki taşlar ve kombinasyonlarıyla el açma eşiğini karşılayıp karşılamadığını kontrol eder.
 * 
 * İki yöntemle el açılabilir:
 * 1. Seri/per kombinasyonlarla minimum eşik puanı toplamak
 * 2. Minimum 4 çift toplamak
 * 
 * @param {Array<Array<Object>>} kombinasyonlar - Açılacak kombinasyonlar
 * @param {number} [esik=81] - El açma puan eşiği (81 veya 101)
 * @param {Object} [okeyTasi=null] - Okey taşı tanımı
 * @returns {Object} { gecerli: boolean, yontem: 'seri'|'cift'|null, puan: number, ciftSayisi: number, hata: string|null }
 * @throws {Error} Kombinasyon dizisi geçersizse
 * 
 * @example
 * // Seri ile açma
 * elAcmaGecerliMi([[{sayi:10,renk:'k'},{sayi:11,renk:'k'},{sayi:12,renk:'k'},{sayi:13,renk:'k'}]], 81);
 * // { gecerli: true, yontem: 'seri', puan: 46, ... }
 * 
 * // Test senaryoları:
 * // 1. 81 puanlık seri → geçerli
 * // 2. 80 puanlık seri → geçersiz
 * // 3. 4 çift → geçerli
 * // 4. 3 çift → geçersiz
 * // 5. 101 eşiğinde 90 puan → geçersiz
 * // 6. Boş kombinasyon → geçersiz
 */
function elAcmaGecerliMi(kombinasyonlar, esik = VARSAYILAN_ESIK, okeyTasi = null) {
  if (!Array.isArray(kombinasyonlar) || kombinasyonlar.length === 0) {
    return { gecerli: false, yontem: null, puan: 0, ciftSayisi: 0, hata: 'Açılacak kombinasyon yok.' };
  }

  // Her kombinasyonun geçerli olup olmadığını kontrol et
  let toplamPuan = 0;
  let ciftSayisi = 0;
  let seriPerVar = false;

  for (const komb of kombinasyonlar) {
    const sonuc = kombinasyonGecerliMi(komb, okeyTasi);
    if (!sonuc.gecerli) {
      return { gecerli: false, yontem: null, puan: 0, ciftSayisi: 0, hata: `Geçersiz kombinasyon: ${sonuc.hata}` };
    }

    if (sonuc.tip === 'cift') {
      ciftSayisi++;
    } else {
      seriPerVar = true;
      // Kombinasyonun puanını hesapla
      let kombPuani = 0;
      for (const tas of komb) {
        kombPuani += tas.jokerMi ? (tas.jokerdegeri || 0) : tas.sayi;
      }
      toplamPuan += kombPuani;
    }
  }

  // Yöntem 1: Çift açma (min 4 çift)
  if (ciftSayisi >= 4 && !seriPerVar) {
    return {
      gecerli: true,
      yontem: 'cift',
      puan: 0,
      ciftSayisi,
      hata: null
    };
  }

  // Yöntem 2: Seri/per ile açma (eşik kontrolü)
  if (seriPerVar) {
    if (toplamPuan >= esik) {
      return {
        gecerli: true,
        yontem: 'seri',
        puan: toplamPuan,
        ciftSayisi,
        hata: null
      };
    } else {
      return {
        gecerli: false,
        yontem: null,
        puan: toplamPuan,
        ciftSayisi,
        hata: `Puan eşiği karşılanmadı. Gereken: ${esik}, Mevcut: ${toplamPuan}`
      };
    }
  }

  // Çift var ama 4'ten az
  if (ciftSayisi > 0) {
    return {
      gecerli: false,
      yontem: null,
      puan: toplamPuan,
      ciftSayisi,
      hata: `Çift ile açmak için en az 4 çift gerekli. Mevcut: ${ciftSayisi}`
    };
  }

  return { gecerli: false, yontem: null, puan: 0, ciftSayisi: 0, hata: 'Açılacak geçerli kombinasyon bulunamadı.' };
}

/**
 * Oyuncunun ıstakada (elinde açmadığı) kalan taşlarına göre ceza puanını hesaplar.
 * 
 * Kurallar:
 * - Elini açamayan oyuncu → +100 ceza
 * - Elini açamayan + rakibe izin vermeyen → +200 ceza
 * - Elini açan → Istakada kalan taşların toplam değeri kadar ceza
 * - Çifte giden + elini açan → kalan taşların iki katı ceza
 * 
 * @param {Object} oyuncu - Oyuncu durumu
 * @param {Array<Object>} oyuncu.kalanTaslar - Elde kalan taşlar
 * @param {boolean} oyuncu.elAcildi - El açıldı mı
 * @param {boolean} oyuncu.izinVermedi - Rakibe izin vermedi mi
 * @param {boolean} [cifte=false] - Çifte gidildi mi
 * @returns {Object} { ceza: number, aciklama: string }
 * 
 * @example
 * cezaPuanHesapla({ kalanTaslar: [], elAcildi: true, izinVermedi: false }); 
 * // { ceza: 0, aciklama: 'El tamamen açıldı.' }
 * 
 * cezaPuanHesapla({ kalanTaslar: [{sayi:5},{sayi:8}], elAcildi: true, izinVermedi: false });
 * // { ceza: 13, aciklama: 'Kalan taşların değeri: 13' }
 * 
 * // Test senaryoları:
 * // 1. El açılmadı → 100 ceza
 * // 2. El açılmadı + izin vermedi → 200 ceza
 * // 3. El açıldı, kalan taşlar → toplam değer kadar ceza
 * // 4. El açıldı, taş kalmadı → 0 ceza
 * // 5. Çifte gidildi + kalan taşlar → 2× ceza
 */
/**
 * Bir oyuncunun elindeki ceza puanlarını hesaplar.
 * 
 * @param {Object} oyuncu - Oyuncu objesi
 * @param {boolean} [cifte=false] - Çifte gidildi mi
 * @param {Object} [okeyTasi=null] - Okey taşı tanımı
 * @returns {Object} { ceza: number, aciklama: string }
 */
function cezaPuanHesapla(oyuncu, cifte = false, okeyTasi = null) {
  if (!oyuncu || typeof oyuncu !== 'object') {
    throw new Error('cezaPuanHesapla: Geçerli bir oyuncu objesi gerekli.');
  }

  // El açılmadı
  if (!oyuncu.elAcildi) {
    if (oyuncu.izinVermedi) {
      return { ceza: 200, aciklama: 'El açılmadı ve rakibe izin verilmedi: +200 ceza' };
    }
    return { ceza: 100, aciklama: 'El açılamadı: +100 ceza' };
  }

  // El açıldı — kalan taşların değerini hesapla
  const kalanTaslar = oyuncu.kalanTaslar || oyuncu.el || [];
  if (kalanTaslar.length === 0) {
    return { ceza: 0, aciklama: 'El tamamen açıldı, kalan taş yok.' };
  }

  let toplamDeger = 0;
  for (const tas of kalanTaslar) {
    // SADECE Gerçek Okey (wildcard) 0 sayılır.
    // Sahte Okey (Joker), okeyin değerini alır.
    if (okeyMi(tas, okeyTasi)) {
      toplamDeger += 0;
    } else if (tas.jokerMi) {
      toplamDeger += (okeyTasi ? okeyTasi.sayi : 0);
    } else {
      toplamDeger += tas.sayi;
    }
  }

  // Çifte durumunda iki kat ceza
  if (cifte) {
    const ceza = toplamDeger * 2;
    return { ceza, aciklama: `Çifte gidildi, kalan taşların 2× değeri: +${ceza} ceza` };
  }

  // Izin vermedi ve el açıldı → 2× ceza
  if (oyuncu.izinVermedi) {
    const ceza = toplamDeger * 2;
    return { ceza, aciklama: `El açıldı ama rakibe izin verilmedi, kalan taşların 2× değeri: +${ceza} ceza` };
  }

  return { ceza: toplamDeger, aciklama: `Kalan taşların değeri: +${toplamDeger} ceza` };
}

/**
 * Çifte gitme akışını yönetir. Bir oyuncu rakibinin attığı taşı almak istediğinde
 * önce rakipten izin ister.
 * 
 * Akış:
 * 1. İsteyenOyuncu → verenOyuncu'dan izin ister
 * 2. verenOyuncu izin verirse → taş alınır
 * 3. verenOyuncu reddederse → taş alınamaz, verenOyuncu "çifte geçmiş" sayılır
 * 
 * @param {Object} isteyenOyuncu - Taşı almak isteyen oyuncu
 * @param {Object} verenOyuncu - Taşı atan oyuncu (izin verecek/reddedecek)
 * @param {Object} tas - İstenen taş
 * @param {boolean} izinVerildi - İzin verildi mi
 * @returns {Object} { basarili: boolean, cifteGecti: string|null, mesaj: string }
 * 
 * @example
 * // İzin verildi
 * izinIste(oyuncu1, oyuncu2, tas, true);
 * // { basarili: true, cifteGecti: null, mesaj: 'Taş alındı.' }
 * 
 * // İzin reddedildi
 * izinIste(oyuncu1, oyuncu2, tas, false);
 * // { basarili: false, cifteGecti: 'oyuncu2', mesaj: 'İzin reddedildi. oyuncu2 çifte geçti.' }
 * 
 * // Test senaryoları:
 * // 1. İzin verildi → taş alınır
 * // 2. İzin reddedildi → çifte geçilir
 * // 3. Geçersiz oyuncu → hata
 * // 4. Geçersiz taş → hata
 */
function izinIste(isteyenOyuncu, verenOyuncu, tas, izinVerildi) {
  if (!isteyenOyuncu || !isteyenOyuncu.isim) {
    throw new Error('izinIste: Geçerli bir isteyen oyuncu gerekli (isim alanı zorunlu).');
  }
  if (!verenOyuncu || !verenOyuncu.isim) {
    throw new Error('izinIste: Geçerli bir veren oyuncu gerekli (isim alanı zorunlu).');
  }
  if (!tas) {
    throw new Error('izinIste: Geçerli bir taş objesi gerekli.');
  }

  if (izinVerildi) {
    return {
      basarili: true,
      cifteGecti: null,
      mesaj: `${isteyenOyuncu.isim} taşı aldı.`
    };
  } else {
    // İzin reddedildi — veren oyuncu çifte geçmiş sayılır
    verenOyuncu.cifteGectiMi = true;
    return {
      basarili: false,
      cifteGecti: verenOyuncu.isim,
      mesaj: `İzin reddedildi. ${verenOyuncu.isim} çifte geçti — ceza puanları iki katına çıkar.`
    };
  }
}

/**
 * Bir oyuncu "Çifte Gidiyorum" ilan eder.
 * Bu durumda diğer tüm oyuncuların seri/per ile açma eşiği 101'e yükselir.
 * 
 * @param {Object} oyuncu - Çifte ilan eden oyuncu
 * @param {Array<Object>} tumOyuncular - Tüm oyuncular
 * @returns {Object} { basarili: boolean, mesaj: string, guncellenenOyuncular: Array<string> }
 * @throws {Error} Geçersiz oyuncu veya oyuncu listesi
 * 
 * @example
 * const sonuc = cifteIlanEt(
 *   { isim: 'Ali', cifteIlanEtti: false },
 *   [{ isim: 'Ali' }, { isim: 'Veli' }, { isim: 'Ayşe' }, { isim: 'Fatma' }]
 * );
 * // Diğer oyuncuların eşiği 101'e yükselir
 * 
 * // Test senaryoları:
 * // 1. İlan sonrası diğer oyuncuların eşiği 101 olmalı
 * // 2. İlan eden oyuncunun cifteIlanEtti true olmalı
 * // 3. Zaten ilan etmiş oyuncu tekrar ilan edemez
 * // 4. Geçersiz oyuncu → hata
 */
function cifteIlanEt(oyuncu, tumOyuncular) {
  if (!oyuncu || !oyuncu.isim) {
    throw new Error('cifteIlanEt: Geçerli bir oyuncu gerekli (isim alanı zorunlu).');
  }
  if (!Array.isArray(tumOyuncular) || tumOyuncular.length !== OYUNCU_SAYISI) {
    throw new Error(`cifteIlanEt: Tam ${OYUNCU_SAYISI} oyuncu gerekli.`);
  }

  if (oyuncu.cifteIlanEtti) {
    return {
      basarili: false,
      mesaj: `${oyuncu.isim} zaten çifte ilan etmiş.`,
      guncellenenOyuncular: []
    };
  }

  oyuncu.cifteIlanEtti = true;
  const guncellenenler = [];

  for (const o of tumOyuncular) {
    if (o.isim !== oyuncu.isim) {
      o.elAcmaEsigi = CIFTE_ESIK;
      guncellenenler.push(o.isim);
    }
  }

  return {
    basarili: true,
    mesaj: `${oyuncu.isim} çifte ilan etti! Diğer oyuncuların açma eşiği ${CIFTE_ESIK}'e yükseldi.`,
    guncellenenOyuncular: guncellenenler
  };
}

/**
 * Tur sonu koşullarını kontrol eder.
 * 
 * Tur şu durumlarda sona erer:
 * 1. Istakadaki kapalı taş yığını tamamen bittiyse
 * 2. Bir oyuncu elindeki tüm taşları yere açtıysa (el bitirme)
 * 
 * @param {Array<Object>} oyuncular - Tüm oyuncular (her birinde kalanTaslar alanı)
 * @param {Array<Object>} istaka - Kalan kapalı taşlar
 * @returns {Object} { bitti: boolean, sebep: string|null, kazanan: string|null }
 * 
 * @example
 * turSonuKontrol(
 *   [{ isim: 'Ali', kalanTaslar: [] }, ...],
 *   [{ sayi: 5 }]
 * );
 * // { bitti: true, sebep: 'Ali tüm taşlarını açtı.', kazanan: 'Ali' }
 * 
 * // Test senaryoları:
 * // 1. Istaka bitti → tur biter
 * // 2. Oyuncu el bitirdi → tur biter
 * // 3. Hem ıstaka var hem el devam → tur bitmez
 * // 4. Geçersiz oyuncu listesi → hata
 */
function turSonuKontrol(oyuncular, istaka) {
  if (!Array.isArray(oyuncular) || oyuncular.length === 0) {
    throw new Error('turSonuKontrol: Geçerli bir oyuncu listesi gerekli.');
  }

  // Kontrol 1: Bir oyuncu tüm taşlarını açtı mı?
  for (const oyuncu of oyuncular) {
    if (oyuncu.kalanTaslar && oyuncu.kalanTaslar.length === 0 && oyuncu.elAcildi) {
      return {
        bitti: true,
        sebep: `${oyuncu.isim} tüm taşlarını açtı — el bitirildi!`,
        kazanan: oyuncu.isim
      };
    }
  }

  // Kontrol 2: Istaka bitti mi?
  if (!Array.isArray(istaka) || istaka.length === 0) {
    return {
      bitti: true,
      sebep: 'Istakadaki taşlar tükendi.',
      kazanan: null
    };
  }

  return {
    bitti: false,
    sebep: null,
    kazanan: null
  };
}

/**
 * Atılacak taşın "işlek taş" olup olmadığını belirler.
 * 
 * İşlek taş: Mevcut kombinasyonlarda kullanılabilecek, yüksek değerli/kritik bir taş.
 * Bir taş, oyuncunun mevcut kombinasyonlarından birine eklenebiliyorsa "işlek" sayılır.
 * 
 * Kontroller:
 * - Taş mevcut bir seriye eklenebilir mi? (başa veya sona)
 * - Taş mevcut bir peri tamamlayabilir mi? (3'lüyü 4'lüye)
 * - Taş ile yeni bir per oluşturulabilir mi? (mevcut taşlarla birlikte)
 * 
 * @param {Object} atilacakTas - Kontrol edilecek taş
 * @param {Array<Array<Object>>} kombinasyonlar - Masadaki açılmış kombinasyonlar
 * @returns {Object} { islekMi: boolean, sebep: string|null }
 * @throws {Error} Geçersiz taş veya kombinasyon
 * 
 * @example
 * // Mevcut seri: [3,4,5] kırmızı → 6 kırmızı işlek
 * islerTasBelirle(
 *   { sayi: 6, renk: 'kirmizi' },
 *   [[{sayi:3,renk:'kirmizi'},{sayi:4,renk:'kirmizi'},{sayi:5,renk:'kirmizi'}]]
 * );
 * // { islekMi: true, sebep: 'Mevcut seriye eklenebilir.' }
 * 
 * // Test senaryoları:
 * // 1. Serinin ucuna eklenebilecek taş → işlek
 * // 2. 3'lü peri tamamlayan taş → işlek
 * // 3. Hiçbir kombinasyona uymayan taş → işlek değil
 * // 4. Joker → işlek değil (her zaman kullanılabilir)
 */
/**
 * Bir taşın "işlek" (herhangi bir açılmış kombinasyona uyuyor) olup olmadığını belirler.
 * 
 * @param {Object} atilacakTas - Kontrol edilen taş
 * @param {Array<Array>} kombinasyonlar - Masadaki tüm açılmış kombinasyonlar
 * @param {Object} [okeyTasi=null] - Okey taşı tanımı
 * @returns {Object} { islekMi: boolean, sebep: string|null }
 */
function islerTasBelirle(atilacakTas, kombinasyonlar, okeyTasi = null) {
  if (!atilacakTas) {
    throw new Error('islerTasBelirle: Geçerli bir taş objesi gerekli.');
  }
  if (!Array.isArray(kombinasyonlar)) {
    throw new Error('islerTasBelirle: Geçerli bir kombinasyon dizisi gerekli.');
  }

  // SADECE Gerçek Okey (wildcard) her zaman işlektir.
  if (okeyMi(atilacakTas, okeyTasi)) {
    return { islekMi: true, sebep: 'Okey (wildcard) taşı her zaman işlektir.' };
  }

  for (const kombinasyon of kombinasyonlar) {
    if (!Array.isArray(kombinasyon) || kombinasyon.length === 0) continue;

    // canAddTileToMeld zaten seri/per tip kontrolü yapıyor — false positive olmaz
    const sonuc = canAddTileToMeld(atilacakTas, kombinasyon, okeyTasi);
    if (sonuc.gecerli) {
      return { islekMi: true, sebep: sonuc.sebep };
    }
  }

  return { islekMi: false, sebep: null };
}


/**
 * Bir taşın mevcut bir açılmış kombinasyona işlenip işlenemeyeceğini kontrol eder.
 * İşleme = masadaki bir seriye/pere uygun taş ekleme.
 * 
 * @param {Object} tas - İşlenecek taş
 * @param {Array<Object>} kombinasyon - Masadaki mevcut kombinasyon
 * @param {Object} [okeyTasi=null] - Okey taşı tanımı
 * @returns {Object} { islenebilir: boolean, yeniKombinasyon: Array|null, sebep: string }
 */
function tasIslenebilirMi(tas, kombinasyon, okeyTasi = null) {
  if (!tas || !Array.isArray(kombinasyon) || kombinasyon.length < 2) {
    return { islenebilir: false, yeniKombinasyon: null, sebep: 'Geçersiz giriş.' };
  }

  // Joker/okey taşı her zaman işlenebilir (taş işleme için değil, kontrol amaçlı)
  if (tas.jokerMi) {
    return { islenebilir: false, yeniKombinasyon: null, sebep: 'Joker taş işlenemez, zaten kullanılabilir.' };
  }

  // Joker (wildcard) olmayan taşları ayır
  const normalTaslar = kombinasyon.filter(t => !okeyMi(t, okeyTasi)).map(t => {
    if (t.jokerMi) return { ...t, sayi: okeyTasi.sayi, renk: okeyTasi.renk };
    return t;
  });

  if (normalTaslar.length === 0) {
    return { islenebilir: false, yeniKombinasyon: null, sebep: 'Kombinasyon sadece okeylerden oluşuyor.' };
  }

  // --- SERİYE EKLEME ---
  // Tüm normal taşlar aynı renkte mi? (seri potansiyeli)
  const ilkRenk = normalTaslar[0].renk;
  const tumAyniRenk = normalTaslar.every(t => t.renk === ilkRenk);

  if (tumAyniRenk && tas.renk === ilkRenk) {
    // Serinin gerçek sınırlarını (wildcard'lar dahil) hesapla
    let wildHead = 0;
    for (const r of kombinasyon) {
      if (okeyMi(r, okeyTasi)) wildHead++; else break;
    }
    let wildTail = 0;
    for (let i = kombinasyon.length - 1; i >= 0; i--) {
      if (okeyMi(kombinasyon[i], okeyTasi)) wildTail++; else break;
    }

    const sayilar = normalTaslar.map(t => t.sayi).sort((a, b) => a - b);
    const enDusuk = sayilar[0];
    const enYuksek = sayilar[sayilar.length - 1];

    const realStart = enDusuk - wildHead;
    const realEnd = enYuksek + wildTail;

    // Serinin başına eklenebilir mi?
    if (tas.sayi === realStart - 1 && tas.sayi >= 1) {
      const yeniKomb = [tas, ...kombinasyon];
      return { islenebilir: true, yeniKombinasyon: yeniKomb, sebep: 'Serinin başına eklendi.' };
    }

    // Serinin sonuna eklenebilir mi?
    if (tas.sayi === realEnd + 1 && tas.sayi <= MAKS_SAYI) {
      const yeniKomb = [...kombinasyon, tas];
      return { islenebilir: true, yeniKombinasyon: yeniKomb, sebep: 'Serinin sonuna eklendi.' };
    }
  }

  // --- PERE EKLEME (3'lü → 4'lü) ---
  if (kombinasyon.length === 3) {
    const ilkSayi = normalTaslar[0].sayi;
    const tumAyniSayi = normalTaslar.every(t => t.sayi === ilkSayi);
    const renkler = new Set(normalTaslar.map(t => t.renk));

    if (tumAyniSayi && tas.sayi === ilkSayi && !renkler.has(tas.renk) && renkler.size === normalTaslar.length) {
      const yeniKomb = [...kombinasyon, tas];
      return { islenebilir: true, yeniKombinasyon: yeniKomb, sebep: 'Per 4\'lüye tamamlandı.' };
    }
  }

  return { islenebilir: false, yeniKombinasyon: null, sebep: 'Bu taş bu kombinasyona eklenemez.' };
}

/**
 * Çift açıcıya çift (2 taş) işlenip işlenemeyeceğini kontrol eder.
 * @param {Object} tas1 - Birinci taş
 * @param {Object} tas2 - İkinci taş
 * @param {Array} mevcutKombs - Hedef oyuncunun mevcut acilmisKombs listesi (çiftler)
 * @returns {{ islenebilir: boolean, yeniKombs: Array|null, sebep: string }}
 */
function ciftIslenebilirMi(tas1, tas2, mevcutKombs) {
  if (!tas1 || !tas2) {
    return { islenebilir: false, yeniKombs: null, sebep: 'İki taş gerekli.' };
  }
  if (tas1.jokerMi || tas2.jokerMi) {
    return { islenebilir: false, yeniKombs: null, sebep: 'Joker taş çift olarak işlenemez.' };
  }
  if (tas1.id === tas2.id) {
    return { islenebilir: false, yeniKombs: null, sebep: 'Aynı taş iki kez seçilemez.' };
  }
  // Çift olabilmesi için: aynı sayı + aynı renk
  if (tas1.sayi !== tas2.sayi || tas1.renk !== tas2.renk) {
    return { islenebilir: false, yeniKombs: null, sebep: 'Çift için aynı sayı ve aynı renk gerekli.' };
  }
  // Başarılı: yeni çift kombinasyon olarak ekle
  const yeniKombs = [...(mevcutKombs || []), [tas1, tas2]];
  return { islenebilir: true, yeniKombs, sebep: 'Çift işlendi.' };
}

/**
 * 28 slotluk raf düzenindeki geçerli perlerin toplam puanını hesaplar.
 * @param {Array} slotlar - 28 elemanlı dizi (taş veya null)
 * @param {Object} okeyTasi - Okey taşı tanımı
 * @returns {number} Toplam per puanı
 */
/**
 * 28 slotluk raftaki taşları, boşluklara (null) göre gruplara ayırır.
 * Satır bazlı (14+14) çalışır.
 * 
 * @param {Array} slotlar - 28 elemanlı raf dizisi
 * @returns {Array<Array>} Taş grupları listesi
 */
function slotlariGrupla(slotlar) {
  if (!Array.isArray(slotlar)) return [];

  const gruplar = [];
  let mevcutGrup = [];

  // Satır bazlı (14+14) grupları bul
  const satirlar = [slotlar.slice(0, 14), slotlar.slice(14, 28)];

  satirlar.forEach(satir => {
    satir.forEach(slot => {
      if (slot) {
        mevcutGrup.push(slot);
      } else {
        if (mevcutGrup.length > 0) gruplar.push([...mevcutGrup]);
        mevcutGrup = [];
      }
    });
    if (mevcutGrup.length > 0) gruplar.push([...mevcutGrup]);
    mevcutGrup = [];
  });

  return gruplar;
}

/**
 * Bir oyuncunun el açıp açamayacağını, fiziksel ıstaka dizilimine göre kontrol eder.
 * 
 * @param {Array} slotlar - 28 elemanlı raf dizisi
 * @param {Object} okeyTasi - Okey taşı
 * @param {number} esik - El açma eşiği (puan)
 * @param {boolean} [alreadyOpened=false] - Daha önce el açıldı mı?
 * @param {string} [forcedMethod=null] - İlk açıştaki yöntem ('seri' veya 'cift')
 * @returns {Object|null} { yontem, kombinasyonlar, puan } veya null
 */
function elAcmaKontrol(slotlar, okeyTasi, esik, alreadyOpened = false, forcedMethod = null) {
  const gruplar = slotlariGrupla(slotlar);
  const gecerliKombs = [];
  let toplamPuan = 0;

  // 1. Seri/Per Kontrolü
  if (!alreadyOpened || forcedMethod === 'seri') {
    for (const grup of gruplar) {
      if (grup.length >= 3) {
        const sonuc = kombinasyonGecerliMi(grup, okeyTasi);
        if (sonuc.gecerli && (sonuc.tip === 'seri' || sonuc.tip === 'per')) {
          gecerliKombs.push(grup);
          const islenenGrup = _grupJokerleriniDoldur(grup, okeyTasi, sonuc.tip);
          // Puan hesapla
          toplamPuan += islenenGrup.reduce((t, s) => t + (s.jokerdegeri !== undefined ? s.jokerdegeri : (okeyMi(s, okeyTasi) ? 0 : s.sayi)), 0);
        }
      }
    }

    // Eğer zaten açıksa, threshold kontrolüne gerek yok (en az bir geçerli grup yeterli)
    if (alreadyOpened && forcedMethod === 'seri' && gecerliKombs.length > 0) {
      return {
        yontem: 'seri',
        kombinasyonlar: gecerliKombs,
        puan: toplamPuan
      };
    }

    if (!alreadyOpened && toplamPuan >= esik && gecerliKombs.length > 0) {
      return {
        yontem: 'seri',
        kombinasyonlar: gecerliKombs,
        puan: toplamPuan
      };
    }
  }

  // 2. Çift Kontrolü
  if (!alreadyOpened || forcedMethod === 'cift') {
    const ciftler = [];
    for (const grup of gruplar) {
      if (grup.length === 2) {
        const sonuc = kombinasyonGecerliMi(grup, okeyTasi);
        if (sonuc.gecerli && sonuc.tip === 'cift') {
          ciftler.push(grup);
        }
      }
    }

    if (alreadyOpened && forcedMethod === 'cift' && ciftler.length > 0) {
      return {
        yontem: 'cift',
        kombinasyonlar: ciftler,
        puan: 0
      };
    }

    if (!alreadyOpened && ciftler.length >= 4) {
      return {
        yontem: 'cift',
        kombinasyonlar: ciftler,
        puan: 0
      };
    }
  }

  return null;
}

/**
 * Istaka üzerindeki perlerin toplam puanını hesaplar.
 */
function elPuaniniHesapla(slotlar, okeyTasi) {
  const gruplar = slotlariGrupla(slotlar);
  let toplamPuan = 0;

  for (const grup of gruplar) {
    if (grup.length >= 3) {
      try {
        const sonuc = kombinasyonGecerliMi(grup, okeyTasi);
        console.log('Grup:', JSON.stringify(grup.map(t => `${t.sayi}-${t.renk}${t.jokerMi ? '-J' : ''}`)), 'Gecerli:', sonuc.gecerli, 'Hata:', sonuc.hata);
        if (sonuc.gecerli && (sonuc.tip === 'seri' || sonuc.tip === 'per')) {
          const islenenGrup = _grupJokerleriniDoldur(grup, okeyTasi, sonuc.tip);
          const grupPuan = islenenGrup.reduce((t, s) => {
            if (s.jokerdegeri !== undefined) return t + s.jokerdegeri;
            if (okeyMi(s, okeyTasi)) return t + 0;
            return t + s.sayi;
          }, 0);
          console.log('Grup Puan:', grupPuan);
          toplamPuan += grupPuan;
        }
      } catch (e) { console.error('Error in scoring logic:', e); }
    }
  }

  return toplamPuan;
}

/**
 * Bir grup içindeki jokerlerin (okeylerin) hangi değerde olduğunu belirler.
 * @private
 */
function _grupJokerleriniDoldur(grup, okeyTasi, tip) {
  const kopyalananGrup = grup.map(t => ({ ...t }));

  // Okey harici taşları belirle (Real Okey = wildcard)
  const okeyHaritsiNormalTaslar = kopyalananGrup.filter(t => !okeyMi(t, okeyTasi));

  if (tip === 'per') {
    // Per (Aynı sayı farklı renkler)
    // Sahte okey (Joker) varsa, okeyin değerini alır.
    // Real Okey (Wildcard) varsa, perdeki diğer taşların değerini alır.
    const deger = okeyHaritsiNormalTaslar.length > 0 ? okeyHaritsiNormalTaslar[0].sayi : (okeyTasi ? okeyTasi.sayi : 0);

    kopyalananGrup.forEach(t => {
      if (okeyMi(t, okeyTasi)) {
        t.jokerdegeri = deger;
      } else if (t.jokerMi) {
        // Sahte okey zaten okey değerinde olmalı
        t.sayi = okeyTasi ? okeyTasi.sayi : 0;
      }
    });
  } else if (tip === 'seri') {
    // Seri (Aynı renk ardışık sayılar)
    // Önce okey olmayan taşların sayılarını ve grup içindeki indekslerini al
    const tasIndexleri = [];
    kopyalananGrup.forEach((t, i) => {
      // Real Okey (wildcard) olmayan HER ŞEY (sahte okey dahil) pozisyon belirleyebilir
      if (!okeyMi(t, okeyTasi)) {
        // Sahte okey ise okey değerini referans al
        const tSayi = t.jokerMi ? (okeyTasi ? okeyTasi.sayi : 0) : t.sayi;
        tasIndexleri.push({ sayi: tSayi, index: i });
      }
    });

    if (tasIndexleri.length > 0) {
      const ref = tasIndexleri[0];
      kopyalananGrup.forEach((t, i) => {
        if (okeyMi(t, okeyTasi)) {
          t.jokerdegeri = ref.sayi + (i - ref.index);
        } else if (t.jokerMi && okeyTasi) {
          // Sahte okeyin değerini sabitle (Çünkü normalde sayi:0 dır)
          t.sayi = okeyTasi.sayi;
        }
      });
    }
  }
  return kopyalananGrup;
}

// ============================================================================
// MODÜL İHRACATI (EXPORT)
// ============================================================================

/**
 * Meld içindeki taşları resolve eder — joker/wildcard'ları efektif değerlerine çevirir.
 * Her eleman: { sayi, renk, isWild, isFakeJoker, src }
 * @private
 */
function _resolveMeldTiles(meld, okeyTasi) {
  const resolved = [];
  for (const t of meld) {
    const isWild = !t.jokerMi && okeyTasi &&
      t.sayi === okeyTasi.sayi && t.renk === okeyTasi.renk;
    if (isWild) {
      resolved.push({ sayi: null, renk: null, isWild: true, isFakeJoker: false, src: t });
    } else if (t.jokerMi) {
      const efSayi = okeyTasi ? okeyTasi.sayi : 0;
      const efRenk = okeyTasi ? okeyTasi.renk : 'joker';
      resolved.push({ sayi: efSayi, renk: efRenk, isWild: false, isFakeJoker: true, src: t });
    } else {
      resolved.push({ sayi: t.sayi, renk: t.renk, isWild: false, isFakeJoker: false, src: t });
    }
  }
  return resolved;
}

/**
 * Seri genişletmeyi dener — başa veya sona.
 * 12-13-1 geçişi her iki yönde de yasaktır.
 * @private
 */
function _tryRunExtension(tile, tileIsWild, meld, meldNormals, okeyTasi) {
  const NO = { gecerli: false, tip: null, sebep: null, yeniMeld: null };

  // Sadece concrete (non-wild) taşlar
  const concretes = meldNormals.filter(r => !r.isWild);
  if (concretes.length === 0) return NO;

  // Tüm concrete taşlar aynı renkte olmalı (seri kontrolü)
  const runColor = concretes[0].renk;
  if (!concretes.every(r => r.renk === runColor)) return NO;

  // Duplicate sayı kontrolü (aynı renk, aynı sayı seri olamaz)
  const concreteNums = concretes.map(r => r.sayi).sort((a, b) => a - b);
  if (new Set(concreteNums).size !== concreteNums.length) return NO;

  // Serinin gerçek extent'ini hesapla (başta ve sonta wild'lar dahil)
  let leadingWilds = 0;
  for (const r of meldNormals) {
    if (r.isWild) leadingWilds++; else break;
  }
  let trailingWilds = 0;
  for (let i = meldNormals.length - 1; i >= 0; i--) {
    if (meldNormals[i].isWild) trailingWilds++; else break;
  }

  const minConcrete = concreteNums[0];
  const maxConcrete = concreteNums[concreteNums.length - 1];
  const runStart = minConcrete - leadingWilds;
  const runEnd = maxConcrete + trailingWilds;

  // Seri [1, 13] aralığı içinde olmalı
  if (runStart < 1 || runEnd > MAKS_SAYI) return NO;

  // ── Başa ekleme (runStart - 1) ──────────────────────────────────────────
  const newHead = runStart - 1;
  if (newHead >= 1) {
    if (tileIsWild || (tile.renk === runColor && tile.sayi === newHead)) {
      const yeniMeld = [tile, ...meld];
      return { gecerli: true, tip: 'seri', sebep: 'Serinin başına eklendi.', yeniMeld };
    }
  }

  // ── Sona ekleme (runEnd + 1) ─────────────────────────────────────────────
  const newTail = runEnd + 1;
  if (newTail <= MAKS_SAYI) {
    if (tileIsWild || (tile.renk === runColor && tile.sayi === newTail)) {
      const yeniMeld = [...meld, tile];
      return { gecerli: true, tip: 'seri', sebep: 'Serinin sonuna eklendi.', yeniMeld };
    }
  }

  return NO;
}

/**
 * Per genişletmeyi dener — sadece 3→4 geçişine izin verir.
 * @private
 */
function _tryPerExtension(tile, tileIsWild, meld, meldNormals, okeyTasi) {
  const NO = { gecerli: false, tip: null, sebep: null, yeniMeld: null };

  if (meld.length !== 3) return NO; // Yalnızca 3→4 genişlemesi

  const concretes = meldNormals.filter(r => !r.isWild);
  if (concretes.length === 0) return NO;

  // Tüm concrete taşlar aynı sayıda olmalı
  const perNum = concretes[0].sayi;
  if (!concretes.every(r => r.sayi === perNum)) return NO; // Set değil

  // Mevcut renkler (sadece gerçek taşlar; fake joker okeyTasi.renk'i claim eder)
  const claimedColors = new Set(
    meldNormals
      .filter(r => !r.isWild && !r.isFakeJoker)
      .map(r => r.renk)
  );
  const fakeJokerCount = meldNormals.filter(r => r.isFakeJoker).length;

  if (tileIsWild) {
    // Wildcard herhangi bir renk claim edebilir
    if (claimedColors.size + fakeJokerCount < 4) {
      const yeniMeld = [...meld, tile];
      return { gecerli: true, tip: 'per', sebep: 'Per 4\'lüye tamamlandı.', yeniMeld };
    }
    return NO;
  }

  // Sayı eşleşmeli
  if (tile.sayi !== perNum) return NO;

  // Renk zaten mevcut olmamalı
  if (claimedColors.has(tile.renk)) {
    return { gecerli: false, tip: null, sebep: 'Per: Bu renk zaten mevcut.', yeniMeld: null };
  }

  const yeniMeld = [...meld, tile];
  return { gecerli: true, tip: 'per', sebep: 'Per 4\'lüye tamamlandı.', yeniMeld };
}

/**
 * Bir taşın mevcut açılmış bir kombinasyona eklenip eklenemeyeceğini kontrol eder.
 *
 * Kurallar:
 *  - Seri: Taş başa (enDusuk-1) veya sona (enYuksek+1) eklenebilir.
 *          12-13-1 geçişi YASAK. Wildcard (gerçek okey) da eklenebilir.
 *  - Per:  Meld tam 3 taştan oluşmalı; eklenen taş aynı sayıda ve
 *          meldde olmayan bir renge sahip olmalı. Maks 4 taş.
 *  - Çift: Çift melde taş eklenemez.
 *
 * Bu fonksiyon eski 'tasIslenebilirMi' yerine geçer.
 *
 * @param {Object} tile      - Eklenecek taş (oyuncunun elinden)
 * @param {Array}  meld      - Masadaki mevcut meld dizisi
 * @param {Object} okeyTasi  - Okey (wildcard) taşı tanımı {sayi, renk}
 * @returns {{ gecerli: boolean, tip: 'seri'|'per'|null, sebep: string, yeniMeld: Array|null }}
 */
function canAddTileToMeld(tile, meld, okeyTasi) {
  if (!tile || !Array.isArray(meld) || meld.length < 2) {
    return { gecerli: false, tip: null, sebep: 'Geçersiz giriş.', yeniMeld: null };
  }

  // Çift melde taş eklenemez
  if (meld.length === 2) {
    return { gecerli: false, tip: null, sebep: 'Çifte taş eklenemez.', yeniMeld: null };
  }

  // Wildcard (gerçek okey) tespiti
  const tileIsWild = !tile.jokerMi && okeyTasi &&
    tile.sayi === okeyTasi.sayi && tile.renk === okeyTasi.renk;

  // Meld'i resolve et
  const meldNormals = _resolveMeldTiles(meld, okeyTasi);

  // Önce per dene (3 taşlı meld için)
  const perResult = _tryPerExtension(tile, tileIsWild, meld, meldNormals, okeyTasi);
  if (perResult.gecerli) return perResult;

  // Sonra seri dene
  const seriResult = _tryRunExtension(tile, tileIsWild, meld, meldNormals, okeyTasi);
  if (seriResult.gecerli) return seriResult;

  return { gecerli: false, tip: null, sebep: 'Bu taş bu komba eklenemez.', yeniMeld: null };
}



const _exports = {
  RENKLER,
  MAKS_SAYI,
  DAGITIM_TAS_SAYISI,
  OYUNCU_SAYISI,
  VARSAYILAN_ESIK,
  CIFTE_ESIK,
  okeyMi,
  tasDeger,
  tasOlustur,
  tasKaristir,
  tasDagit,
  gostergeTasBelirle,
  kombinasyonGecerliMi,
  elPuanHesapla,
  kafaAtmaKontrol,
  elAcmaGecerliMi,
  cezaPuanHesapla,
  izinIste,
  cifteIlanEt,
  turSonuKontrol,
  islerTasBelirle,
  canAddTileToMeld,
  tasIslenebilirMi,
  elPuaniniHesapla,
  slotlariGrupla,
  elAcmaKontrol,
  ciftIslenebilirMi
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = _exports;
}

if (typeof window !== 'undefined') {
  window.GameEngine = _exports;
}
