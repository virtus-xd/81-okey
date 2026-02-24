/**
 * 81 Okey — Oyun Motoru Birim Testleri
 * 
 * Node.js assert modülü ile yazılmış kapsamlı testler.
 * Çalıştırma: node gameEngine.test.js
 */

const assert = require('assert');
const {
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
    islerTasBelirle
} = require('./gameEngine');

let toplamTest = 0;
let basariliTest = 0;
let basarisizTest = 0;

/**
 * Basit test çalıştırıcı
 */
function test(isim, fn) {
    toplamTest++;
    try {
        fn();
        basariliTest++;
        console.log(`  ✅ ${isim}`);
    } catch (err) {
        basarisizTest++;
        console.log(`  ❌ ${isim}`);
        console.log(`     Hata: ${err.message}`);
    }
}

function bolum(isim) {
    console.log(`\n📦 ${isim}`);
    console.log('─'.repeat(50));
}

// ============================================================================
// TEST GRUPLARI
// ============================================================================

// --- tasOlustur ---
bolum('tasOlustur()');

test('106 taş döndürmeli', () => {
    const taslar = tasOlustur();
    assert.strictEqual(taslar.length, 106);
});

test('Her renkten 26 taş olmalı (13 × 2)', () => {
    const taslar = tasOlustur();
    for (const renk of RENKLER) {
        const renkTaslar = taslar.filter(t => t.renk === renk);
        assert.strictEqual(renkTaslar.length, 26, `${renk} renkte ${renkTaslar.length} taş var, 26 olmalı`);
    }
});

test('2 joker olmalı', () => {
    const taslar = tasOlustur();
    const jokerler = taslar.filter(t => t.jokerMi);
    assert.strictEqual(jokerler.length, 2);
});

test('Her taşın benzersiz id\'si olmalı', () => {
    const taslar = tasOlustur();
    const idler = new Set(taslar.map(t => t.id));
    assert.strictEqual(idler.size, 106);
});

test('Her sayıdan (1-13) her renkte tam 2 taş olmalı', () => {
    const taslar = tasOlustur();
    for (const renk of RENKLER) {
        for (let sayi = 1; sayi <= MAKS_SAYI; sayi++) {
            const eslesen = taslar.filter(t => t.renk === renk && t.sayi === sayi);
            assert.strictEqual(eslesen.length, 2, `${renk}-${sayi}: ${eslesen.length} taş, 2 olmalı`);
        }
    }
});

// --- tasKaristir ---
bolum('tasKaristir()');

test('Aynı uzunlukta dizi döndürmeli', () => {
    const taslar = tasOlustur();
    const karisik = tasKaristir(taslar);
    assert.strictEqual(karisik.length, taslar.length);
});

test('Orijinal diziyi değiştirmemeli', () => {
    const taslar = tasOlustur();
    const ilkId = taslar[0].id;
    tasKaristir(taslar);
    assert.strictEqual(taslar[0].id, ilkId);
});

test('Karıştırılmış dizi farklı sırada olmalı', () => {
    const taslar = tasOlustur();
    const karisik = tasKaristir(taslar);
    // En az bir taş farklı pozisyonda olmalı (çok düşük olasılıkla aynı olabilir)
    let farkliMi = false;
    for (let i = 0; i < taslar.length; i++) {
        if (taslar[i].id !== karisik[i].id) {
            farkliMi = true;
            break;
        }
    }
    assert.strictEqual(farkliMi, true, 'Karıştırılmış dizi orijinalle aynı');
});

test('Boş dizi verilirse hata fırlatmalı', () => {
    assert.throws(() => tasKaristir([]), /Geçerli/);
    assert.throws(() => tasKaristir(null), /Geçerli/);
});

// --- tasDagit ---
bolum('tasDagit()');

test('Her oyuncuya 14 taş dağıtmalı', () => {
    const sonuc = tasDagit(['Ali', 'Veli', 'Ayşe', 'Fatma']);
    for (const oyuncu of ['Ali', 'Veli', 'Ayşe', 'Fatma']) {
        assert.strictEqual(sonuc.eller[oyuncu].length, 14, `${oyuncu} ${sonuc.eller[oyuncu].length} taş aldı`);
    }
});

