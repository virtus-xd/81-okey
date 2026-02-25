/**
 * 81 Okey — Bot AI (Kural Tabanlı)
 * 
 * Basit ama akıllı bot oyuncu. Rastgele değil, kural tabanlı öncelik sistemiyle oynar.
 * Öncelik: kombinasyonu tamamla → puan yükselt → gereksiz taşı at
 */

(function () {
    'use strict';

    const GE = window.GameEngine;

    /**
     * Bot'un elindeki taşları analiz eder ve mevcut/potansiyel kombinasyonları bulur.
     * @param {Array} el - Bot'un elindeki taşlar
     * @param {Object} okeyTasi - Okey taşı tanımı
     * @returns {Object} Analiz sonucu
     */
    function elAnaliz(el, okeyTasi) {
        const analiz = {
            ciftler: [],       // Mevcut çiftler
            seriler: [],       // Mevcut/potansiyel seriler
            perler: [],        // Mevcut/potansiyel perler
            tekTaslar: [],     // Hiçbir gruba girmeyen taşlar
            jokerler: []       // Joker taşlar
        };

        // Joker (wildcard) ve normal taşları ayır
        const normallar = [];
        for (const tas of el) {
            // SADECE Gerçek Okey wild card'dır
            const isWildCard = !tas.jokerMi && (okeyTasi && tas.sayi === okeyTasi.sayi && tas.renk === okeyTasi.renk);

            if (isWildCard) {
                analiz.jokerler.push(tas);
            } else {
                // Sahte Okey (Joker), okeyin değerini ve rengini alır (normal taş gibi davranır)
                if (tas.jokerMi) {
                    normallar.push({
                        ...tas,
                        sayi: okeyTasi.sayi,
                        renk: okeyTasi.renk
                    });
                } else {
                    normallar.push(tas);
                }
            }
        }

        // Renk bazında grupla (seri tespiti için)
        const renkGruplari = {};
        for (const tas of normallar) {
            if (!renkGruplari[tas.renk]) renkGruplari[tas.renk] = [];
            renkGruplari[tas.renk].push(tas);
        }

        // Sayı bazında grupla (per tespiti için)
        const sayiGruplari = {};
        for (const tas of normallar) {
            if (!sayiGruplari[tas.sayi]) sayiGruplari[tas.sayi] = [];
            sayiGruplari[tas.sayi].push(tas);
        }

        // Çift tespiti (aynı sayı + aynı renk)
        const ciftKullanilan = new Set();
        for (const tas of normallar) {
            if (ciftKullanilan.has(tas.id)) continue;
            const esler = normallar.filter(t => t.id !== tas.id && t.sayi === tas.sayi && t.renk === tas.renk && !ciftKullanilan.has(t.id));
            if (esler.length > 0) {
                analiz.ciftler.push([tas, esler[0]]);
                ciftKullanilan.add(tas.id);
                ciftKullanilan.add(esler[0].id);
            }
        }

        // Seri tespiti (aynı renk ardışık)
        for (const renk of Object.keys(renkGruplari)) {
            const taslar = renkGruplari[renk].sort((a, b) => a.sayi - b.sayi);
            let mevcut = [taslar[0]];
            for (let i = 1; i < taslar.length; i++) {
                if (taslar[i].sayi === mevcut[mevcut.length - 1].sayi + 1) {
                    mevcut.push(taslar[i]);
                } else if (taslar[i].sayi === mevcut[mevcut.length - 1].sayi) {
                    // Aynı sayı, atla (çift olabilir)
                    continue;
                } else {
                    if (mevcut.length >= 2) analiz.seriler.push([...mevcut]);
                    mevcut = [taslar[i]];
                }
            }
            if (mevcut.length >= 2) analiz.seriler.push([...mevcut]);
        }

        // Per tespiti (aynı sayı farklı renk)
        for (const sayi of Object.keys(sayiGruplari)) {
            const taslar = sayiGruplari[sayi];
            const benzersizRenk = [];
            const gorulenRenk = new Set();
            for (const tas of taslar) {
                if (!gorulenRenk.has(tas.renk)) {
                    benzersizRenk.push(tas);
                    gorulenRenk.add(tas.renk);
                }
            }
            if (benzersizRenk.length >= 2) {
                analiz.perler.push(benzersizRenk);
            }
        }

        // Tek taşları bul (hiçbir potansiyel gruba dahil olmayanlar)
        const grupluIds = new Set();
        for (const seri of analiz.seriler) seri.forEach(t => grupluIds.add(t.id));
        for (const per of analiz.perler) per.forEach(t => grupluIds.add(t.id));
        for (const cift of analiz.ciftler) cift.forEach(t => grupluIds.add(t.id));

        for (const tas of normallar) {
            if (!grupluIds.has(tas.id)) {
                analiz.tekTaslar.push(tas);
            }
        }

        return analiz;
    }

    /**
     * Bot'un atacağı en uygun taşı belirler.
     * Strateji: Hiçbir kombinasyona katkısı olmayan, en düşük değerli taşı at.
     * 
     * @param {Array} el - Bot'un eli
     * @param {Object} okeyTasi - Okey taşı
     * @returns {Object} Atılacak taş
     */
    function enIyiTasAt(el, okeyTasi) {
        if (el.length === 0) return null;
        if (el.length === 1) return el[0];

        const analiz = elAnaliz(el, okeyTasi);

        // 1. Önce tek (gereksiz) taşları kontrol et — en düşük değerlisini at
        if (analiz.tekTaslar.length > 0) {
            analiz.tekTaslar.sort((a, b) => a.sayi - b.sayi);
            return analiz.tekTaslar[0];
        }

        // 2. Tek taş yoksa, en kısa potansiyel grupta olan en düşük değerli taşı at
        // 2'li serilerden birini boz (3'lü olma ihtimali en düşük olanı)
        if (analiz.seriler.length > 0) {
            // 2'li serileri bul
            const ikiliSeriler = analiz.seriler.filter(s => s.length === 2);
            if (ikiliSeriler.length > 0) {
                // En düşük puanlı 2'li seriden, en düşük taşı at
                ikiliSeriler.sort((a, b) => {
                    const puanA = a.reduce((t, tas) => t + tas.sayi, 0);
                    const puanB = b.reduce((t, tas) => t + tas.sayi, 0);
                    return puanA - puanB;
                });
                return ikiliSeriler[0][0]; // İlk taşı at
            }
        }

        // 3. 2'li perlerden birini boz
        if (analiz.perler.length > 0) {
            const ikiliPerler = analiz.perler.filter(p => p.length === 2);
            if (ikiliPerler.length > 0) {
                ikiliPerler.sort((a, b) => a[0].sayi - b[0].sayi);
                return ikiliPerler[0][0];
            }
        }

        // 4. Son çare: joker hariç en düşük değerli taşı at
        const jokerHarici = el.filter(t => !t.jokerMi);
        if (jokerHarici.length > 0) {
            jokerHarici.sort((a, b) => a.sayi - b.sayi);
            return jokerHarici[0];
        }

        // 5. Sadece joker kaldıysa, jokeri at
        return el[0];
    }

    /**
     * Bot'un ıstakadan mı yoksa atılan taştan mı çekeceğine karar verir.
     * 
     * @param {Object|null} atilanTas - En son atılan taş (varsa)
     * @param {Array} el - Bot'un eli
     * @param {Object} okeyTasi - Okey taşı
     * @returns {string} 'istaka' veya 'atilan'
     */
    function cekmeKarari(atilanTas, el, okeyTasi) {
        if (!atilanTas) return 'istaka';

        // Atılan taş mevcut bir kombinasyonu tamamlıyor mu kontrol et
        const analiz = elAnaliz(el, okeyTasi);

        // Seri tamamlama: Atılan taş bir serinin ucuna ekleniyor mu?
        for (const seri of analiz.seriler) {
            if (seri.length >= 2) {
                const sayilar = seri.map(t => t.sayi).sort((a, b) => a - b);
                const enDusuk = sayilar[0];
                const enYuksek = sayilar[sayilar.length - 1];
                if (atilanTas.renk === seri[0].renk) {
                    if (atilanTas.sayi === enDusuk - 1 && atilanTas.sayi >= 1) return 'atilan';
                    if (atilanTas.sayi === enYuksek + 1 && atilanTas.sayi <= 13) return 'atilan';
                }
            }
        }

        // Per tamamlama: Atılan taş bir peri tamamlıyor mu?
        for (const per of analiz.perler) {
            if (per.length >= 2 && per[0].sayi === atilanTas.sayi) {
                const renkler = new Set(per.map(t => t.renk));
                if (!renkler.has(atilanTas.renk)) return 'atilan';
            }
        }

        // Çift tamamlama
        for (const tas of el) {
            if (!tas.jokerMi && tas.sayi === atilanTas.sayi && tas.renk === atilanTas.renk) {
                return 'atilan';
            }
        }

        return 'istaka';
    }

    /**
 * Bot'un el açıp açamayacağına karar verir.
 * @param {Array} el - Bot'un eli  
 * @param {number} esik - El açma eşiği
 * @param {Object} okeyTasi - Okey taşı
 * @param {boolean} [alreadyOpened=false] - Daha önce el açıldı mı?
 * @param {string} [forcedMethod=null] - İlk açıştaki yöntem ('seri' veya 'cift')
 * @returns {Object|null} Açılacak kombinasyonlar veya null
 */
    function elAcmaKarari(el, esik, okeyTasi, alreadyOpened = false, forcedMethod = null) {
        const analiz = elAnaliz(el, okeyTasi);

        // Yöntem 1: Çift açma
        if (!alreadyOpened || forcedMethod === 'cift') {
            if (alreadyOpened && forcedMethod === 'cift' && analiz.ciftler.length > 0) {
                return {
                    yontem: 'cift',
                    kombinasyonlar: analiz.ciftler
                };
            }
            if (!alreadyOpened && analiz.ciftler.length >= 4) {
                return {
                    yontem: 'cift',
                    kombinasyonlar: analiz.ciftler.slice(0, Math.min(analiz.ciftler.length, 7))
                };
            }
        }

        // Yöntem 2: Seri/per ile açma
        if (!alreadyOpened || forcedMethod === 'seri') {
            const gecerliKombs = [];
            let toplamPuan = 0;

            // 3+ uzunluğundaki serileri ekle
            for (const seri of analiz.seriler) {
                if (seri.length >= 3) {
                    try {
                        const sonuc = GE.kombinasyonGecerliMi(seri, okeyTasi);
                        if (sonuc.gecerli) {
                            gecerliKombs.push(seri);
                            toplamPuan += seri.reduce((t, tas) => t + (tas.jokerMi ? 0 : tas.sayi), 0);
                        }
                    } catch (e) { /* geçersiz, atla */ }
                }
            }

            // 3+ uzunluğundaki perleri ekle
            for (const per of analiz.perler) {
                if (per.length >= 3) {
                    // Per taşları zaten seri kombinasyonlarda kullanılmış olabilir
                    const kullanilanIds = new Set();
                    for (const komb of gecerliKombs) komb.forEach(t => kullanilanIds.add(t.id));
                    const filtrelenmis = per.filter(t => !kullanilanIds.has(t.id));
                    if (filtrelenmis.length >= 3) {
                        try {
                            const sonuc = GE.kombinasyonGecerliMi(filtrelenmis, okeyTasi);
                            if (sonuc.gecerli) {
                                gecerliKombs.push(filtrelenmis);
                                toplamPuan += filtrelenmis.reduce((t, tas) => t + (tas.jokerMi ? 0 : tas.sayi), 0);
                            }
                        } catch (e) { /* geçersiz, atla */ }
                    }
                }
            }

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

        return null;
    }

    /**
     * Bot'un çifte gitme kararı
     * @param {Array} el - Bot'un eli
     * @param {number} mevcutPuan - Bot'un mevcut puanı
     * @param {Object} okeyTasi - Okey taşı
     * @returns {boolean} Çifte ilan edilecek mi
     */
    function cifteKarari(el, mevcutPuan, okeyTasi) {
        const analiz = elAnaliz(el, okeyTasi);

        // Çifte gitme: El çok güçlüyse (5+ çift veya 100+ potansiyel puan)
        if (analiz.ciftler.length >= 5) return true;

        let potansiyelPuan = 0;
        for (const seri of analiz.seriler) {
            if (seri.length >= 3) {
                potansiyelPuan += seri.reduce((t, tas) => t + tas.sayi, 0);
            }
        }
        for (const per of analiz.perler) {
            if (per.length >= 3) {
                potansiyelPuan += per.reduce((t, tas) => t + tas.sayi, 0);
            }
        }

        return potansiyelPuan >= 120;
    }

    /**
     * Bot'un izin verme kararı (çifte akışı)
     * @param {Array} el - Bot'un eli
     * @param {number} esik - Mevcut açma eşiği
     * @param {Object} okeyTasi - Okey taşı
     * @returns {boolean} İzin verilecek mi
     */
    function izinKarari(el, esik, okeyTasi) {
        // Eğer kendimiz de açabiliyorsak izin ver
        const acmaSonucu = elAcmaKarari(el, esik, okeyTasi);
        if (acmaSonucu) return true;

        // Çok yakınsak (%80+) izin verme (çifte geç)
        const analiz = elAnaliz(el, okeyTasi);
        let potansiyel = 0;
        for (const seri of analiz.seriler) {
            if (seri.length >= 3) potansiyel += seri.reduce((t, tas) => t + tas.sayi, 0);
        }
        for (const per of analiz.perler) {
            if (per.length >= 3) potansiyel += per.reduce((t, tas) => t + tas.sayi, 0);
        }

        // Eşiğin %70'inden azsa izin ver (açma şansımız düşük)
        return potansiyel < esik * 0.7;
    }

    // Global export
    window.BotAI = {
        elAnaliz,
        enIyiTasAt,
        cekmeKarari,
        elAcmaKarari,
        cifteKarari,
        izinKarari
    };

})();
