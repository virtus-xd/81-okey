/**
 * 81 Okey — Multiplayer Sunucu
 * 
 * Node.js + Express + Socket.IO
 * 4 kişilik multiplayer oyun sunucusu
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const GE = require('./gameEngine');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

// Ana sayfa → multiplayer.html (static'ten ÖNCE olmalı!)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'multiplayer.html'));
});

// Statik dosyaları sun
app.use(express.static(path.join(__dirname)));

// ─── LOBİ ve ODALAR ──────────────────────────────────────
const odalar = new Map(); // odaId → OdaDurumu
let odaSayaci = 0;

function yeniOdaOlustur() {
    const odaId = `oda_${++odaSayaci}`;
    odalar.set(odaId, {
        id: odaId,
        oyuncular: [],       // { socketId, isim, hazir }
        oyun: null,          // Oyun durumu (başladıktan sonra)
        basladiMi: false
    });
    return odaId;
}

// Bekleyen oda bul veya yeni oluştur
function uygunOdaBul() {
    for (const [id, oda] of odalar) {
        if (!oda.basladiMi && oda.oyuncular.length < 4) {
            return id;
        }
    }
    return yeniOdaOlustur();
}

// ─── OYUN DURUMU YÖNETİMİ ────────────────────────────────

function oyunDurumuOlustur(oyuncuIsimleri) {
    const dagitim = GE.tasDagit(oyuncuIsimleri);
    const gosterge = GE.gostergeTasBelirle(dagitim.istaka);

    return {
        oyuncular: oyuncuIsimleri.map((isim, i) => ({
            isim: isim,
            el: dagitim.eller[isim],
            elAcildi: false,
            acilmisKombs: [],
            puan: 0,
            elAcmaEsigi: GE.VARSAYILAN_ESIK,
            cifteIlanEtti: false,
            cifteGectiMi: false,
            yasakliOyuncular: [],
            izinVermedi: false,
            sonAtilanTas: null,
            kalanTaslar: dagitim.eller[isim]
        })),
        istaka: dagitim.istaka,
        atilanTaslar: [],
        sonAtilanTas: null,
        sonTasAtanIndex: -1,
        gostergeTasi: gosterge.gostergeTasi,
        okeyTasi: gosterge.okeyTasi,
        aktifOyuncuIndex: 0,
        tur: 1,
        faz: 'cekme',
        oyunBitti: false,
        izinBekleniyor: false,
        izinIsteyenIndex: -1,
        izinAtanIndex: -1,
        izinTas: null,
        yandanAlBekleyen: -1, // Yandan al seçeneği bekleyen oyuncu
        zorunluAcma: {}, // oyuncuIndex → true
        zorunluAcmaYandanTas: {}, // oyuncuIndex → yandan alınan taş (ceza için sakla)
        _zorunluAcmaTimeout: null  // Zorunlu açma zamanlayıcısı
    };
}

// ─── ZORUNLU AÇMA ZAMANLAYICISI ──────────────────────────

const ZORUNLU_ACMA_SURE = 30000; // 30 saniye

/**
 * Zorunlu açma zamanlayıcısını başlatır.
 * Süre dolunca: yandan taş geri atılır, istakadan çekilir, rastgele atılır, +100 ceza
 */
function zorunluAcmaZamanlayicisiBaslat(odaId, oyuncuIdx) {
    const oda = odalar.get(odaId);
    if (!oda || !oda.oyun) return;
    const oyun = oda.oyun;

    // Önceki zamanlayıcıyı temizle
    if (oyun._zorunluAcmaTimeout) {
        clearTimeout(oyun._zorunluAcmaTimeout);
        oyun._zorunluAcmaTimeout = null;
    }

    // Başlangıç zamanını kaydet (istemciye de gönderilir)
    oyun.zorunluAcmaSure = ZORUNLU_ACMA_SURE;
    oyun.zorunluAcmaBaslangic = Date.now();

    oyun._zorunluAcmaTimeout = setTimeout(() => {
        zorunluAcmaSureDoldu(odaId, oyuncuIdx);
    }, ZORUNLU_ACMA_SURE);
}

function zorunluAcmaZamanlayicisiDurdur(odaId) {
    const oda = odalar.get(odaId);
    if (!oda || !oda.oyun) return;
    const oyun = oda.oyun;

    if (oyun._zorunluAcmaTimeout) {
        clearTimeout(oyun._zorunluAcmaTimeout);
        oyun._zorunluAcmaTimeout = null;
    }
    delete oyun.zorunluAcmaSure;
    delete oyun.zorunluAcmaBaslangic;
}

/**
 * Zorunlu açma süresi dolduğunda:
 * 1) Yandan alınan taşı geri at (son atılan olarak)
 * 2) İstakadan 1 taş çek
 * 3) Çekilen taşı otomatik at
 * 4) +100 puan ceza
 * 5) Sıra sonraki oyuncuya geçer
 */