test('Istakada 50 taş kalmalı (106 - 56)', () => {
    const sonuc = tasDagit(['Ali', 'Veli', 'Ayşe', 'Fatma']);
    assert.strictEqual(sonuc.istaka.length, 50);
});

test('Hiçbir taş id\'si tekrar etmemeli', () => {
    const sonuc = tasDagit(['Ali', 'Veli', 'Ayşe', 'Fatma']);
    const tumIdler = [];
    for (const oyuncu of ['Ali', 'Veli', 'Ayşe', 'Fatma']) {
        tumIdler.push(...sonuc.eller[oyuncu].map(t => t.id));
    }
    tumIdler.push(...sonuc.istaka.map(t => t.id));
    const idSet = new Set(tumIdler);
    assert.strictEqual(idSet.size, 106);
});

test('4\'ten farklı oyuncu sayısında hata fırlatmalı', () => {
    assert.throws(() => tasDagit(['Ali', 'Veli']), /Tam 4/);
    assert.throws(() => tasDagit([]), /Tam 4/);
});

// --- gostergeTasBelirle ---
bolum('gostergeTasBelirle()');

test('Gösterge ve okey taşı döndürmeli', () => {
    const dagitim = tasDagit(['A', 'B', 'C', 'D']);
    const sonuc = gostergeTasBelirle([...dagitim.istaka]);
    assert.ok(sonuc.gostergeTasi, 'gostergeTasi olmalı');
    assert.ok(sonuc.okeyTasi, 'okeyTasi olmalı');
    assert.ok(sonuc.birZar > 0, 'birZar > 0 olmalı');
    assert.ok(sonuc.ikiZar > 0, 'ikiZar > 0 olmalı');
});

test('Okey taşı göstergenin bir üstü olmalı', () => {
    // Deterministik test: elle ıstaka oluştur
    const istaka = [
        { id: 1, sayi: 5, renk: 'kirmizi', jokerMi: false },
        { id: 2, sayi: 7, renk: 'mavi', jokerMi: false },
        { id: 3, sayi: 10, renk: 'sari', jokerMi: false },
        { id: 4, sayi: 3, renk: 'siyah', jokerMi: false },
        { id: 5, sayi: 9, renk: 'kirmizi', jokerMi: false },
        { id: 6, sayi: 2, renk: 'mavi', jokerMi: false },
        { id: 7, sayi: 11, renk: 'sari', jokerMi: false },
    ];
    const sonuc = gostergeTasBelirle([...istaka]);
    if (!sonuc.gostergeTasi.jokerMi) {
        const beklenenOkeySayi = sonuc.gostergeTasi.sayi >= 13 ? 1 : sonuc.gostergeTasi.sayi + 1;
        assert.strictEqual(sonuc.okeyTasi.sayi, beklenenOkeySayi);
        assert.strictEqual(sonuc.okeyTasi.renk, sonuc.gostergeTasi.renk);
    }
});

test('Gösterge 13 ise okey 1 olmalı', () => {
    const istaka = [
        { id: 1, sayi: 13, renk: 'kirmizi', jokerMi: false }
    ];
    const sonuc = gostergeTasBelirle([...istaka]);
    assert.strictEqual(sonuc.okeyTasi.sayi, 1);
    assert.strictEqual(sonuc.okeyTasi.renk, 'kirmizi');
});

test('Boş ıstaka ile hata fırlatmalı', () => {
    assert.throws(() => gostergeTasBelirle([]), /Geçerli/);
});

// --- kombinasyonGecerliMi ---
bolum('kombinasyonGecerliMi()');

