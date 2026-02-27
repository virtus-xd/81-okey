/**
 * 81 Okey — Oyun Kontrolcüsü (Game Controller)
 * 
 * Çifte Gitme Kuralları (Kesin):
 * 
 * A) SERİ GİDEN OYUNCU (çifte ilan ETMEMİŞ) yandan taş almak isterse:
 *    1. Taşı atan oyuncuya sorar: "Alabilir miyim?"
 *    2. Atan oyuncu "Alabilirsin" derse → taşı alır, AMA ELİNİ AÇMAK ZORUNDA
 *    3. Atan oyuncu "Alamazsın" derse → taşı ALAMAZ,
 *       ve atan oyuncu ÇİFTE GEÇMİŞ olur (cezaları 2x)
 * 
 * B) ÇİFTE GİDEN OYUNCU (çifte ilan ETMİŞ) yandan taş almak isterse:
 *    1. İzin istemesine GEREK YOK — serbestçe alır
 *    2. Açmak zorunda DEĞİL — taşı alıp devam edebilir
 *    3. İşlek taş hariç her taşı alabilir
 */

(function () {
    'use strict';

    const GE = window.GameEngine;
    const R = window.Renderer;
    const Bot = window.BotAI;
    const Ses = window.SesEfekt;

    // ─── OYUN DURUMU ─────────────────────────────────────────
    const durum = {
        oyuncular: [],
        istaka: [],
        atilanTaslar: [],
        sonAtilanTas: null,
        sonTasAtanIndex: -1,
        gostergeTasi: null,
        okeyTasi: null,
        aktifOyuncuIndex: 0,    // 0=Güney(siz), 1=Doğu, 2=Kuzey, 3=Batı
        tur: 1,
        faz: 'cekme',           // 'cekme' | 'atma' | 'bekleme'
        seciliTasId: null,
        zamanlayiciId: null,
        kalanSure: 30,
        oyunBitti: false,
        izinBekleniyor: false,
        oyuncuIsimleri: ['Sen', 'Bot-Doğu', 'Bot-Kuzey', 'Bot-Batı']
    };

    // 28 slotluk raf durumu (yerel dizilim için - sadece insan oyuncu için)
    let rafSlots = new Array(28).fill(null);

    let _lastHandCount = 0; // El sayısı takibi için


    // ─── OYUN BAŞLATMA ──────────────────────────────────────
    function oyunBaslat() {
        Ses.initAudio();

        const dagitim = GE.tasDagit(durum.oyuncuIsimleri);

        durum.oyuncular = durum.oyuncuIsimleri.map((isim, i) => ({
            isim,
            el: dagitim.eller[isim],
            puan: 0,
            elAcildi: false,
            acilmisKombs: [],
            kalanTaslar: dagitim.eller[isim],
            izinVermedi: false,
            cifteIlanEtti: false,
            cifteGectiMi: false,
            elAcmaEsigi: GE.VARSAYILAN_ESIK,
            botMu: i > 0,
            sonAtilanTas: null,
            yasakliOyuncular: []    // Bu oyuncunun taş isteyemeyeceği oyuncu indeksleri
        }));

        durum.istaka = dagitim.istaka;

        const gosterge = GE.gostergeTasBelirle(durum.istaka);
        durum.gostergeTasi = gosterge.gostergeTasi;
        durum.okeyTasi = gosterge.okeyTasi;

        durum.aktifOyuncuIndex = 0;
        durum.faz = 'cekme';
        durum.oyunBitti = false;
        durum.tur = 1;
        durum.sonAtilanTas = null;
        durum.sonTasAtanIndex = -1;
        durum.atilanTaslar = [];
        durum.seciliTasId = null;
        durum.izinBekleniyor = false;
        durum.zorunluAcma = false;

        R.cifteGostergeGuncelle(false);

        // Rafı sıfırla ve doldur
        rafSlotlariReconcile(durum.oyuncular[0].el);

        tumEkraniGuncelle(true);
        zamanlayiciBaşlat();

        R.bildirimGoster('Oyun başladı! Taşlarınız dağıtıldı.', '', 3000);
        R.bildirimGoster(`Gösterge: ${durum.gostergeTasi.jokerMi ? 'Joker' : durum.gostergeTasi.sayi + ' ' + durum.gostergeTasi.renk} — Okey: ${durum.okeyTasi.jokerMi ? 'Joker' : durum.okeyTasi.sayi + ' ' + durum.okeyTasi.renk}`, '', 4000);

        butonlariGuncelle();
    }

    // ─── EKRAN GÜNCELLEME ──────────────────────────────────
    function tumEkraniGuncelle(animasyon = false) {
        const ben = durum.oyuncular[0];

        // El sayısı değiştiyse (çekme/atma/işleme) reconcile et
        if (ben.el.length !== _lastHandCount) {
            rafSlotlariReconcile(ben.el);
            _lastHandCount = ben.el.length;
        }

        R.eliRenderEt(rafSlots, document.getElementById('tas-rafi'), durum.okeyTasi, {
            seciliTasId: durum.seciliTasId,
            animasyon,
            onTasClick: (tas, slotIdx) => tasaTiklandi(tas, slotIdx),
            onSlotDrop: tasSuruklendiRafa
        });

        // El puanını hesapla ve göster
        const elPuani = GE.elPuaniniHesapla(rafSlots, durum.okeyTasi);
        R.elPuaniGuncelle(elPuani);

        R.istakaRenderEt(durum.istaka.length, document.getElementById('istaka-yigini'));
        R.gostergeRenderEt(durum.gostergeTasi, durum.okeyTasi, document.getElementById('gosterge-alani'));
        R.atilanTasRenderEt(durum.sonAtilanTas, durum.okeyTasi, document.getElementById('atilan-tas-alani'));
        R.skorGuncelle(durum.oyuncular, durum.aktifOyuncuIndex);
        R.oyuncuPanelleriGuncelle(durum.oyuncular, durum.aktifOyuncuIndex);

        // Her oyuncunun köşesindeki atılan taş alanını güncelle
        R.oyuncuAtilanTasGuncelle(durum.oyuncular, durum.sonTasAtanIndex, durum.okeyTasi);

        const turEl = document.getElementById('tur-sayisi');
        if (turEl) turEl.textContent = durum.tur;

        // Açılmış kombinasyonları tüm oyuncu köşelerinde ve raf üstünde göster
        // İnsan oyuncu eli açıksa ve atma fazındaysa, taş işleme drop desteği ekle
        const islemAktif = ben.elAcildi && durum.faz === 'atma' && durum.aktifOyuncuIndex === 0;

        // ── Drag-over validasyon callback ──────────────────────────────────────────
        // renderer.js'e geçilir; blindly yeşil göstermek yerine gerçek kural kontrolü yapar.
        // dataTransfer.getData dragover sırasında çalışmaz (güvenlik kısıtı),
        // bu nedenle renderer _suruklenenTasId'yi module state olarak tutar ve buraya geçer.
        function dragOverValidate(tileId, kombTaslari) {
            const tas = ben.el.find(t => t.id === tileId);
            if (!tas) return false;
            const sonuc = GE.tasIslenebilirMi(tas, kombTaslari, durum.okeyTasi);
            return sonuc.islenebilir;
        }

        const isleSecenekler = islemAktif
            ? { onTasIsleDrop: tasIsle, onDragOverValidate: dragOverValidate }
            : {};

        ['guney', 'dogu', 'kuzey', 'bati'].forEach((poz, i) => {
            const container = document.getElementById(`acilmis-${poz}`);
            if (container && durum.oyuncular[i]) {
                R.acilmisKombRenderEt(durum.oyuncular[i].acilmisKombs, container, durum.okeyTasi, { ...isleSecenekler, oyuncuIndex: i });
            }
        });

        // Oyuncunun kendi açılmış kombinasyonlarını raf üstünde de göster
        const acilmisRaf = document.getElementById('acilmis-raf');
        if (acilmisRaf && durum.oyuncular[0]) {
            R.acilmisKombRenderEt(durum.oyuncular[0].acilmisKombs, acilmisRaf, durum.okeyTasi, { ...isleSecenekler, oyuncuIndex: 0 });
        }

        // Atılan taş tıklama (onclick ile sızıntı önleniyor)
        const sonAtilanEl = document.getElementById('son-atilan-tas');
        if (sonAtilanEl && durum.aktifOyuncuIndex === 0 && durum.faz === 'cekme') {
            sonAtilanEl.onclick = () => atilanTasCek();
        }

        // Istaka tıklama
        const istakaEl = document.getElementById('istaka-yigini');
        if (istakaEl) {
            istakaEl.onclick = () => {
                if (durum.aktifOyuncuIndex === 0 && durum.faz === 'cekme') {
                    istakadanCek();
                }
            };
        }

        butonlariGuncelle();
    }

    // ─── BUTON YÖNETİMİ ─────────────────────────────────────
    function butonlariGuncelle() {
        const benSirada = durum.aktifOyuncuIndex === 0 && !durum.oyunBitti;
        const cekFazi = durum.faz === 'cekme';
        const atFazi = durum.faz === 'atma';

        const cekBtn = document.getElementById('btn-cek');
        const atBtn = document.getElementById('btn-at');
        const acBtn = document.getElementById('btn-ac');
        const cifteBtn = document.getElementById('btn-cifte');

        if (cekBtn) cekBtn.disabled = !(benSirada && cekFazi);
        if (atBtn) atBtn.disabled = !(benSirada && atFazi && durum.seciliTasId !== null);
        if (acBtn) acBtn.disabled = !(benSirada && atFazi);
        if (cifteBtn) {
            const ben = durum.oyuncular[0];
            // Seri açmış oyuncu artık çifte ilan edemez — butonu gizle
            const seriActi = ben.elAcildi && (!ben.elAcmaYontemi || ben.elAcmaYontemi === 'seri');
            cifteBtn.style.display = seriActi ? 'none' : '';
            cifteBtn.disabled = durum.oyunBitti || ben.cifteIlanEtti;
        }
    }

    // ─── TAŞ ÇEKME ─────────────────────────────────────────
    function istakadanCek() {
        if (durum.faz !== 'cekme' || durum.aktifOyuncuIndex !== 0) return;
        if (durum.istaka.length === 0) {
            R.bildirimGoster('Istaka boş!', '', 2000);
            return;
        }

        const cekilenTas = durum.istaka.pop();
        durum.oyuncular[0].el.push(cekilenTas);
        durum.faz = 'atma';

        // Yandan alma şansı bitti
        yandanAlButonGizle();

        Ses.tasCek();
        R.bildirimGoster(`Taş çekildi: ${cekilenTas.jokerMi ? 'Joker ★' : cekilenTas.sayi + ' ' + cekilenTas.renk}`, '', 2000);
        tumEkraniGuncelle();
        zamanlayiciSifirla();
    }

    /** Oyuncu atılan taşı tıklarsa -> Yandan Al butonunu tetikle */
    function atilanTasCek() {
        if (durum.faz !== 'cekme' || durum.aktifOyuncuIndex !== 0) return;

        // Eğer buton aktifse, butona basılmış gibi davran (izni/kuralı işlet)
        const btn = document.getElementById('btn-yandan-al');
        if (btn && btn.style.display !== 'none' && !btn.disabled) {
            btn.click();
        }
    }

    // ─── TAŞ ATMA ──────────────────────────────────────────
    function tasAt(tasId) {
        if (durum.faz !== 'atma') return;

        // Zorunlu açma kontrolü: yandan aldıysan ve çifte değilsen önce açmalısın
        if (durum.zorunluAcma && !durum.oyuncular[0].elAcildi) {
            R.bildirimGoster('Yandan taş aldınız — önce elinizi açmanız gerekiyor! ("El Aç" butonuna basın)', 'cifte-bildirim', 3000);
            return;
        }

        const ben = durum.oyuncular[0];
        const tasIndex = ben.el.findIndex(t => t.id === tasId);
        if (tasIndex === -1) return;

        const atilanTas = ben.el.splice(tasIndex, 1)[0];

        // --- İŞLEK TAŞ CEZASI (100 PUAN) ---
        try {
            const tümAçılmışKomblar = durum.oyuncular.flatMap(o => o.acilmisKombs);
            const islekSonuc = GE.islerTasBelirle(atilanTas, tümAçılmışKomblar, durum.okeyTasi);

            if (islekSonuc.islekMi) {
                ben.puan += 100;
                R.bildirimGoster(`⚠️ İŞLEK TAŞ ATTINIZ! +100 Ceza Puanı.`, 'cifte-bildirim', 4000);
                console.log(`[PENALTY] Player threw playable tile ${atilanTas.id}, +100 pts.`);
            }
        } catch (err) {
            console.error("İşlek kontrolü hatası:", err);
        }

        if (durum.sonAtilanTas) durum.atilanTaslar.push(durum.sonAtilanTas);
        durum.sonAtilanTas = atilanTas;
        durum.sonTasAtanIndex = 0;
        durum.seciliTasId = null;

        // Oyuncunun kişisel atılan taş kaydı
        ben.sonAtilanTas = atilanTas;

        Ses.tasAt();

        // Tur sonu kontrolü
        if (turSonuMu()) return;

        // Taş atıldıktan sonra: yandan alma akışını kontrol et
        tasAtildiSonrasi(atilanTas, 0);
    }

    /**
     * Bir taş atıldıktan sonra yandan alma akışını yönetir.
     * KURAL: SADECE sıradaki oyuncu (atanIndex+1)%4 taşı alabilir.
     * Diğer oyuncuların taş alma hakkı yoktur.
     */
    function tasAtildiSonrasi(atilanTas, atanIndex) {
        const yandakiIndex = (atanIndex + 1) % 4;
        const yandaki = durum.oyuncular[yandakiIndex];

        // ÖNCELİK 1: Yandaki çifte ilan ettiyse → serbestçe alır (veya seçim yapar)
        if (yandaki.cifteIlanEtti) {
            if (cifteIlanliYandanAlma(atilanTas, atanIndex, yandakiIndex)) {
                return;
            } else {
                // Eğer çifte ilan etmiş ama alamıyorsa (ör. işlek), sıra doğrudan geçer
                siraIlerlet();
                tumEkraniGuncelle();
                return;
            }
        }

        // ÖNCELİK 2: Yandaki oyuncu seri gidiyor → normal sıra, isterse alır

        // KURAL: Eğer yandaki oyuncu daha önce bu oyuncudan taş istediğinde reddedildiyse (yasaklıysa)
        // ve kendisi ÇİFTE İLAN ETMEDİYSE -> Bir daha taş isteyemez/alamaz.
        if (yandaki.yasakliOyuncular.includes(atanIndex) && !yandaki.cifteIlanEtti) {
            // Yasaklı olduğu için pas geçer
            if (yandakiIndex === 0) {
                R.bildirimGoster(`${durum.oyuncular[atanIndex].isim} size yasaklı! (Çifte gitmediğiniz sürece alamazsınız)`, '', 3000);
            }
            siraIlerlet();
            tumEkraniGuncelle();
            return;
        }

        // İnsan oyuncuysa "Yandan Al" butonu göster
        if (yandakiIndex === 0) {
            // İNSAN OYUNCU — sıra sende, yandan al seçeneğini göster
            yandanAlSecenekGoster(atilanTas, atanIndex);
            return;
        }

        // BOT — yandan alma kararını burada ver
        botYandanAlmaKarari(atilanTas, atanIndex, yandakiIndex);
    }

    /**
     * Bot'un yandan taş alma kararını verir.
     * Çifte gitmiyorsa → taşı aldıktan sonra açabilecek mi kontrol eder.
     * Açamayacaksa → almaz (çünkü açmak ZORUNLU).
     * Çifte gidiyorsa → serbestçe alır, açmak zorunda değil.
     */
    function botYandanAlmaKarari(atilanTas, atanIndex, botIndex) {
        const bot = durum.oyuncular[botIndex];
        const karar = Bot.cekmeKarari(atilanTas, bot.el, durum.okeyTasi);

        if (karar === 'atilan') {
            // Çifte ilan ettiyse → serbestçe alır, açmak zorunda değil
            // (Bu zaten cifteIlanliYandanAlma ile ele alınıyor, buraya düşmemeli)
            if (bot.cifteIlanEtti) {
                izinIsteAkisi(botIndex, atanIndex, atilanTas, false);
                return;
            }

            // Seri gidiyor → taşı alırsa açmak ZORUNDA
            // Önce simüle et: taşı ekleyince açabiliyor mu?
            const simuleEl = [...bot.el, atilanTas];
            const esik = bot.elAcmaEsigi || GE.VARSAYILAN_ESIK;
            const acmaSonucu = Bot.elAcmaKarari(simuleEl, esik, durum.okeyTasi);

            if (acmaSonucu) {
                // Açabilecek → izin iste, al
                izinIsteAkisi(botIndex, atanIndex, atilanTas, true);
            } else {
                // Açamayacak → almaz (zorunlu açma kuralı)
                siraIlerlet();
                tumEkraniGuncelle();
            }
        } else {
            // Bot yandan almak istemiyor → normal sıra
            siraIlerlet();
            tumEkraniGuncelle();
        }
    }

    /**
     * KURAL: Çifte ilan etmiş YANDAKI oyuncu taşı serbestçe alır.
     * - İzin istemesine GEREK YOK
     * - Açmak zorunda DEĞİL
     * - İşlek taş hariç
     * 
     * @param {number} yandakiIndex - sadece (atanIndex+1)%4
     * @returns {boolean} true ise akış yönetiliyor
     */
    function cifteIlanliYandanAlma(atilanTas, atanIndex, yandakiIndex) {
        const oyuncu = durum.oyuncular[yandakiIndex];
        if (!oyuncu.cifteIlanEtti) return false;

        // İşlek taş kontrolü
        try {
            const acilmisKombs = durum.oyuncular.flatMap(o => o.acilmisKombs);
            const islekSonuc = GE.islerTasBelirle(atilanTas, acilmisKombs, durum.okeyTasi);
            if (islekSonuc && islekSonuc.islek) {
                R.bildirimGoster(`${oyuncu.isim}: İşlek taş — alınamaz!`, '', 2000);
                return false;
            }
        } catch (e) { /* ignore */ }

        // Çifte ilan etmiş: serbestçe al, AÇMAK ZORUNDA DEĞİL
        if (oyuncu.botMu) {
            Ses.tasCek();
            R.bildirimGoster(`${oyuncu.isim} (çifte) yandan taşı serbestçe aldı!`, 'cifte-bildirim', 2500);
            oyuncu.el.push(atilanTas);
            durum.sonAtilanTas = durum.atilanTaslar.length > 0
                ? durum.atilanTaslar[durum.atilanTaslar.length - 1] : null;

            botElAcmaDene(yandakiIndex);
            setTimeout(() => { botTasAt(yandakiIndex); }, 800);
            return true;
        } else {
            // İNSAN OYUNCU çifte ilan etmişse -> SERBESTÇE alabilir ama otomatik alamaz (Ortadan çekme hakkı da var)
            // Sadece seçeneği göster
            yandanAlSecenekGoster(atilanTas, atanIndex);
            return true;
        }
    }

    /**
     * İnsan oyuncuya "Yandan Al" seçeneği gösterir.
     * Oyuncu isterse yandan alır, istemezse istakadan çeker.
     */
    function yandanAlSecenekGoster(atilanTas, atanIndex) {
        durum.aktifOyuncuIndex = 0;
        durum.faz = 'cekme';
        zamanlayiciBaşlat();
        tumEkraniGuncelle();

        const atanIsim = durum.oyuncular[atanIndex].isim;
        R.bildirimGoster(`${atanIsim} taş attı — yandan alabilirsiniz!`, '', 3000);

        // "Yandan Al" butonunu göster
        yandanAlButonGoster(atilanTas, atanIndex);
    }

    /**
     * "Yandan Al" butonunu aktifleştirir.
     */
    function yandanAlButonGoster(atilanTas, atanIndex) {
        const btn = document.getElementById('btn-yandan-al');
        if (!btn) return;

        btn.style.display = 'flex';
        btn.disabled = false;
        btn.onclick = () => {
            yandanAlButonGizle();

            const ben = durum.oyuncular[0];

            // Çifte ilan ettiyse → serbestçe al
            if (ben.cifteIlanEtti) {
                Ses.tasCek();
                R.bildirimGoster('Çifte hakkınızla yandan aldınız!', 'cifte-bildirim', 2500);
                ben.el.push(atilanTas);
                durum.sonAtilanTas = durum.atilanTaslar.length > 0
                    ? durum.atilanTaslar[durum.atilanTaslar.length - 1] : null;
                durum.faz = 'atma';
                zamanlayiciSifirla();
                tumEkraniGuncelle();
                return;
            }

            // Atan oyuncu zaten seri açmışsa → izin gerekmez (çifte gitme ihtimali yok)
            const atan = durum.oyuncular[atanIndex];
            if (atan.elAcildi && (!atan.elAcmaYontemi || atan.elAcmaYontemi === 'seri')) {
                Ses.tasCek();
                ben.el.push(atilanTas);
                durum.sonAtilanTas = durum.atilanTaslar.length > 0
                    ? durum.atilanTaslar[durum.atilanTaslar.length - 1] : null;
                durum.faz = 'atma';
                // Oyuncu henüz açmamışsa açmak zorunlu olur
                if (!ben.elAcildi) {
                    durum.zorunluAcma = true;
                    R.bildirimGoster(`${atan.isim} zaten elini açmış — taşı aldınız! Elinizi açmak ZORUNDASINIZ.`, 'cifte-bildirim', 3500);
                } else {
                    R.bildirimGoster(`${atan.isim} zaten elini açmış — izinsiz aldınız!`, '', 2500);
                }
                zamanlayiciSifirla();
                tumEkraniGuncelle();
                return;
            }

            // Seri gidiyor → izin iste (atan oyuncudan)
            izinIsteAkisi(0, atanIndex, atilanTas, true);

        };
    }

    /**
     * "Yandan Al" butonunu gizler.
     */
    function yandanAlButonGizle() {
        const btn = document.getElementById('btn-yandan-al');
        if (btn) {
            btn.style.display = 'none';
            btn.onclick = null;
        }
    }

    /**
     * İzin isteme akışını yönetir.
     * @param {number} isteyenIndex - Taşı almak isteyen oyuncu index'i
     * @param {number} atanIndex - Taşı atan oyuncu index'i
     * @param {Object} atilanTas - İstenen taş
     * @param {boolean} acmakZorunlu - İzin verilirse açmak zorunlu mu
     * @returns {boolean} true
     */
    function izinIsteAkisi(isteyenIndex, atanIndex, atilanTas, acmakZorunlu) {
        const isteyen = durum.oyuncular[isteyenIndex];
        const atan = durum.oyuncular[atanIndex];

        if (atanIndex === 0) {
            // ═══ OYUNCUDAN İZİN İSTENİYOR ═══
            durum.izinBekleniyor = true;
            zamanlayiciDurdur();
            Ses.izinIste();

            R.izinPopupGoster(isteyen.isim, atilanTas,
                // ─── İZİN VER ───
                () => {
                    durum.izinBekleniyor = false;
                    Ses.izinVerildi();
                    R.bildirimGoster(`${isteyen.isim}'a izin verdiniz — taşı alıp elini açıyor!`, '', 2500);

                    // Taşı al
                    isteyen.el.push(atilanTas);
                    durum.sonAtilanTas = durum.atilanTaslar.length > 0
                        ? durum.atilanTaslar[durum.atilanTaslar.length - 1] : null;

                    // AÇMAK ZORUNDA
                    if (acmakZorunlu) {
                        botZorunluElAc(isteyenIndex);
                    }

                    setTimeout(() => {
                        botTasAt(isteyenIndex);
                    }, 800);
                },
                // ─── REDDET ───
                () => {
                    durum.izinBekleniyor = false;
                    Ses.izinReddet();
                    Ses.cifteGecti();

                    // SEN çifte geçtin (reddettiğin için)
                    durum.oyuncular[0].cifteGectiMi = true;
                    durum.oyuncular[0].izinVermedi = true;

                    // İsteyen bot artık senden taş isteyemez
                    isteyen.yasakliOyuncular.push(0);

                    R.bannerGoster('⚡ ÇİFTE GEÇTİNİZ!', '#c084fc');
                    R.bildirimGoster('İzin vermediniz — çifte geçtiniz! Cezalarınız 2 katına çıkacak.', 'cifte-bildirim', 4000);

                    zamanlayiciBaşlat();
                    // Botun turu atlanmaz, ortadan çekip oynamaya devam eder.
                    durum.faz = 'cekme';
                    setTimeout(() => botOyna(), 800);
                    tumEkraniGuncelle();
                }
            );
            return true;
        } else {
            // ═══ BOT'TAN İZİN İSTENİYOR ═══
            const izinVer = Bot.izinKarari(atan.el, atan.elAcmaEsigi, durum.okeyTasi);

            if (izinVer) {
                // Bot izin verdi
                Ses.izinVerildi();
                R.bildirimGoster(`${atan.isim} izin verdi — ${isteyen.isim} taşı alıp elini açıyor!`, '', 2500);

                isteyen.el.push(atilanTas);
                durum.sonAtilanTas = durum.atilanTaslar.length > 0
                    ? durum.atilanTaslar[durum.atilanTaslar.length - 1] : null;

                // AÇMAK ZORUNDA
                if (acmakZorunlu && isteyen.botMu) {
                    botZorunluElAc(isteyenIndex);
                }

                setTimeout(() => {
                    if (isteyen.botMu) {
                        botTasAt(isteyenIndex);
                    } else {
                        // Oyuncuya sıra ver, el açmak zorunda
                        durum.aktifOyuncuIndex = 0;
                        durum.faz = 'atma';
                        if (acmakZorunlu) {
                            durum.zorunluAcma = true;
                        }
                        zamanlayiciSifirla();
                        R.bildirimGoster(acmakZorunlu ? 'İzin verildi! Taşı aldınız — elinizi açmak ZORUNDASINIZ!' : 'Taşı aldınız!', 'cifte-bildirim', 4000);
                        tumEkraniGuncelle();
                    }
                }, 600);
            } else {
                // Bot reddetti → bot çifte geçer
                Ses.izinReddet();
                Ses.cifteGecti();
                atan.cifteGectiMi = true;
                atan.izinVermedi = true;

                // İsteyen oyuncu (sen/bot) artık bu bottan taş isteyemez
                isteyen.yasakliOyuncular.push(atanIndex);

                R.bannerGoster(`${atan.isim}: ÇİFTE GEÇTİ!`, '#c084fc');
                R.bildirimGoster(`${atan.isim} izin vermedi — çifte geçti! Cezaları 2 katına çıktı.`, 'cifte-bildirim', 3000);

                setTimeout(() => {
                    // İsteyen oyuncunun turu atlanmaz, ortadan çekmeye mecbur kalır.
                    durum.faz = 'cekme';
                    if (isteyen.botMu) {
                        botOyna();
                    } else {
                        zamanlayiciSifirla();
                        zamanlayiciBaşlat();
                        tumEkraniGuncelle();
                    }
                }, 1000);
            }
        }
    }

    /**
     * Bot zorunlu el açma (yandan taş aldığı için).
     * Eğer açamıyorsa ceza alır.
     */
    function botZorunluElAc(botIndex) {
        const bot = durum.oyuncular[botIndex];
        // Not: Zaten açıksa da yandan taş alınca yeni per oluşmuş olabilir, kontrol etmeliyiz.

        const esik = bot.elAcmaEsigi || GE.VARSAYILAN_ESIK;
        let acmaSonucu = Bot.elAcmaKarari(bot.el, esik, durum.okeyTasi, bot.elAcildi, bot.elAcmaYontemi);

        // Çifte ilan eden bot SADECE çift açabilir
        if (acmaSonucu && bot.cifteIlanEtti && acmaSonucu.yontem === 'seri') {
            acmaSonucu = null;
        }

        if (acmaSonucu) {
            const isFirstOpen = !bot.elAcildi;
            if (isFirstOpen) {
                bot.elAcildi = true;
                bot.elAcmaYontemi = acmaSonucu.yontem;
                bot.acilmisKombs = acmaSonucu.kombinasyonlar;
            } else {
                bot.acilmisKombs = [...bot.acilmisKombs, ...acmaSonucu.kombinasyonlar];
            }
            const acılanIdler = new Set();
            for (const komb of acmaSonucu.kombinasyonlar) {
                for (const tas of komb) acılanIdler.add(tas.id);
            }
            bot.el = bot.el.filter(t => !acılanIdler.has(t.id));
            bot.kalanTaslar = bot.el;

            Ses.elAc();
            R.bildirimGoster(`${bot.isim} elini açtı! (yandan aldığı için zorunlu)`, '', 3000);

            // Kafa atma kontrolü
            if (acmaSonucu.yontem === 'seri') {
                const kafaAtma = GE.kafaAtmaKontrol(acmaSonucu.puan);
                bot.puan += kafaAtma.bonus;
                if (kafaAtma.durum === 'kafa') {
                    Ses.kafaAt();
                    R.bannerGoster(`${bot.isim}: 🎯 KAFA ATTI! -100`, '#4ade80');
                    R.sparkleEfekti('#4ade80', 20);
                } else if (kafaAtma.durum === 'ciftKafa') {
                    Ses.ciftKafaAt();
                    R.bannerGoster(`${bot.isim}: 🔥 ÇİFT KAFA! -200`, '#fbbf24');
                    R.sparkleEfekti('#ffd700', 30);
                }
            } else if (acmaSonucu.yontem === 'cift') {
                const ciftSayisi = acmaSonucu.kombinasyonlar.length;
                const kafaAtma = GE.kafaAtmaKontrol(0, ciftSayisi);
                bot.puan += kafaAtma.bonus;
                if (kafaAtma.durum !== 'normal') {
                    Ses.kafaAt();
                    R.bannerGoster(`${bot.isim}: ${kafaAtma.durum === 'kafa' ? '🎯 KAFA!' : '🔥 ÇİFT KAFA!'}`, '#f0c040');
                }
            }
        } else {
            // Açamadı — bu durumda yine de taşı aldı ama açamadı
            R.bildirimGoster(`${bot.isim} yandan aldı ama açamıyor...`, '', 2000);
        }
    }

    // ─── ÇİFTE İLAN ETME ──────────────────────────────────
    /**
     * Oyuncu aktif olarak çifte ilan eder.
     * → Rakibin attığı her taşı izinsiz alabilir (işlek taş hariç)
     * → Açmak zorunda DEĞİL
     * → Diğer oyuncuların seri ile el açma eşiği 101'e yükselir
     */
    function cifteIlanEt() {
        if (durum.oyunBitti) return;

        const ben = durum.oyuncular[0];
        if (ben.cifteIlanEtti) {
            R.bildirimGoster('Zaten çifte ilan ettiniz!', '', 2000);
            return;
        }

        const sonuc = GE.cifteIlanEt(ben, durum.oyuncular);

        if (sonuc.basarili) {
            ben.cifteIlanEtti = true;

            Ses.cifteIlan();
            R.bannerGoster('⚡ ÇİFTE GİDİYORUM!', '#c084fc');
            R.cifteGostergeGuncelle(true, '⚡ SEN — ÇİFTE GİDİYOR — Eşik: 101');
            R.bildirimGoster('Çifte ilan ettiniz! Rakiplerin attığı taşları izinsiz alabilirsiniz.', 'cifte-bildirim', 4000);
            R.bildirimGoster('Diğer oyuncuların el açma eşiği 101\'e yükseldi!', 'cifte-bildirim', 3000);
        } else {
            R.bildirimGoster(sonuc.mesaj, '', 2000);
        }

        butonlariGuncelle();
    }

    // ─── TAŞ TIKLANMA / SÜRÜKLEME ─────────────────────────
    function tasaTiklandi(tas, slotIndex) {
        if (durum.aktifOyuncuIndex !== 0) return;

        if (durum.faz === 'atma') {
            Ses.tasSec();
            if (durum.seciliTasId === tas.id) {
                durum.seciliTasId = null;
            } else {
                durum.seciliTasId = tas.id;
            }
            tumEkraniGuncelle();
        }
    }

    /**
     * El verisi ile yerel raf slotlarını senkronize eder.
     */
    function rafSlotlariReconcile(yeniEl) {
        const mevcutIdler = new Set(yeniEl.map(t => t.id));

        // 1. Artık olmayanları sil
        for (let i = 0; i < rafSlots.length; i++) {
            if (rafSlots[i] && !mevcutIdler.has(rafSlots[i].id)) {
                rafSlots[i] = null;
            }
        }

        // 2. Yeni gelenleri ekle
        const olanIdler = new Set(rafSlots.filter(t => t !== null).map(t => t.id));
        const yeniGelenler = yeniEl.filter(t => !olanIdler.has(t.id));

        yeniGelenler.forEach(tas => {
            const bosIndex = rafSlots.indexOf(null);
            if (bosIndex !== -1) rafSlots[bosIndex] = tas;
        });

        // 3. Verileri tazele
        const elMap = new Map(yeniEl.map(t => [t.id, t]));
        for (let i = 0; i < rafSlots.length; i++) {
            if (rafSlots[i]) rafSlots[i] = elMap.get(rafSlots[i].id);
        }
    }

    function tasSuruklendiRafa(kaynakIndex, hedefIndex) {
        if (kaynakIndex === hedefIndex) return;

        const kaynakTas = rafSlots[kaynakIndex];
        const hedefTas = rafSlots[hedefIndex];

        rafSlots[hedefIndex] = kaynakTas;
        rafSlots[kaynakIndex] = hedefTas;

        Ses.tasSec();
        tumEkraniGuncelle();
    }

    // ─── SIRA YÖNETİMİ ────────────────────────────────────
    function siraIlerlet() {
        durum.aktifOyuncuIndex = (durum.aktifOyuncuIndex + 1) % 4;
        durum.faz = 'cekme';
        zamanlayiciSifirla();

        if (durum.oyuncular[durum.aktifOyuncuIndex].botMu) {
            setTimeout(() => botOyna(), 800);
        }
    }

    // ─── BOT OYNAMA ────────────────────────────────────────
    function botOyna() {
        if (durum.oyunBitti) return;

        const botIndex = durum.aktifOyuncuIndex;
        const bot = durum.oyuncular[botIndex];

        // 1. Istakadan taş çek (yandan alma artık tasAtildiSonrasi'nda yönetiliyor)
        if (durum.istaka.length > 0) {
            const cekilenTas = durum.istaka.pop();
            bot.el.push(cekilenTas);
            Ses.tasCek();
        }

        // 2. Çifte ilan kararı (ÖNCE)
        if (!bot.cifteIlanEtti) {
            const cifteKarar = Bot.cifteKarari(bot.el, bot.puan, durum.okeyTasi);
            if (cifteKarar) {
                const sonuc = GE.cifteIlanEt(bot, durum.oyuncular);
                if (sonuc.basarili) {
                    bot.cifteIlanEtti = true;

                    Ses.cifteIlan();
                    R.bannerGoster(`⚡ ${bot.isim}: ÇİFTE GİDİYOR!`, '#c084fc');
                    R.cifteGostergeGuncelle(true, `⚡ ${bot.isim} ÇİFTE — Eşik: 101`);
                    R.bildirimGoster(`${bot.isim} çifte ilan etti! El açma eşiği 101'e yükseldi.`, 'cifte-bildirim', 4000);
                }
            }
        }

        // 3. El açma kontrolü
        botElAcmaDene(botIndex);

        // 4. Taş işleme denemesi (açılmış komblar varsa)
        botTasIslemeDene(botIndex);

        // 5. Taş atma
        setTimeout(() => {
            if (durum.oyunBitti) return;
            botTasAt(botIndex);
        }, 600);
    }

    /** Bot opsiyonel el açma denemesi (açmak zorunda değil) */
    function botElAcmaDene(botIndex) {
        const bot = durum.oyuncular[botIndex];
        // Artık zaten açık olsa da yeni perleri açabilir

        const esik = bot.elAcmaEsigi || GE.VARSAYILAN_ESIK;
        let acmaSonucu = Bot.elAcmaKarari(bot.el, esik, durum.okeyTasi, bot.elAcildi, bot.elAcmaYontemi);

        // Çifte ilan eden bot SADECE çift açabilir
        if (acmaSonucu && bot.cifteIlanEtti && acmaSonucu.yontem === 'seri') {
            acmaSonucu = null;
        }

        if (acmaSonucu) {
            const isFirstOpen = !bot.elAcildi;
            if (isFirstOpen) {
                bot.elAcildi = true;
                bot.elAcmaYontemi = acmaSonucu.yontem;
                bot.acilmisKombs = acmaSonucu.kombinasyonlar;
            } else {
                bot.acilmisKombs = [...bot.acilmisKombs, ...acmaSonucu.kombinasyonlar];
            }
            const acılanIdler = new Set();
            for (const komb of acmaSonucu.kombinasyonlar) {
                for (const tas of komb) acılanIdler.add(tas.id);
            }
            bot.el = bot.el.filter(t => !acılanIdler.has(t.id));
            bot.kalanTaslar = bot.el;

            Ses.elAc();

            if (acmaSonucu.yontem === 'seri') {
                const kafaAtma = GE.kafaAtmaKontrol(acmaSonucu.puan);
                bot.puan += kafaAtma.bonus;
                if (kafaAtma.durum === 'kafa') {
                    Ses.kafaAt();
                    R.bannerGoster(`${bot.isim}: 🎯 KAFA ATTI! -100`, '#4ade80');
                    R.sparkleEfekti('#4ade80', 20);
                } else if (kafaAtma.durum === 'ciftKafa') {
                    Ses.ciftKafaAt();
                    R.bannerGoster(`${bot.isim}: 🔥 ÇİFT KAFA! -200`, '#fbbf24');
                    R.sparkleEfekti('#ffd700', 30);
                }
            } else if (acmaSonucu.yontem === 'cift') {
                const ciftSayisi = acmaSonucu.kombinasyonlar.length;
                const kafaAtma = GE.kafaAtmaKontrol(0, ciftSayisi);
                bot.puan += kafaAtma.bonus;
                if (kafaAtma.durum !== 'normal') {
                    Ses.kafaAt();
                    R.bannerGoster(`${bot.isim}: ${kafaAtma.durum === 'kafa' ? '🎯 KAFA!' : '🔥 ÇİFT KAFA!'}`, '#f0c040');
                }
            }

            R.bildirimGoster(`${bot.isim} el açtı!`, '', 3000);
        }
    }

    // ─── MASAYA TAŞ İŞLEME ─────────────────────────────────

    /**
     * Oyuncunun elindeki bir taşı masadaki açılmış bir kombinasyona işler.
     * @param {number} tileId           - İşlenecek taşın ID'si (dataset.id'den gelir)
     * @param {number} hedefOyuncuIndex - Hedef kombinasyonun sahibi oyuncu index'i
     * @param {number} kombIndex        - Hedef kombinasyonun index'i
     * @param {number} [ikincitasId]    - İkinci taşın ID'si (çift açıcıya işleme için)
     */
    function tasIsle(tileId, hedefOyuncuIndex, kombIndex, ikincitasId) {
        const ben = durum.oyuncular[0];
        if (!ben.elAcildi) {
            R.bildirimGoster('Önce elinizi açmanız gerekiyor!', '', 2000);
            return;
        }
        if (durum.faz !== 'atma' || durum.aktifOyuncuIndex !== 0) return;

        const hedefOyuncu = durum.oyuncular[hedefOyuncuIndex];
        if (!hedefOyuncu) return;

        // El açmamışsa işlem yapılamaz
        const hedefAcilmis = hedefOyuncu.elAcildi || (hedefOyuncu.acilmisKombs && hedefOyuncu.acilmisKombs.length > 0);
        if (!hedefAcilmis) {
            R.bildirimGoster('Hedef oyuncu elini açmamış!', '', 2000);
            return;
        }

        const hedefYontem = hedefOyuncu.elAcmaYontemi || 'seri';

        // ── ÇİFT AÇICIYA: iki taş gerekli ──
        if (hedefYontem === 'cift') {
            if (ikincitasId === undefined || ikincitasId === null) {
                R.bildirimGoster('Çift açıcıya işlemek için iki taş seçmelisiniz! (Raftan ikinci taşa da tıklayın)', '', 3000);
                return;
            }
            const tas1 = ben.el.find(t => t.id === tileId);
            const tas2 = ben.el.find(t => t.id === ikincitasId);
            if (!tas1 || !tas2) return;

            const sonuc = GE.ciftIslenebilirMi(tas1, tas2, hedefOyuncu.acilmisKombs);
            if (sonuc.islenebilir) {
                // ID tabanlı filtreleme — sıra bağımsız
                ben.el = ben.el.filter(t => t.id !== tileId && t.id !== ikincitasId);
                ben.kalanTaslar = ben.el;
                hedefOyuncu.acilmisKombs = sonuc.yeniKombs;
                Ses.tasCek();
                R.bildirimGoster('Çift işlendi!', '', 2000);
                tumEkraniGuncelle();
                if (ben.el.length === 0) turSonuMu();
            } else {
                R.bildirimGoster(sonuc.sebep, '', 2000);
            }
            return;
        }

        // ── SERİ/PER AÇICIYA TEK TAŞ ──
        const tas = ben.el.find(t => t.id === tileId);
        if (!tas) {
            R.bildirimGoster('Taş elde bulunamadı!', '', 2000);
            return;
        }

        if (!hedefOyuncu.acilmisKombs || !hedefOyuncu.acilmisKombs[kombIndex]) {
            R.bildirimGoster('Geçersiz hedef kombinasyon!', '', 2000);
            return;
        }

        // ── TEK DOĞRULUK KAYNAĞI: GE.tasIslenebilirMi (botlarla aynı) ──
        const kombinasyon = hedefOyuncu.acilmisKombs[kombIndex];
        const sonuc = GE.tasIslenebilirMi(tas, kombinasyon, durum.okeyTasi);

        if (sonuc.islenebilir) {
            // Taşı elden çıkar (ID tabanlı — sıra bağımsız)
            ben.el = ben.el.filter(t => t.id !== tileId);
            ben.kalanTaslar = ben.el;
            // Kombinasyonu güncelle (botlarla aynı alan: yeniKombinasyon)
            hedefOyuncu.acilmisKombs[kombIndex] = sonuc.yeniKombinasyon;
            Ses.tasCek();
            R.bildirimGoster('Taş işlendi!', '', 2000);
            tumEkraniGuncelle();
            if (ben.el.length === 0) turSonuMu();
        } else {
            R.bildirimGoster(sonuc.sebep, '', 2000);
        }
    }



    /**
     * Bot'un elindeki uygun taşları masadaki açılmış kombinasyonlara işlemesini dener.
     * Açılmış kombinasyonu olan herhangi bir oyuncuya taş ekleyebilir.
     */
    function botTasIslemeDene(botIndex) {
        const bot = durum.oyuncular[botIndex];
        if (!bot.elAcildi) return; // El açılmadıysa işleme yapamaz

        let islemeYapildi = true;

        // Birden fazla taş işlenebilir, tekrar dene
        while (islemeYapildi) {
            islemeYapildi = false;

            for (let oi = 0; oi < durum.oyuncular.length; oi++) {
                const hedefOyuncu = durum.oyuncular[oi];
                if (!hedefOyuncu.elAcildi || !hedefOyuncu.acilmisKombs) continue;

                const hedefYontem = hedefOyuncu.elAcmaYontemi || 'seri';

                // ── ÇİFT AÇICIYA: çift bul ve işle ──
                if (hedefYontem === 'cift') {
                    for (let i = 0; i < bot.el.length - 1; i++) {
                        for (let j = i + 1; j < bot.el.length; j++) {
                            const sonuc = GE.ciftIslenebilirMi(bot.el[i], bot.el[j], hedefOyuncu.acilmisKombs);
                            if (sonuc.islenebilir) {
                                bot.el.splice(j, 1);
                                bot.el.splice(i, 1);
                                hedefOyuncu.acilmisKombs = sonuc.yeniKombs;
                                bot.kalanTaslar = bot.el;
                                R.bildirimGoster(`${bot.isim} çift işledi!`, '', 2000);
                                islemeYapildi = true;
                                break;
                            }
                        }
                        if (islemeYapildi) break;
                    }
                } else {
                    // ── SERİ/PER AÇICIYA: tek taş işle ──
                    for (let ti = bot.el.length - 1; ti >= 0; ti--) {
                        const tas = bot.el[ti];
                        for (let ki = 0; ki < hedefOyuncu.acilmisKombs.length; ki++) {
                            const sonuc = GE.tasIslenebilirMi(tas, hedefOyuncu.acilmisKombs[ki], durum.okeyTasi);
                            if (sonuc.islenebilir) {
                                bot.el.splice(ti, 1);
                                hedefOyuncu.acilmisKombs[ki] = sonuc.yeniKombinasyon;
                                bot.kalanTaslar = bot.el;
                                R.bildirimGoster(`${bot.isim} taş işledi: ${sonuc.sebep}`, '', 2000);
                                islemeYapildi = true;
                                break;
                            }
                        }
                        if (islemeYapildi) break;
                    }
                }

                if (islemeYapildi) break;
            }
        }
    }

    /** Bot taş atar ve sonraki akışı yönetir */
    function botTasAt(botIndex) {
        if (durum.oyunBitti) return;
        const bot = durum.oyuncular[botIndex];

        const atilacakTas = Bot.enIyiTasAt(bot.el, durum.okeyTasi);
        if (atilacakTas) {
            const tasIdx = bot.el.findIndex(t => t.id === atilacakTas.id);
            if (tasIdx !== -1) {
                const atilanTas = bot.el.splice(tasIdx, 1)[0];

                // --- İŞLEK TAŞ CEZASI (100 PUAN) ---
                try {
                    const tümAçılmışKomblar = durum.oyuncular.flatMap(o => o.acilmisKombs);
                    const islekSonuc = GE.islerTasBelirle(atilanTas, tümAçılmışKomblar, durum.okeyTasi);

                    if (islekSonuc.islekMi) {
                        bot.puan += 100;
                        R.bildirimGoster(`⚠️ ${bot.isim} İŞLEK TAŞ ATTI! +100 Ceza Puanı.`, 'cifte-bildirim', 3000);
                        console.log(`[PENALTY] Bot ${bot.isim} threw playable tile ${atilanTas.id}, +100 pts.`);
                    }
                } catch (err) {
                    console.error("İşlek kontrolü hatası:", err);
                }

                if (durum.sonAtilanTas) durum.atilanTaslar.push(durum.sonAtilanTas);
                durum.sonAtilanTas = atilacakTas;
                durum.sonTasAtanIndex = botIndex;

                // Botun kişisel atılan taş kaydı
                bot.sonAtilanTas = atilacakTas;

                Ses.tasAt();
            }
        }

        bot.kalanTaslar = bot.el;

        // Ekranı hemen güncelle — köşe alanları ve skor görünsün
        tumEkraniGuncelle();

        if (turSonuMu()) return;

        // Taş atıldıktan sonra: yandan alma akışını kontrol et
        tasAtildiSonrasi(durum.sonAtilanTas, botIndex);
    }

    // ─── TUR SONU KONTROL ─────────────────────────────────
    function turSonuMu() {
        const turKontrol = GE.turSonuKontrol(
            durum.oyuncular.map(o => ({ isim: o.isim, kalanTaslar: o.el, elAcildi: o.elAcildi })),
            durum.istaka
        );
        if (turKontrol.bitti) {
            turSonuIsle(turKontrol);
            return true;
        }
        return false;
    }

    // ─── EL AÇMA ───────────────────────────────────────────
    async function elAcmayaDene() {
        if (durum.faz !== 'atma' || durum.aktifOyuncuIndex !== 0) return;

        const ben = durum.oyuncular[0];
        const esik = ben.elAcmaEsigi || GE.VARSAYILAN_ESIK;

        // FİZİKSEL DİZİLİM KONTROLÜ (Bugfix: Oyuncunun dizdiği grupları baz al)
        const acmaSonucu = GE.elAcmaKontrol(rafSlots, durum.okeyTasi, esik, ben.elAcildi, ben.elAcmaYontemi);

        if (!acmaSonucu) {
            const mesaj = ben.elAcildi
                ? (ben.elAcmaYontemi === 'seri' ? 'Yeni per bulunamadı.' : 'Yeni çift bulunamadı.')
                : `El açılamıyor. Minimum ${esik} puan ve geçerli perler gerekiyor. Gruplar arasında boşluk bıraktığınızdan emin olun.`;
            R.bildirimGoster(mesaj, '', 4000);
            return;
        }

        // Çifte ilan eden oyuncu SADECE çift açabilir
        if (ben.cifteIlanEtti && acmaSonucu.yontem === 'seri') {
            R.bildirimGoster('Çifte gittiğinizi ilan ettiniz — sadece çift açabilirsiniz!', 'cifte-bildirim', 3500);
            return;
        }

        const isFirstOpen = !ben.elAcildi;
        if (isFirstOpen) {
            ben.elAcildi = true;
            ben.elAcmaYontemi = acmaSonucu.yontem;
            ben.acilmisKombs = acmaSonucu.kombinasyonlar;
        } else {
            // Zaten açıksa yeni kombinasyonları ekle
            ben.acilmisKombs = [...ben.acilmisKombs, ...acmaSonucu.kombinasyonlar];
        }

        // Zorunlu açma yerine getirildi
        durum.zorunluAcma = false;

        const acılanIdler = new Set();
        for (const komb of acmaSonucu.kombinasyonlar) {
            for (const tas of komb) acılanIdler.add(tas.id);
        }
        ben.el = ben.el.filter(t => !acılanIdler.has(t.id));
        ben.kalanTaslar = ben.el;

        // ─── BOŞ EL KORUMASI ────────────────────────────────────────
        // Tüm taşlar açılmış gruplar arasına dolduğunda el boş kalır.
        // Bu durumda atılacak taş kalmaz ve oyun kilitlenir.
        // Çözüm: El açmayı iptal et, ıstakadan taş çek, otomatik at.
        if (ben.el.length === 0) {
            // Açmayı geri al
            ben.elAcildi = false;
            ben.acilmisKombs = [];
            durum.zorunluAcma = false;
            // Tüm taşları eline geri ver
            for (const komb of acmaSonucu.kombinasyonlar) {
                for (const tas of komb) ben.el.push(tas);
            }
            ben.kalanTaslar = ben.el;
            // Istakadan 1 taş çek (atabilecek taş olsun)
            if (durum.istaka.length > 0) {
                const cekilenTas = durum.istaka.pop();
                ben.el.push(cekilenTas);
                ben.kalanTaslar = ben.el;
            }
            R.bildirimGoster(
                '⚠️ Tüm taşlarınızı açamazsınız — atılacak bir taş bırakılmadı! El açma iptal edildi, bir taşınız otomatik atılacak.',
                'cifte-bildirim',
                4000
            );
            // En düşük değerli taşı otomatik at
            setTimeout(() => {
                if (durum.oyunBitti || durum.aktifOyuncuIndex !== 0) return;
                const atilacak = Bot.enIyiTasAt(durum.oyuncular[0].el, durum.okeyTasi);
                if (atilacak) tasAt(atilacak.id);
            }, 1500);
            tumEkraniGuncelle();
            return;
        }

        Ses.elAc();

        if (acmaSonucu.yontem === 'seri') {
            zamanlayiciDurdur();
            await R.canliSayacGoster(acmaSonucu.puan, 'Sen', 'seri');

            const kafaAtma = GE.kafaAtmaKontrol(acmaSonucu.puan);
            if (kafaAtma.durum === 'kafa') {
                Ses.kafaAt();
                R.bannerGoster('🎯 KAFA ATTINIZ! -100 Puan', '#4ade80');
                R.sparkleEfekti('#4ade80', 25);
                ben.puan += kafaAtma.bonus;
            } else if (kafaAtma.durum === 'ciftKafa') {
                Ses.ciftKafaAt();
                R.bannerGoster('🔥 ÇİFT KAFA! -200 Puan', '#fbbf24');
                R.sparkleEfekti('#ffd700', 40);
                ben.puan += kafaAtma.bonus;
            } else {
                const baslik = isFirstOpen ? 'El açıldı!' : 'Yeni perler açıldı!';
                R.bildirimGoster(`${baslik} Toplam: ${acmaSonucu.puan} puan`, '', 3000);
            }
            zamanlayiciBaşlat();

        } else if (acmaSonucu.yontem === 'cift') {
            const ciftSayisi = acmaSonucu.kombinasyonlar.length;
            zamanlayiciDurdur();
            await R.canliSayacGoster(ciftSayisi, 'Sen', 'cift');

            const kafaAtma = GE.kafaAtmaKontrol(0, ciftSayisi);
            if (kafaAtma.durum === 'kafa') {
                Ses.kafaAt();
                R.bannerGoster('🎯 KAFA ATTINIZ! -100 Puan (5 Çift)', '#4ade80');
                R.sparkleEfekti('#4ade80', 25);
                ben.puan += kafaAtma.bonus;
            } else if (kafaAtma.durum === 'ciftKafa') {
                Ses.ciftKafaAt();
                R.bannerGoster('🔥 ÇİFT KAFA! -200 Puan (6 Çift)', '#fbbf24');
                R.sparkleEfekti('#ffd700', 40);
                ben.puan += kafaAtma.bonus;
            } else {
                const baslik = isFirstOpen ? 'El açıldı!' : 'Yeni çiftler açıldı!';
                R.bildirimGoster(`${baslik} ${ciftSayisi} çift`, '', 3000);
            }
            zamanlayiciBaşlat();
        }

        tumEkraniGuncelle();
    }

    // ─── TUR SONU İŞLEME ──────────────────────────────────
    function turSonuIsle(turKontrol) {
        zamanlayiciDurdur();
        durum.oyunBitti = true;
        Ses.turSonu();

        let ozetHTML = '<table style="width:100%;border-collapse:collapse;margin-top:12px;">';
        ozetHTML += '<tr style="border-bottom:1px solid rgba(255,255,255,0.1);"><th style="text-align:left;padding:6px;color:rgba(255,255,255,0.5);">Oyuncu</th><th style="text-align:right;padding:6px;color:rgba(255,255,255,0.5);">Ceza</th><th style="text-align:right;padding:6px;color:rgba(255,255,255,0.5);">Toplam</th></tr>';

        for (const oyuncu of durum.oyuncular) {
            let ceza = 0;
            let aciklama = '';

            if (turKontrol.kazanan === oyuncu.isim) {
                // 🚩 KAZANAN BONUSU: -100 puan
                ceza = -100;
                aciklama = 'Kazanan Bonusu: -100';
            } else {
                const cezaSonucu = GE.cezaPuanHesapla({
                    kalanTaslar: oyuncu.el,
                    elAcildi: oyuncu.elAcildi,
                    izinVermedi: oyuncu.izinVermedi
                }, oyuncu.cifteGectiMi, durum.okeyTasi);
                ceza = cezaSonucu.ceza;
                aciklama = cezaSonucu.aciklama;
            }

            oyuncu.puan += ceza;
            const puanRenk = ceza > 0 ? '#f87171' : (ceza < 0 ? '#4ade80' : 'white');

            const cifteIcon = oyuncu.cifteGectiMi ? ' ⚡(2x ceza)' : (oyuncu.cifteIlanEtti ? ' ⚡çifte' : '');
            ozetHTML += `<tr>
        <td style="padding:6px;color:white;">${oyuncu.isim}${cifteIcon}</td>
        <td style="padding:6px;text-align:right;color:${puanRenk};" title="${aciklama}">${ceza > 0 ? '+' : ''}${ceza}</td>
        <td style="padding:6px;text-align:right;color:var(--altin);font-weight:700;">${oyuncu.puan}</td>
      </tr>`;
        }
        ozetHTML += '</table>';

        const sebep = turKontrol.kazanan
            ? `🏆 ${turKontrol.kazanan} tüm taşlarını açtı!`
            : '📦 Istaka tükendi!';

        R.modalGoster(
            `Tur ${durum.tur} Sona Erdi`,
            `<p>${sebep}</p>${ozetHTML}`,
            [
                { text: 'Yeni Tur', sinif: 'basari', onClick: () => { durum.tur++; oyunBaslat(); } },
                { text: 'Ana Menü', sinif: '', onClick: () => anaMenuGoster() }
            ]
        );
    }

    // ─── ANA MENÜ ──────────────────────────────────────────
    function anaMenuGoster() {
        R.modalGoster(
            '🎯 81 Okey',
            '<p>Türkiye\'nin klasik kart oyunu.<br>Karaman bölgesine özgü kurallarla!</p>',
            [
                { text: '🎮 Yeni Oyun Başlat', sinif: 'basari', onClick: () => oyunBaslat() }
            ]
        );
    }

    // ─── ZAMANLAYICI ───────────────────────────────────────
    function zamanlayiciBaşlat() {
        durum.kalanSure = 30;
        zamanlayiciDurdur();
        zamanlayiciGuncelle();

        durum.zamanlayiciId = setInterval(() => {
            durum.kalanSure--;
            zamanlayiciGuncelle();

            if (durum.kalanSure <= 5 && durum.kalanSure > 0 && durum.aktifOyuncuIndex === 0) {
                Ses.zamanlayiciUyari();
            }

            if (durum.kalanSure <= 0) {
                if (durum.aktifOyuncuIndex === 0 && !durum.oyunBitti) {
                    if (durum.faz === 'cekme') {
                        istakadanCek();
                    } else if (durum.faz === 'atma') {
                        const ben = durum.oyuncular[0];
                        const benEl = ben.el;

                        // Yandan aldı ama açamadı → ceza + otomatik taş at
                        if (durum.zorunluAcma && !ben.elAcildi) {
                            durum.zorunluAcma = false;
                            ben.puan += 100;
                            R.bildirimGoster(
                                '⏰ Süre doldu! Yandan aldınız ama elinizi açamadınız — +100 ceza!',
                                'cifte-bildirim',
                                4000
                            );
                        }

                        if (benEl.length === 0) {
                            // El boş — atılacak taş yok, ıstakadan çek ve at
                            if (durum.istaka.length > 0) {
                                const cekilenTas = durum.istaka.pop();
                                benEl.push(cekilenTas);
                            }
                        }
                        const atilacak = Bot.enIyiTasAt(benEl, durum.okeyTasi);
                        if (atilacak) {
                            durum.seciliTasId = atilacak.id;
                            tasAt(atilacak.id);
                        }
                    }
                }
            }
        }, 1000);
    }

    function zamanlayiciSifirla() {
        durum.kalanSure = 30;
        zamanlayiciGuncelle();
    }

    function zamanlayiciDurdur() {
        if (durum.zamanlayiciId) {
            clearInterval(durum.zamanlayiciId);
            durum.zamanlayiciId = null;
        }
    }

    function zamanlayiciGuncelle() {
        const el = document.getElementById('zamanlayici');
        if (el) {
            el.textContent = durum.kalanSure + 's';
            if (durum.kalanSure <= 10) {
                el.classList.add('uyari');
            } else {
                el.classList.remove('uyari');
            }
        }
    }

    // ─── SES BUTONU ───────────────────────────────────────
    function sesButonuBasildi() {
        const acik = Ses.sesToggle();
        const btn = document.getElementById('btn-ses');
        if (btn) {
            btn.textContent = acik ? '🔊' : '🔇';
            btn.classList.toggle('kapali', !acik);
        }
    }

    // ─── BAŞLATMA ──────────────────────────────────────────
    function init() {
        document.getElementById('btn-cek')?.addEventListener('click', istakadanCek);
        document.getElementById('btn-at')?.addEventListener('click', () => {
            if (durum.seciliTasId !== null) tasAt(durum.seciliTasId);
        });
        document.getElementById('btn-ac')?.addEventListener('click', elAcmayaDene);
        document.getElementById('btn-cifte')?.addEventListener('click', cifteIlanEt);
        document.getElementById('btn-yeni-oyun')?.addEventListener('click', oyunBaslat);
        document.getElementById('btn-ses')?.addEventListener('click', sesButonuBasildi);

        anaMenuGoster();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.OyunDurum = durum;

})();