function zorunluAcmaSureDoldu(odaId, oyuncuIdx) {
    const oda = odalar.get(odaId);
    if (!oda || !oda.oyun) return;
    const oyun = oda.oyun;

    // Hâlâ zorunlu açma durumunda mı kontrol
    if (!oyun.zorunluAcma[oyuncuIdx]) return;

    const oyuncu = oyun.oyuncular[oyuncuIdx];
    const yandanTas = oyun.zorunluAcmaYandanTas[oyuncuIdx];

    console.log(`⏰ ${oyuncu.isim} zorunlu açma süresini aştı! Ceza uygulanıyor.`);

    // 1) Yandan alınan taşı elden çıkar ve geri at
    if (yandanTas) {
        const tasIdx = oyuncu.el.findIndex(t => t.id === yandanTas.id);
        if (tasIdx !== -1) {
            oyuncu.el.splice(tasIdx, 1);
        }
        // Geri atılan taş olarak koy
        if (oyun.sonAtilanTas) oyun.atilanTaslar.push(oyun.sonAtilanTas);
        oyun.sonAtilanTas = yandanTas;
        oyun.sonTasAtanIndex = oyuncuIdx;
        oyuncu.sonAtilanTas = yandanTas;
    }

    // 2) İstakadan 1 taş çek
    if (oyun.istaka.length > 0) {
        const cekilenTas = oyun.istaka.pop();
        // 3) Çekilen taşı otomatik at
        if (oyun.sonAtilanTas) oyun.atilanTaslar.push(oyun.sonAtilanTas);
        oyun.sonAtilanTas = cekilenTas;
        oyun.sonTasAtanIndex = oyuncuIdx;
        oyuncu.sonAtilanTas = cekilenTas;
    }

    // 4) +100 puan ceza
    oyuncu.puan += 100;

    // Temizle
    delete oyun.zorunluAcma[oyuncuIdx];
    delete oyun.zorunluAcmaYandanTas[oyuncuIdx];
    oyun._zorunluAcmaTimeout = null;
    delete oyun.zorunluAcmaSure;
    delete oyun.zorunluAcmaBaslangic;

    // Bildirim gönder
    herkeseBannerGonder(odaId, `⏰ ${oyuncu.isim} açamadı! +100 CEZA`, '#f87171');
    herkeseBildirimGonder(odaId,
        `${oyuncu.isim} yandan taşı alıp açamadı! Taş geri atıldı, +100 puan ceza.`, 'cifte-bildirim', 5000);

    // 5) Sıra ilerlesin — ama yandan alma kontrolü yapma (direkt sıra geçsin)
    siraIlerlet(odaId);
}

/**
 * Bir oyuncuya gönderilecek durum verisi (diğer oyuncuların elini GİZLER)
 */
function oyuncuyaDurumGonder(oyun, oyuncuIndex) {
    return {
        benimElim: oyun.oyuncular[oyuncuIndex].el,
        benimIndexim: oyuncuIndex,
        oyuncular: oyun.oyuncular.map((o, i) => ({
            isim: o.isim,
            tasSayisi: o.el.length,
            elAcildi: o.elAcildi,
            acilmisKombs: o.acilmisKombs,
            elAcmaYontemi: o.elAcmaYontemi || 'seri',
            puan: o.puan,
            cifteIlanEtti: o.cifteIlanEtti,
            cifteGectiMi: o.cifteGectiMi,
            elAcmaEsigi: o.elAcmaEsigi,
            sonAtilanTas: o.sonAtilanTas
        })),
        istakaSayisi: oyun.istaka.length,
        sonAtilanTas: oyun.sonAtilanTas,
        sonTasAtanIndex: oyun.sonTasAtanIndex,
        gostergeTasi: oyun.gostergeTasi,
        okeyTasi: oyun.okeyTasi,
        aktifOyuncuIndex: oyun.aktifOyuncuIndex,
        faz: oyun.faz,
        tur: oyun.tur,
        oyunBitti: oyun.oyunBitti,
        izinBekleniyor: oyun.izinBekleniyor,
        zorunluAcma: !!oyun.zorunluAcma[oyuncuIndex],
        zorunluAcmaKalanSure: oyun.zorunluAcma[oyuncuIndex] && oyun.zorunluAcmaBaslangic
            ? Math.max(0, Math.ceil((ZORUNLU_ACMA_SURE - (Date.now() - oyun.zorunluAcmaBaslangic)) / 1000))
            : 0
    };
}

/**
 * Odadaki tüm oyunculara kendi durumlarını gönder
 */
function herkeseDurumGonder(odaId) {
    const oda = odalar.get(odaId);
    if (!oda || !oda.oyun) return;

    oda.oyuncular.forEach((o, i) => {
        const socket = io.sockets.sockets.get(o.socketId);
        if (socket) {
            socket.emit('durumGuncelle', oyuncuyaDurumGonder(oda.oyun, i));
        }
    });
}

function oyuncuyaBildirimGonder(odaId, oyuncuIndex, mesaj, tip = '', sure = 3000) {
    const oda = odalar.get(odaId);
    if (!oda) return;
    const o = oda.oyuncular[oyuncuIndex];
    if (!o) return;
    const socket = io.sockets.sockets.get(o.socketId);
    if (socket) {
        socket.emit('bildirim', { mesaj, tip, sure });
    }
}

function herkeseBildirimGonder(odaId, mesaj, tip = '', sure = 3000) {
    io.to(odaId).emit('bildirim', { mesaj, tip, sure });
}