test('Geçerli 3\'lü seri → true', () => {
    const sonuc = kombinasyonGecerliMi([
        { sayi: 3, renk: 'kirmizi', jokerMi: false },
        { sayi: 4, renk: 'kirmizi', jokerMi: false },
        { sayi: 5, renk: 'kirmizi', jokerMi: false }
    ]);
    assert.strictEqual(sonuc.gecerli, true);
    assert.strictEqual(sonuc.tip, 'seri');
});

test('Geçerli 5\'li seri → true', () => {
    const sonuc = kombinasyonGecerliMi([
        { sayi: 1, renk: 'mavi', jokerMi: false },
        { sayi: 2, renk: 'mavi', jokerMi: false },
        { sayi: 3, renk: 'mavi', jokerMi: false },
        { sayi: 4, renk: 'mavi', jokerMi: false },
        { sayi: 5, renk: 'mavi', jokerMi: false }
    ]);
    assert.strictEqual(sonuc.gecerli, true);
    assert.strictEqual(sonuc.tip, 'seri');
});

test('Geçerli 3\'lü per → true', () => {
    const sonuc = kombinasyonGecerliMi([
        { sayi: 7, renk: 'kirmizi', jokerMi: false },
        { sayi: 7, renk: 'mavi', jokerMi: false },
        { sayi: 7, renk: 'sari', jokerMi: false }
    ]);
    assert.strictEqual(sonuc.gecerli, true);
    assert.strictEqual(sonuc.tip, 'per');
});

test('Geçerli 4\'lü per → true', () => {
    const sonuc = kombinasyonGecerliMi([
        { sayi: 10, renk: 'kirmizi', jokerMi: false },
        { sayi: 10, renk: 'mavi', jokerMi: false },
        { sayi: 10, renk: 'sari', jokerMi: false },
        { sayi: 10, renk: 'siyah', jokerMi: false }
    ]);
    assert.strictEqual(sonuc.gecerli, true);
    assert.strictEqual(sonuc.tip, 'per');
});

test('12-13-1 dizilimi → false', () => {
    const sonuc = kombinasyonGecerliMi([
        { sayi: 12, renk: 'mavi', jokerMi: false },
        { sayi: 13, renk: 'mavi', jokerMi: false },
        { sayi: 1, renk: 'mavi', jokerMi: false }
    ]);
    assert.strictEqual(sonuc.gecerli, false);
});

test('Joker ile tamamlanmış seri → true', () => {
    const sonuc = kombinasyonGecerliMi([
        { sayi: 3, renk: 'kirmizi', jokerMi: false },
        { sayi: 0, renk: 'joker', jokerMi: true },
        { sayi: 5, renk: 'kirmizi', jokerMi: false }
    ]);
    assert.strictEqual(sonuc.gecerli, true);
    assert.strictEqual(sonuc.tip, 'seri');
});

test('Joker ile tamamlanmış per → true', () => {
    const sonuc = kombinasyonGecerliMi([
        { sayi: 7, renk: 'kirmizi', jokerMi: false },
        { sayi: 7, renk: 'mavi', jokerMi: false },
        { sayi: 0, renk: 'joker', jokerMi: true }
    ]);
    assert.strictEqual(sonuc.gecerli, true);
    assert.strictEqual(sonuc.tip, 'per');
});

test('Geçerli çift → true', () => {
    const sonuc = kombinasyonGecerliMi([
        { sayi: 5, renk: 'kirmizi', jokerMi: false },
        { sayi: 5, renk: 'kirmizi', jokerMi: false }
    ]);
    assert.strictEqual(sonuc.gecerli, true);
    assert.strictEqual(sonuc.tip, 'cift');
});

test('Farklı renkli çift → false', () => {
    const sonuc = kombinasyonGecerliMi([
        { sayi: 5, renk: 'kirmizi', jokerMi: false },
        { sayi: 5, renk: 'mavi', jokerMi: false }
    ]);
    assert.strictEqual(sonuc.gecerli, false);
});

test('Aynı renk ama ardışık olmayan sayılar → false', () => {
    const sonuc = kombinasyonGecerliMi([
        { sayi: 3, renk: 'kirmizi', jokerMi: false },
        { sayi: 5, renk: 'kirmizi', jokerMi: false },
        { sayi: 8, renk: 'kirmizi', jokerMi: false }
    ]);
    assert.strictEqual(sonuc.gecerli, false);
});

test('2\'den az taş → hata', () => {
    assert.throws(() => kombinasyonGecerliMi([{ sayi: 5, renk: 'kirmizi', jokerMi: false }]), /En az 2/);
});

// --- elPuanHesapla ---
bolum('elPuanHesapla()');

test('Tek seri puanı doğru hesaplanmalı', () => {
    const puan = elPuanHesapla([
        [
            { sayi: 3, renk: 'kirmizi', jokerMi: false },
            { sayi: 4, renk: 'kirmizi', jokerMi: false },
            { sayi: 5, renk: 'kirmizi', jokerMi: false }
        ]
    ]);
    assert.strictEqual(puan, 12); // 3+4+5
});

test('Birden fazla kombinasyon puanı doğru toplanmalı', () => {
    const puan = elPuanHesapla([
        [
            { sayi: 10, renk: 'kirmizi', jokerMi: false },
            { sayi: 11, renk: 'kirmizi', jokerMi: false },
            { sayi: 12, renk: 'kirmizi', jokerMi: false }
        ],
        [
            { sayi: 7, renk: 'mavi', jokerMi: false },
            { sayi: 7, renk: 'sari', jokerMi: false },
            { sayi: 7, renk: 'siyah', jokerMi: false }
        ]
    ]);
    assert.strictEqual(puan, 54); // (10+11+12) + (7+7+7)
});

test('Boş kombinasyon dizisi → 0', () => {
    const puan = elPuanHesapla([]);
    assert.strictEqual(puan, 0);
});

test('Geçersiz giriş → hata', () => {
    assert.throws(() => elPuanHesapla('invalid'), /Geçerli/);
});

// --- kafaAtmaKontrol ---
bolum('kafaAtmaKontrol()');

test('81 puan → normal', () => {
    const sonuc = kafaAtmaKontrol(81);
    assert.strictEqual(sonuc.durum, 'normal');
    assert.strictEqual(sonuc.bonus, 0);
});

test('100 puan → normal', () => {
    const sonuc = kafaAtmaKontrol(100);
    assert.strictEqual(sonuc.durum, 'normal');
    assert.strictEqual(sonuc.bonus, 0);
});

test('101 puan → kafa', () => {
    const sonuc = kafaAtmaKontrol(101);
    assert.strictEqual(sonuc.durum, 'kafa');
    assert.strictEqual(sonuc.bonus, -100);
});

test('120 puan → kafa', () => {
    const sonuc = kafaAtmaKontrol(120);
    assert.strictEqual(sonuc.durum, 'kafa');
    assert.strictEqual(sonuc.bonus, -100);
});

test('121 puan → çift kafa', () => {
    const sonuc = kafaAtmaKontrol(121);
    assert.strictEqual(sonuc.durum, 'ciftKafa');
    assert.strictEqual(sonuc.bonus, -200);
});

test('4 çift → normal', () => {
    const sonuc = kafaAtmaKontrol(0, 4);
    assert.strictEqual(sonuc.durum, 'normal');
    assert.strictEqual(sonuc.bonus, 0);
});

test('5 çift → kafa', () => {
    const sonuc = kafaAtmaKontrol(0, 5);
    assert.strictEqual(sonuc.durum, 'kafa');
    assert.strictEqual(sonuc.bonus, -100);
});

test('6 çift → çift kafa', () => {
    const sonuc = kafaAtmaKontrol(0, 6);
    assert.strictEqual(sonuc.durum, 'ciftKafa');
    assert.strictEqual(sonuc.bonus, -200);
});

// --- elAcmaGecerliMi ---
bolum('elAcmaGecerliMi()');