function herkeseBannerGonder(odaId, mesaj, renk) {
    io.to(odaId).emit('banner', { mesaj, renk });
}

/**
 * Sırayı ilerlet. Yandan alma kontrolü burada yapılır.
 */
function siraIlerlet(odaId) {
    const oda = odalar.get(odaId);
    if (!oda || !oda.oyun) return;
    const oyun = oda.oyun;

    oyun.aktifOyuncuIndex = (oyun.aktifOyuncuIndex + 1) % 4;
    oyun.faz = 'cekme';

    herkeseDurumGonder(odaId);
}

/**
 * Taş atıldıktan sonra yandan alma kontrolü.
 * Yandaki oyuncuya seçenek sunar.
 */
function tasAtildiSonrasi(odaId, atilanTas, atanIndex) {
    const oda = odalar.get(odaId);
    if (!oda || !oda.oyun) return;
    const oyun = oda.oyun;

    const yandakiIndex = (atanIndex + 1) % 4;
    const yandaki = oyun.oyuncular[yandakiIndex];

    // ÖNCELİK 1: Yandaki çifte ilan ettiyse → serbestçe alabilir (ama seçim hakkı var)
    if (yandaki.cifteIlanEtti) {
        // İşlek taş kontrolü
        try {
            const acilmisKombs = oyun.oyuncular.flatMap(o => o.acilmisKombs);
            const islekSonuc = GE.islerTasBelirle(atilanTas, acilmisKombs, oyun.okeyTasi);
            if (islekSonuc && islekSonuc.islek) {
                // İşlek taş alınamaz, normal sıra devam etsin (çifte hakkı işlek için geçerli değil)
                siraIlerlet(odaId);
                return;
            }
        } catch (e) { /* ignore */ }
    }

    // KURAL: Yasaklıysa ve çifte değilse → pas
    if (yandaki.yasakliOyuncular.includes(atanIndex) && !yandaki.cifteIlanEtti) {
        oyuncuyaBildirimGonder(odaId, yandakiIndex,
            `${oyun.oyuncular[atanIndex].isim} size yasaklı! (Çifte gitmediğiniz sürece alamazsınız)`, '', 3000);
        siraIlerlet(odaId);
        return;
    }

    // Seçenek sun
    oyun.yandanAlBekleyen = yandakiIndex;
    oyun.izinTas = atilanTas;
    oyun.izinAtanIndex = atanIndex;

    // KURAL: Eğer çifte ilan etmişse, turn progression'ı BLOKE ETME!
    // Sadece yandanalBekleyen'i set et ve turn'ü ilerlet + Seçim Popup'ı tetikle
    if (yandaki.cifteIlanEtti) {
        siraIlerlet(odaId);
        const yandakiSocket = io.sockets.sockets.get(oda.oyuncular[yandakiIndex].socketId);
        if (yandakiSocket) {
            yandakiSocket.emit('yandanAlSecenegi', {
                tas: atilanTas,
                atanIsim: oyun.oyuncular[atanIndex].isim
            });
        }
        oyuncuyaBildirimGonder(odaId, yandakiIndex, "Sıra sizde! İsterseniz yandan taşı bekletmeden alabilir veya ortadan çekebilirsiniz.", 'cifte-bildirim', 4000);
        return;
    }

    const yandakiSocket = io.sockets.sockets.get(oda.oyuncular[yandakiIndex].socketId);
    if (yandakiSocket) {
        yandakiSocket.emit('yandanAlSecenegi', {
            tas: atilanTas,
            atanIsim: oyun.oyuncular[atanIndex].isim
        });
    }

    // 5 saniye içinde yanıt gelmezse pas geç
    oyun._yandanAlTimeout = setTimeout(() => {
        if (oyun.yandanAlBekleyen === yandakiIndex) {
            oyun.yandanAlBekleyen = -1;
            siraIlerlet(odaId);
        }
    }, 8000);
}

/**
 * El açma doğrulaması (sunucu tarafı)
 * bot.js yerine gameEngine fonksiyonlarını doğrudan kullanır
 */
function elAcmaDogrula(el, esik, okeyTasi) {
    // Tüm olası kombinasyonları bul
    const kombinasyonlar = [];
    let toplamPuan = 0;

    // Basit yaklaşım: 3+ ardışık aynı renk (seri) ve 3+ aynı sayı farklı renk (per) bul
    // Renklere göre grupla
    const renkGruplari = {};
    const sayiGruplari = {};

    for (const tas of el) {
        if (tas.jokerMi) continue;
        const renk = tas.renk;
        const sayi = tas.sayi;

        if (!renkGruplari[renk]) renkGruplari[renk] = [];
        renkGruplari[renk].push(tas);

        if (!sayiGruplari[sayi]) sayiGruplari[sayi] = [];
        sayiGruplari[sayi].push(tas);
    }

    const kullanilanIds = new Set();

    // Serileri bul (aynı renk, ardışık sayılar)
    for (const renk of Object.keys(renkGruplari)) {
        const taslar = renkGruplari[renk].sort((a, b) => a.sayi - b.sayi);
        let seri = [taslar[0]];

        for (let i = 1; i < taslar.length; i++) {
            if (taslar[i].sayi === seri[seri.length - 1].sayi + 1) {
                seri.push(taslar[i]);
            } else if (taslar[i].sayi !== seri[seri.length - 1].sayi) {
                if (seri.length >= 3) {
                    const sonuc = GE.kombinasyonGecerliMi(seri, okeyTasi);
                    if (sonuc.gecerli) {
                        kombinasyonlar.push([...seri]);
                        seri.forEach(t => kullanilanIds.add(t.id));
                        toplamPuan += seri.reduce((t, s) => t + (s.jokerMi ? 0 : s.sayi), 0);
                    }
                }
                seri = [taslar[i]];
            }
        }
        if (seri.length >= 3) {
            const sonuc = GE.kombinasyonGecerliMi(seri, okeyTasi);
            if (sonuc.gecerli) {
                kombinasyonlar.push([...seri]);
                seri.forEach(t => kullanilanIds.add(t.id));
                toplamPuan += seri.reduce((t, s) => t + (s.jokerMi ? 0 : s.sayi), 0);
            }
        }
    }

    // Perleri bul (aynı sayı, farklı renk)
    for (const sayi of Object.keys(sayiGruplari)) {
        const taslar = sayiGruplari[sayi].filter(t => !kullanilanIds.has(t.id));
        const renkSet = new Set();
        const uniqueTaslar = [];
        for (const t of taslar) {
            if (!renkSet.has(t.renk)) {
                renkSet.add(t.renk);
                uniqueTaslar.push(t);
            }
        }
        if (uniqueTaslar.length >= 3) {
            const sonuc = GE.kombinasyonGecerliMi(uniqueTaslar, okeyTasi);
            if (sonuc.gecerli) {
                kombinasyonlar.push(uniqueTaslar);
                uniqueTaslar.forEach(t => kullanilanIds.add(t.id));
                toplamPuan += uniqueTaslar.reduce((t, s) => t + (s.jokerMi ? 0 : s.sayi), 0);
            }
        }
    }

    // Çift kontrolü (4+ çift)
    const ciftler = [];
    const sayilanIds = new Set();
    for (let i = 0; i < el.length; i++) {
        for (let j = i + 1; j < el.length; j++) {
            if (sayilanIds.has(el[i].id) || sayilanIds.has(el[j].id)) continue;
            if (!el[i].jokerMi && !el[j].jokerMi &&
                el[i].sayi === el[j].sayi && el[i].renk === el[j].renk) {
                ciftler.push([el[i], el[j]]);
                sayilanIds.add(el[i].id);
                sayilanIds.add(el[j].id);
            }
        }
    }

    if (ciftler.length >= 4) {
        return {
            yontem: 'cift',
            kombinasyonlar: ciftler.slice(0, 7),
            puan: 0
        };
    }

    if (toplamPuan >= esik && kombinasyonlar.length > 0) {
        return {
            yontem: 'seri',
            kombinasyonlar,
            puan: toplamPuan
        };
    }

    return null;
}

/**
 * Tur sonu kontrolü
 */
function turSonuKontrol(odaId) {
    const oda = odalar.get(odaId);
    if (!oda || !oda.oyun) return false;
    const oyun = oda.oyun;

    const turKontrol = GE.turSonuKontrol(
        oyun.oyuncular.map(o => ({ isim: o.isim, kalanTaslar: o.el, elAcildi: o.elAcildi })),
        oyun.istaka
    );

    if (turKontrol.bitti) {
        oyun.oyunBitti = true;

        // Puanları hesapla
        for (let i = 0; i < oyun.oyuncular.length; i++) {
            const o = oyun.oyuncular[i];
            if (turKontrol.kazanan && turKontrol.kazanan.isim === o.isim) {
                // 🚩 KAZANAN BONUSU: -100 puan
                o.puan -= 100;
            } else {
                const cezaObje = { kalanTaslar: o.el, elAcildi: o.elAcildi, izinVermedi: o.izinVermedi };
                const cezaSonuc = GE.cezaPuanHesapla(cezaObje, o.cifteGectiMi, oyun.okeyTasi);
                o.puan += cezaSonuc.ceza;
            }
        }

        io.to(odaId).emit('turSonu', {
            kazanan: turKontrol.kazanan,
            sebep: turKontrol.sebep,
            oyuncular: oyun.oyuncular.map(o => ({
                isim: o.isim,
                puan: o.puan,
                tasSayisi: o.el.length,
                elAcildi: o.elAcildi
            }))
        });
        herkeseDurumGonder(odaId);
        return true;
    }
    return false;
}


// ─── SOCKET.IO BAĞLANTILARI ──────────────────────────────