test('81+ puanlık seri kombinasyonlar → geçerli', () => {
    const sonuc = elAcmaGecerliMi([
        [
            { sayi: 10, renk: 'kirmizi', jokerMi: false },
            { sayi: 11, renk: 'kirmizi', jokerMi: false },
            { sayi: 12, renk: 'kirmizi', jokerMi: false },
            { sayi: 13, renk: 'kirmizi', jokerMi: false }
        ],
        [
            { sayi: 9, renk: 'mavi', jokerMi: false },
            { sayi: 10, renk: 'mavi', jokerMi: false },
            { sayi: 11, renk: 'mavi', jokerMi: false },
            { sayi: 12, renk: 'mavi', jokerMi: false }
        ]
    ], 81);
    // (10+11+12+13) + (9+10+11+12) = 46 + 42 = 88
    assert.strictEqual(sonuc.gecerli, true);
    assert.strictEqual(sonuc.yontem, 'seri');
    assert.strictEqual(sonuc.puan, 88);
});

test('80 puanlık seri → geçersiz (eşik 81)', () => {
    const sonuc = elAcmaGecerliMi([
        [
            { sayi: 10, renk: 'kirmizi', jokerMi: false },
            { sayi: 11, renk: 'kirmizi', jokerMi: false },
            { sayi: 12, renk: 'kirmizi', jokerMi: false }
        ],
        [
            { sayi: 13, renk: 'mavi', jokerMi: false },
            { sayi: 13, renk: 'sari', jokerMi: false },
            { sayi: 13, renk: 'siyah', jokerMi: false }
        ]
    ], 81);
    // (10+11+12) + (13+13+13) = 33 + 39 = 72 < 81
    assert.strictEqual(sonuc.gecerli, false);
});

test('4 çift → geçerli', () => {
    const sonuc = elAcmaGecerliMi([
        [{ sayi: 5, renk: 'kirmizi', jokerMi: false }, { sayi: 5, renk: 'kirmizi', jokerMi: false }],
        [{ sayi: 8, renk: 'mavi', jokerMi: false }, { sayi: 8, renk: 'mavi', jokerMi: false }],
        [{ sayi: 3, renk: 'sari', jokerMi: false }, { sayi: 3, renk: 'sari', jokerMi: false }],
        [{ sayi: 11, renk: 'siyah', jokerMi: false }, { sayi: 11, renk: 'siyah', jokerMi: false }]
    ], 81);
    assert.strictEqual(sonuc.gecerli, true);
    assert.strictEqual(sonuc.yontem, 'cift');
    assert.strictEqual(sonuc.ciftSayisi, 4);
});

test('3 çift → geçersiz', () => {
    const sonuc = elAcmaGecerliMi([
        [{ sayi: 5, renk: 'kirmizi', jokerMi: false }, { sayi: 5, renk: 'kirmizi', jokerMi: false }],
        [{ sayi: 8, renk: 'mavi', jokerMi: false }, { sayi: 8, renk: 'mavi', jokerMi: false }],
        [{ sayi: 3, renk: 'sari', jokerMi: false }, { sayi: 3, renk: 'sari', jokerMi: false }]
    ], 81);
    assert.strictEqual(sonuc.gecerli, false);
});

test('Boş kombinasyon → geçersiz', () => {
    const sonuc = elAcmaGecerliMi([], 81);
    assert.strictEqual(sonuc.gecerli, false);
});

// --- cezaPuanHesapla ---
bolum('cezaPuanHesapla()');

test('El açılmadı → 100 ceza', () => {
    const sonuc = cezaPuanHesapla({ kalanTaslar: [], elAcildi: false, izinVermedi: false });
    assert.strictEqual(sonuc.ceza, 100);
});

test('El açılmadı + izin vermedi → 200 ceza', () => {
    const sonuc = cezaPuanHesapla({ kalanTaslar: [], elAcildi: false, izinVermedi: true });
    assert.strictEqual(sonuc.ceza, 200);
});