io.on('connection', (socket) => {
    console.log(`🔌 Bağlandı: ${socket.id}`);
    let oyuncuOdaId = null;
    let oyuncuIndex = -1;

    // ═══ LOBİ ═══
    socket.on('lobiKatil', ({ isim }) => {
        const odaId = uygunOdaBul();
        const oda = odalar.get(odaId);

        socket.join(odaId);
        oyuncuOdaId = odaId;
        oyuncuIndex = oda.oyuncular.length;

        oda.oyuncular.push({
            socketId: socket.id,
            isim: isim || `Oyuncu ${oyuncuIndex + 1}`
        });

        console.log(`👤 ${isim} lobiye katıldı (${odaId}), ${oda.oyuncular.length}/4`);

        // Lobi durumunu güncelle
        io.to(odaId).emit('lobiGuncelle', {
            oyuncular: oda.oyuncular.map(o => o.isim),
            sayi: oda.oyuncular.length,
            odaId
        });

        // 4 kişi tamamsa oyunu başlat
        if (oda.oyuncular.length === 4) {
            oda.basladiMi = true;
            const isimler = oda.oyuncular.map(o => o.isim);
            oda.oyun = oyunDurumuOlustur(isimler);

            console.log(`🎮 Oyun başladı! (${odaId})`);
            io.to(odaId).emit('oyunBasladi', { mesaj: 'Oyun başlıyor!' });

            // Her oyuncuya kendi durumunu gönder
            setTimeout(() => herkeseDurumGonder(odaId), 500);
        }
    });

    // ═══ TAŞ ÇEK ═══
    socket.on('tasCek', () => {
        const oda = odalar.get(oyuncuOdaId);
        if (!oda || !oda.oyun) return;
        const oyun = oda.oyun;

        if (oyun.aktifOyuncuIndex !== oyuncuIndex) return;
        if (oyun.faz !== 'cekme') return;
        if (oyun.istaka.length === 0) {
            socket.emit('bildirim', { mesaj: 'Istaka boş!', tip: '', sure: 2000 });
            return;
        }

        // Yandan al beklemesini iptal et
        if (oyun._yandanAlTimeout) {
            clearTimeout(oyun._yandanAlTimeout);
            oyun._yandanAlTimeout = null;
        }
        oyun.yandanAlBekleyen = -1;

        const cekilenTas = oyun.istaka.pop();
        oyun.oyuncular[oyuncuIndex].el.push(cekilenTas);
        oyun.faz = 'atma';

        oyuncuyaBildirimGonder(oyuncuOdaId, oyuncuIndex,
            `Taş çekildi: ${cekilenTas.jokerMi ? 'Joker ★' : cekilenTas.sayi + ' ' + cekilenTas.renk}`, '', 2000);

        herkeseDurumGonder(oyuncuOdaId);
    });

    // ═══ TAŞ AT ═══
    socket.on('tasAt', ({ tasId }) => {
        const oda = odalar.get(oyuncuOdaId);
        if (!oda || !oda.oyun) return;
        const oyun = oda.oyun;

        if (oyun.aktifOyuncuIndex !== oyuncuIndex) return;
        if (oyun.faz !== 'atma') return;

        const oyuncu = oyun.oyuncular[oyuncuIndex];

        // Zorunlu açma kontrolü
        if (oyun.zorunluAcma[oyuncuIndex] && !oyuncu.elAcildi) {
            socket.emit('bildirim', {
                mesaj: 'Yandan taş aldınız — önce elinizi açmanız gerekiyor!',
                tip: 'cifte-bildirim', sure: 3000
            });
            return;
        }

        const tasIndex = oyuncu.el.findIndex(t => t.id === tasId);
        if (tasIndex === -1) return;

        const atilanTas = oyuncu.el.splice(tasIndex, 1)[0];
        if (oyun.sonAtilanTas) oyun.atilanTaslar.push(oyun.sonAtilanTas);
        oyun.sonAtilanTas = atilanTas;
        oyun.sonTasAtanIndex = oyuncuIndex;

        oyuncu.sonAtilanTas = atilanTas;

        // Tur sonu kontrolü
        if (turSonuKontrol(oyuncuOdaId)) return;

        herkeseBildirimGonder(oyuncuOdaId,
            `${oyuncu.isim} taş attı: ${atilanTas.jokerMi ? 'Joker ★' : atilanTas.sayi + ' ' + atilanTas.renk}`, '', 2000);

        // Yandan alma akışı
        tasAtildiSonrasi(oyuncuOdaId, atilanTas, oyuncuIndex);
    });

    // ═══ YANDAN AL ═══
    socket.on('yandanAl', () => {
        const oda = odalar.get(oyuncuOdaId);
        if (!oda || !oda.oyun) return;
        const oyun = oda.oyun;

        if (oyun.yandanAlBekleyen !== oyuncuIndex) return;

        // Timeout iptal
        if (oyun._yandanAlTimeout) {
            clearTimeout(oyun._yandanAlTimeout);
            oyun._yandanAlTimeout = null;
        }
        oyun.yandanAlBekleyen = -1;

        const atilanTas = oyun.izinTas;
        const atanIndex = oyun.izinAtanIndex;
        const oyuncu = oyun.oyuncular[oyuncuIndex];

        // ÇİFTE İLAN ETMİŞSE -> İzin istemeden direkt al
        if (oyuncu.cifteIlanEtti) {
            herkeseBildirimGonder(oyuncuOdaId,
                `${oyuncu.isim} çifte hakkıyla yandan taşı aldı!`, 'cifte-bildirim', 3000);

            // Taşı al
            oyuncu.el.push(atilanTas);
            oyun.sonAtilanTas = oyun.atilanTaslar.length > 0
                ? oyun.atilanTaslar[oyun.atilanTaslar.length - 1] : null;

            // Sıra oyuncuya geçer
            oyun.aktifOyuncuIndex = oyuncuIndex;
            oyun.faz = 'atma';

            herkeseDurumGonder(oyuncuOdaId);
            return;
        }

        // NORMAL DURUM -> İzin iste akışı başlat
        oyun.izinBekleniyor = true;
        oyun.izinIsteyenIndex = oyuncuIndex;

        const atanSocket = io.sockets.sockets.get(oda.oyuncular[atanIndex].socketId);
        if (atanSocket) {
            atanSocket.emit('izinIsteniyor', {
                isteyenIsim: oyun.oyuncular[oyuncuIndex].isim,
                tas: atilanTas
            });
        }

        herkeseBildirimGonder(oyuncuOdaId,
            `${oyun.oyuncular[oyuncuIndex].isim}, ${oyun.oyuncular[atanIndex].isim}'dan izin istiyor...`, '', 3000);

        // 10 saniye izin timeout
        oyun._izinTimeout = setTimeout(() => {
            if (oyun.izinBekleniyor) {
                // Zaman aşımı → izin vermiş sayılır
                izinVerIsle(oyuncuOdaId);
            }
        }, 10000);
    });

    // ═══ YANDAN AL PAS ═══
    socket.on('yandanAlPas', () => {
        const oda = odalar.get(oyuncuOdaId);
        if (!oda || !oda.oyun) return;
        const oyun = oda.oyun;

        if (oyun.yandanAlBekleyen !== oyuncuIndex) return;

        if (oyun._yandanAlTimeout) {
            clearTimeout(oyun._yandanAlTimeout);
            oyun._yandanAlTimeout = null;
        }
        oyun.yandanAlBekleyen = -1;

        siraIlerlet(oyuncuOdaId);
    });

    // ═══ İZİN VER ═══
    socket.on('izinVer', () => {
        const oda = odalar.get(oyuncuOdaId);
        if (!oda || !oda.oyun) return;
        const oyun = oda.oyun;

        if (!oyun.izinBekleniyor) return;
        if (oyun.izinAtanIndex !== oyuncuIndex) return; // Sadece atan verebilir

        if (oyun._izinTimeout) {
            clearTimeout(oyun._izinTimeout);
            oyun._izinTimeout = null;
        }

        izinVerIsle(oyuncuOdaId);
    });

    // ═══ İZİN REDDET ═══
    socket.on('izinReddet', () => {
        const oda = odalar.get(oyuncuOdaId);
        if (!oda || !oda.oyun) return;
        const oyun = oda.oyun;

        if (!oyun.izinBekleniyor) return;
        if (oyun.izinAtanIndex !== oyuncuIndex) return;

        if (oyun._izinTimeout) {
            clearTimeout(oyun._izinTimeout);
            oyun._izinTimeout = null;
        }

        oyun.izinBekleniyor = false;

        const atanOyuncu = oyun.oyuncular[oyuncuIndex];
        const isteyenOyuncu = oyun.oyuncular[oyun.izinIsteyenIndex];

        // Reddeden çifte geçer
        atanOyuncu.cifteGectiMi = true;
        atanOyuncu.izinVermedi = true;

        // İsteyen artık bu oyuncudan taş isteyemez
        isteyenOyuncu.yasakliOyuncular.push(oyuncuIndex);

        herkeseBannerGonder(oyuncuOdaId, `⚡ ${atanOyuncu.isim} ÇİFTE GEÇTİ!`, '#c084fc');
        herkeseBildirimGonder(oyuncuOdaId,
            `${atanOyuncu.isim} izin vermedi — çifte geçti! Cezaları 2 katına çıkacak.`, 'cifte-bildirim', 4000);

        siraIlerlet(oyuncuOdaId);
    });

    // ═══ EL AÇ ═══
    socket.on('elAc', ({ slotlar }) => {
        const oda = odalar.get(oyuncuOdaId);
        if (!oda || !oda.oyun) return;
        const oyun = oda.oyun;

        if (oyun.aktifOyuncuIndex !== oyuncuIndex) return;
        if (oyun.faz !== 'atma') return;

        const oyuncu = oyun.oyuncular[oyuncuIndex];
        if (oyuncu.elAcildi) {
            socket.emit('bildirim', { mesaj: 'Eliniz zaten açık!', tip: '', sure: 2000 });
            return;
        }

        const esik = oyuncu.elAcmaEsigi || GE.VARSAYILAN_ESIK;

        // FİZİKSEL DİZİLİM KONTROLÜ (Bugfix: Oyuncunun dizdiği grupları baz al)
        const acmaSonucu = GE.elAcmaKontrol(slotlar, oyun.okeyTasi, esik);

        if (!acmaSonucu) {
            socket.emit('bildirim', {
                mesaj: `El açılamıyor. Minimum ${esik} puan ve geçerli perler gerekiyor. Gruplar arasında boşluk (null) bıraktığınızdan emin olun.`,
                tip: '', sure: 4000
            });
            return;
        }

        oyuncu.elAcildi = true;
        oyuncu.acilmisKombs = acmaSonucu.kombinasyonlar;
        oyuncu.elAcmaYontemi = acmaSonucu.yontem; // 'seri' veya 'cift'

        // Zorunlu açma yerine getirildi — zamanlayıcıyı durdur
        if (oyun.zorunluAcma[oyuncuIndex]) {
            zorunluAcmaZamanlayicisiDurdur(oyuncuOdaId);
            delete oyun.zorunluAcma[oyuncuIndex];
            delete oyun.zorunluAcmaYandanTas[oyuncuIndex];
        }

        // Açılan taşları elden çıkar
        const acilanIdler = new Set();
        for (const komb of acmaSonucu.kombinasyonlar) {
            for (const tas of komb) acilanIdler.add(tas.id);
        }
        oyuncu.el = oyuncu.el.filter(t => !acilanIdler.has(t.id));
        oyuncu.kalanTaslar = oyuncu.el;

        // Kafa atma kontrolü
        if (acmaSonucu.yontem === 'seri') {
            const kafaAtma = GE.kafaAtmaKontrol(acmaSonucu.puan);
            oyuncu.puan += kafaAtma.bonus;
            if (kafaAtma.durum === 'kafa') {
                herkeseBannerGonder(oyuncuOdaId, `${oyuncu.isim}: 🎯 KAFA ATTI! -100`, '#4ade80');
            } else if (kafaAtma.durum === 'ciftKafa') {
                herkeseBannerGonder(oyuncuOdaId, `${oyuncu.isim}: 🔥 ÇİFT KAFA! -200`, '#fbbf24');
            }
        } else if (acmaSonucu.yontem === 'cift') {
            const ciftSayisi = acmaSonucu.kombinasyonlar.length;
            const kafaAtma = GE.kafaAtmaKontrol(0, ciftSayisi);
            oyuncu.puan += kafaAtma.bonus;
            if (kafaAtma.durum !== 'normal') {
                herkeseBannerGonder(oyuncuOdaId,
                    `${oyuncu.isim}: ${kafaAtma.durum === 'kafa' ? '🎯 KAFA!' : '🔥 ÇİFT KAFA!'}`, '#f0c040');
            }
        }

        herkeseBildirimGonder(oyuncuOdaId, `${oyuncu.isim} el açtı!`, '', 3000);
        herkeseDurumGonder(oyuncuOdaId);
    });

    // ═══ ÇİFTE İLAN ═══
    socket.on('cifteIlan', () => {
        const oda = odalar.get(oyuncuOdaId);
        if (!oda || !oda.oyun) return;
        const oyun = oda.oyun;

        const oyuncu = oyun.oyuncular[oyuncuIndex];
        if (oyuncu.cifteIlanEtti) {
            socket.emit('bildirim', { mesaj: 'Zaten çifte ilan ettiniz!', tip: '', sure: 2000 });
            return;
        }

        const sonuc = GE.cifteIlanEt(oyuncu, oyun.oyuncular);
        if (sonuc.basarili) {
            oyuncu.cifteIlanEtti = true;

            herkeseBannerGonder(oyuncuOdaId, `⚡ ${oyuncu.isim}: ÇİFTE GİDİYOR!`, '#c084fc');
            herkeseBildirimGonder(oyuncuOdaId,
                `${oyuncu.isim} çifte ilan etti! El açma eşiği 101'e yükseldi.`, 'cifte-bildirim', 4000);

            herkeseDurumGonder(oyuncuOdaId);
        } else {
            socket.emit('bildirim', { mesaj: sonuc.mesaj, tip: '', sure: 2000 });
        }
    });

    // ═══ TAŞ İŞLE ═══
    // tasIsle: { tileId, meldId }      — seri/per açıcıya tek taş
    //          { tileId, tileId2, meldId } — çift açıcıya iki taş
    socket.on('tasIsle', ({ tileId, tileId2, meldId }) => {
        const oda = odalar.get(oyuncuOdaId);
        if (!oda || !oda.oyun) return;
        const oyun = oda.oyun;

        if (oyun.aktifOyuncuIndex !== oyuncuIndex) return;
        if (oyun.faz !== 'atma') return;

        const oyuncu = oyun.oyuncular[oyuncuIndex];
        if (!oyuncu.elAcildi) {
            socket.emit('bildirim', { mesaj: 'Önce elinizi açmanız gerekiyor!', tip: '', sure: 2000 });
            return;
        }

        // ── meldId parse ──
        const parts = String(meldId).split(':');
        if (parts.length !== 2) {
            socket.emit('bildirim', { mesaj: 'Geçersiz meldId.', tip: '', sure: 2000 });
            return;
        }
        const hedefOyuncuIndex = parseInt(parts[0], 10);
        const kombIndex = parseInt(parts[1], 10);

        const hedefOyuncu = oyun.oyuncular[hedefOyuncuIndex];
        if (!hedefOyuncu || !hedefOyuncu.elAcildi) {
            socket.emit('bildirim', { mesaj: 'Hedef oyuncu elini açmamış!', tip: '', sure: 2000 });
            return;
        }

        const hedefYontem = hedefOyuncu.elAcmaYontemi || 'seri';

        // ── ÇİFT AÇICIYA İŞLEME ──
        if (hedefYontem === 'cift') {
            if (!tileId2) {
                socket.emit('bildirim', { mesaj: 'Çift açıcıya işlemek için iki taş seçmelisiniz!', tip: '', sure: 3000 });
                return;
            }
            if (tileId === tileId2) {
                socket.emit('bildirim', { mesaj: 'İki farklı taş seçmelisiniz!', tip: '', sure: 2000 });
                return;
            }
            const tas1 = oyuncu.el.find(t => t.id === tileId);
            const tas2 = oyuncu.el.find(t => t.id === tileId2);
            if (!tas1 || !tas2) return;

            const sonuc = GE.ciftIslenebilirMi(tas1, tas2, hedefOyuncu.acilmisKombs);
            if (sonuc.islenebilir) {
                // ID tabanlı filtreleme — sıra bağımsız
                oyuncu.el = oyuncu.el.filter(t => t.id !== tileId && t.id !== tileId2);
                oyuncu.kalanTaslar = oyuncu.el;
                hedefOyuncu.acilmisKombs = sonuc.yeniKombs;

                herkeseBildirimGonder(oyuncuOdaId, `${oyuncu.isim} çift işledi!`, '', 2000);
                herkeseDurumGonder(oyuncuOdaId);
                if (oyuncu.el.length === 0) turSonuKontrol(oyuncuOdaId);
            } else {
                socket.emit('bildirim', { mesaj: sonuc.sebep, tip: '', sure: 2000 });
            }
            return;
        }

        // ── SERİ/PER AÇICIYA TEK TAŞ — applyAddTileToMeld (authoritative) ──
        const sonuc = GE.applyAddTileToMeld(oyun, oyuncuIndex, tileId, meldId);

        if (sonuc.basarili) {
            // Yeni state'i uygula
            oyun.oyuncular = sonuc.yeniState.oyuncular;

            herkeseBildirimGonder(oyuncuOdaId, `${oyuncu.isim} taş işledi!`, '', 2000);
            herkeseDurumGonder(oyuncuOdaId);

            if (oyun.oyuncular[oyuncuIndex].el.length === 0) {
                turSonuKontrol(oyuncuOdaId);
            }
        } else {
            socket.emit('bildirim', { mesaj: sonuc.hata, tip: '', sure: 2000 });
        }
    });


    // ═══ BAĞLANTI KESİLDİ ═══
    socket.on('disconnect', () => {
        console.log(`❌ Bağlantı kesildi: ${socket.id}`);
        if (oyuncuOdaId) {
            const oda = odalar.get(oyuncuOdaId);
            if (oda && !oda.basladiMi) {
                // Lobiden çıkar
                oda.oyuncular = oda.oyuncular.filter(o => o.socketId !== socket.id);
                io.to(oyuncuOdaId).emit('lobiGuncelle', {
                    oyuncular: oda.oyuncular.map(o => o.isim),
                    sayi: oda.oyuncular.length,
                    odaId: oyuncuOdaId
                });
                if (oda.oyuncular.length === 0) {
                    odalar.delete(oyuncuOdaId);
                }
            } else if (oda && oda.basladiMi) {
                // Oyun sırasında ayrılma
                io.to(oyuncuOdaId).emit('bildirim', {
                    mesaj: `${oda.oyuncular[oyuncuIndex]?.isim || 'Bir oyuncu'} oyundan ayrıldı!`,
                    tip: 'cifte-bildirim', sure: 5000
                });
            }
        }
    });
});