test('El açıldı, kalan taşlar → toplam değer kadar ceza', () => {
    const sonuc = cezaPuanHesapla({
        kalanTaslar: [
            { sayi: 5, renk: 'kirmizi', jokerMi: false },
            { sayi: 8, renk: 'mavi', jokerMi: false }
        ],
        elAcildi: true,
        izinVermedi: false
    });
    assert.strictEqual(sonuc.ceza, 13); // 5 + 8
});

test('El açıldı, taş kalmadı → 0 ceza', () => {
    const sonuc = cezaPuanHesapla({ kalanTaslar: [], elAcildi: true, izinVermedi: false });
    assert.strictEqual(sonuc.ceza, 0);
});

test('Çifte gidildi + kalan taşlar → 2× ceza', () => {
    const sonuc = cezaPuanHesapla({
        kalanTaslar: [
            { sayi: 5, renk: 'kirmizi', jokerMi: false },
            { sayi: 8, renk: 'mavi', jokerMi: false }
        ],
        elAcildi: true,
        izinVermedi: false
    }, true);
    assert.strictEqual(sonuc.ceza, 26); // (5+8) × 2
});

test('Geçersiz oyuncu → hata', () => {
    assert.throws(() => cezaPuanHesapla(null), /Geçerli/);
});

// --- izinIste ---
bolum('izinIste()');

test('İzin verildi → taş alındı', () => {
    const sonuc = izinIste(
        { isim: 'Ali' },
        { isim: 'Veli' },
        { sayi: 5, renk: 'kirmizi' },
        true
    );
    assert.strictEqual(sonuc.basarili, true);
    assert.strictEqual(sonuc.cifteGecti, null);
});

test('İzin reddedildi → çifte geçildi', () => {
    const veren = { isim: 'Veli' };
    const sonuc = izinIste(
        { isim: 'Ali' },
        veren,
        { sayi: 5, renk: 'kirmizi' },
        false
    );
    assert.strictEqual(sonuc.basarili, false);
    assert.strictEqual(sonuc.cifteGecti, 'Veli');
    assert.strictEqual(veren.cifteGectiMi, true);
});

test('Geçersiz oyuncu → hata', () => {
    assert.throws(() => izinIste(null, { isim: 'A' }, {}, true), /isteyen/);
    assert.throws(() => izinIste({ isim: 'A' }, null, {}, true), /veren/);
});

// --- cifteIlanEt ---
bolum('cifteIlanEt()');

test('Çifte ilan → diğer oyuncuların eşiği 101', () => {
    const oyuncular = [
        { isim: 'Ali', cifteIlanEtti: false, elAcmaEsigi: 81 },
        { isim: 'Veli', elAcmaEsigi: 81 },
        { isim: 'Ayşe', elAcmaEsigi: 81 },
        { isim: 'Fatma', elAcmaEsigi: 81 }
    ];
    const sonuc = cifteIlanEt(oyuncular[0], oyuncular);
    assert.strictEqual(sonuc.basarili, true);
    assert.strictEqual(oyuncular[0].cifteIlanEtti, true);
    assert.strictEqual(oyuncular[1].elAcmaEsigi, 101);
    assert.strictEqual(oyuncular[2].elAcmaEsigi, 101);
    assert.strictEqual(oyuncular[3].elAcmaEsigi, 101);
    assert.strictEqual(sonuc.guncellenenOyuncular.length, 3);
});

test('Zaten ilan etmiş → başarısız', () => {
    const oyuncu = { isim: 'Ali', cifteIlanEtti: true };
    const oyuncular = [oyuncu, { isim: 'B' }, { isim: 'C' }, { isim: 'D' }];
    const sonuc = cifteIlanEt(oyuncu, oyuncular);
    assert.strictEqual(sonuc.basarili, false);
});

test('Geçersiz liste → hata', () => {
    assert.throws(() => cifteIlanEt({ isim: 'A' }, [{ isim: 'A' }]), /Tam 4/);
});

// --- turSonuKontrol ---
bolum('turSonuKontrol()');

test('Istaka bitti → tur biter', () => {
    const sonuc = turSonuKontrol(
        [{ isim: 'Ali', kalanTaslar: [{ sayi: 5 }], elAcildi: true }],
        []
    );
    assert.strictEqual(sonuc.bitti, true);
    assert.ok(sonuc.sebep.includes('tükendi'));
});

test('Oyuncu el bitirdi → tur biter', () => {
    const sonuc = turSonuKontrol(
        [
            { isim: 'Ali', kalanTaslar: [], elAcildi: true },
            { isim: 'Veli', kalanTaslar: [{ sayi: 3 }], elAcildi: false }
        ],
        [{ sayi: 7 }]
    );
    assert.strictEqual(sonuc.bitti, true);
    assert.strictEqual(sonuc.kazanan, 'Ali');
});

test('Hem ıstaka var hem oyun devam → tur bitmez', () => {
    const sonuc = turSonuKontrol(
        [
            { isim: 'Ali', kalanTaslar: [{ sayi: 5 }], elAcildi: false },
            { isim: 'Veli', kalanTaslar: [{ sayi: 3 }], elAcildi: false }
        ],
        [{ sayi: 7 }, { sayi: 9 }]
    );
    assert.strictEqual(sonuc.bitti, false);
});

test('Geçersiz oyuncu listesi → hata', () => {
    assert.throws(() => turSonuKontrol([], []), /Geçerli/);
});

// --- islerTasBelirle ---
bolum('islerTasBelirle()');

test('Serinin sonuna eklenebilecek taş → işlek', () => {
    const sonuc = islerTasBelirle(
        { sayi: 6, renk: 'kirmizi', jokerMi: false },
        [[
            { sayi: 3, renk: 'kirmizi', jokerMi: false },
            { sayi: 4, renk: 'kirmizi', jokerMi: false },
            { sayi: 5, renk: 'kirmizi', jokerMi: false }
        ]]
    );
    assert.strictEqual(sonuc.islekMi, true);
});

test('3\'lü peri 4\'lüye tamamlayan taş → işlek', () => {
    const sonuc = islerTasBelirle(
        { sayi: 7, renk: 'siyah', jokerMi: false },
        [[
            { sayi: 7, renk: 'kirmizi', jokerMi: false },
            { sayi: 7, renk: 'mavi', jokerMi: false },
            { sayi: 7, renk: 'sari', jokerMi: false }
        ]]
    );
    assert.strictEqual(sonuc.islekMi, true);
});

test('Hiçbir kombinasyona uymayan taş → işlek değil', () => {
    const sonuc = islerTasBelirle(
        { sayi: 1, renk: 'sari', jokerMi: false },
        [[
            { sayi: 7, renk: 'kirmizi', jokerMi: false },
            { sayi: 8, renk: 'kirmizi', jokerMi: false },
            { sayi: 9, renk: 'kirmizi', jokerMi: false }
        ]]
    );
    assert.strictEqual(sonuc.islekMi, false);
});

test('Joker → her zaman işlek', () => {
    const sonuc = islerTasBelirle(
        { sayi: 0, renk: 'joker', jokerMi: true },
        []
    );
    assert.strictEqual(sonuc.islekMi, true);
});

test('Serinin başına eklenebilecek taş → işlek', () => {
    const sonuc = islerTasBelirle(
        { sayi: 4, renk: 'mavi', jokerMi: false },
        [[
            { sayi: 5, renk: 'mavi', jokerMi: false },
            { sayi: 6, renk: 'mavi', jokerMi: false },
            { sayi: 7, renk: 'mavi', jokerMi: false }
        ]]
    );
    assert.strictEqual(sonuc.islekMi, true);
});

// ============================================================================
// SONUÇ
// ============================================================================

console.log('\n' + '═'.repeat(50));
console.log(`📊 Test Sonuçları: ${basariliTest}/${toplamTest} başarılı`);
if (basarisizTest > 0) {
    console.log(`❌ ${basarisizTest} test başarısız!`);
} else {
    console.log('✅ Tüm testler başarılı!');
}
console.log('═'.repeat(50));

process.exit(basarisizTest > 0 ? 1 : 0);