// ─── İZİN VER İŞLEMLERİ ──────────────────────────────────

function izinVerIsle(odaId) {
    const oda = odalar.get(odaId);
    if (!oda || !oda.oyun) return;
    const oyun = oda.oyun;

    oyun.izinBekleniyor = false;
    oyun.yandanAlBekleyen = -1; // Yandan alma şansı kapandı
    const isteyenIndex = oyun.izinIsteyenIndex;
    const isteyen = oyun.oyuncular[isteyenIndex];
    const atilanTas = oyun.izinTas;

    // Taşı al
    isteyen.el.push(atilanTas);
    oyun.sonAtilanTas = oyun.atilanTaslar.length > 0
        ? oyun.atilanTaslar[oyun.atilanTaslar.length - 1] : null;

    // Çifte gitmiyorsa açmak ZORUNLU
    if (!isteyen.cifteIlanEtti) {
        oyun.zorunluAcma[isteyenIndex] = true;
        oyun.zorunluAcmaYandanTas[isteyenIndex] = atilanTas; // Ceza için sakla

        // 30 saniye zamanlayıcı başlat
        zorunluAcmaZamanlayicisiBaslat(odaId, isteyenIndex);
    }

    // Sıra isteyen oyuncuya geçer
    oyun.aktifOyuncuIndex = isteyenIndex;
    oyun.faz = 'atma';

    herkeseBildirimGonder(odaId,
        `İzin verildi! ${isteyen.isim} taşı aldı${!isteyen.cifteIlanEtti ? ' — 30 saniye içinde el açmak ZORUNLU!' : ''}`, 'cifte-bildirim', 3000);

    herkeseDurumGonder(odaId);
}

// ─── SUNUCU BAŞLAT ───────────────────────────────────────

server.listen(PORT, () => {
    console.log(`\n🎲 81 Okey Multiplayer Sunucu`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`   4 oyuncu bekleniyor...\n`);
});
