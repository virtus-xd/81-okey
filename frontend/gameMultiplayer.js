/**
 * 81 Okey — Multiplayer İstemci (Game Controller)
 * 
 * Tek oyunculu game.js'in multiplayer versiyonu.
 * Tüm oyun mantığı sunucuda — bu dosya sadece UI ve iletişim yönetir.
 */

(function () {
    'use strict';

    const R = window.Renderer;
    const Ses = window.SesEfekt;
    const GameEngine = window.GameEngine;

    let socket = null;
    let benimIndexim = -1;

    // Sunucudan gelen son durum
    let durum = {
        benimElim: [],
        oyuncular: [],
        istakaSayisi: 0,
        sonAtilanTas: null,
        sonTasAtanIndex: -1,
        gostergeTasi: null,
        okeyTasi: null,
        aktifOyuncuIndex: 0,
        faz: 'cekme',
        tur: 1,
        oyunBitti: false,
        seciliTasId: null,
        zorunluAcma: false,
        zorunluAcmaKalanSure: 0
    };

    // 28 slotluk raf durumu (yerel dizilim için)
    let rafSlots = new Array(28).fill(null);

    let _zorunluAcmaInterval = null;

    function zorunluAcmaGeriSayimBaslat(kalanSaniye) {
        // Önceki interval'ı temizle
        if (_zorunluAcmaInterval) clearInterval(_zorunluAcmaInterval);

        let kalan = kalanSaniye;
        _zorunluAcmaInterval = setInterval(() => {
            kalan--;
            if (kalan <= 0) {
                clearInterval(_zorunluAcmaInterval);
                _zorunluAcmaInterval = null;
                return;
            }
            const siraEl = document.getElementById('sira-gosterge');
            if (siraEl && durum.zorunluAcma) {
                siraEl.textContent = `📍 Sıra SİZDE — Taş atın | ⏰ EL AÇ: ${kalan}s`;
                siraEl.className = 'sira-gosterge aktif zorunlu-acma';
            }
        }, 1000);
    }

    // ─── LOBİ ────────────────────────────────────────────────

    function lobiBaslat() {
        const lobiDiv = document.getElementById('lobi-ekrani');
        const oyunDiv = document.getElementById('oyun-alani');

        if (lobiDiv) lobiDiv.style.display = 'flex';
        if (oyunDiv) oyunDiv.style.display = 'none';

        const baglanBtn = document.getElementById('btn-baglan');
        if (baglanBtn) {
            baglanBtn.onclick = () => {
                const isimInput = document.getElementById('oyuncu-isim');
                const isim = isimInput ? isimInput.value.trim() : '';
                if (!isim) {
                    alert('Lütfen bir isim girin!');
                    return;
                }
                sunucuyaBaglan(isim);
            };
        }
    }

    function sunucuyaBaglan(isim) {
        const sunucuUrl = window.BACKEND_URL || window.location.origin;

        const durumYazi = document.getElementById('lobi-durum');
        if (durumYazi) durumYazi.innerHTML = '<div class="lobi-bekle">⏳ Sunucuya bağlanılıyor... (ilk bağlantı 30s sürebilir)</div>';

        socket = io(sunucuUrl, {
            transports: ['websocket', 'polling'],
            timeout: 20000
        });

        socket.on('connect', () => {
            console.log('🔌 Sunucuya bağlandı:', socket.id);
            socket.emit('lobiKatil', { isim });

            const baglanBtn = document.getElementById('btn-baglan');
            if (baglanBtn) {
                baglanBtn.disabled = true;
                baglanBtn.textContent = 'Bağlandı ✓';
            }
        });

        socket.on('connect_error', (err) => {
            console.error('❌ Bağlantı hatası:', err.message);
            if (durumYazi) {
                durumYazi.innerHTML = `
                    <div style="color:#f87171;padding:12px;border-radius:8px;background:rgba(248,113,113,0.1);">
                        ❌ Sunucuya bağlanılamadı!<br>
                        <small>Hata: ${err.message}</small><br>
                        <small>Backend: ${sunucuUrl}</small><br><br>
                        <strong>Render'daki sunucu uyumuş olabilir, 30 saniye bekleyip tekrar deneyin.</strong>
                    </div>`;
            }
            const baglanBtn = document.getElementById('btn-baglan');
            if (baglanBtn) {
                baglanBtn.disabled = false;
                baglanBtn.textContent = '🔗 Tekrar Dene';
            }
            socket.disconnect();
            socket = null;
        });

        socket.on('disconnect', () => {
            console.log('❌ Bağlantı kesildi');
            if (durumYazi) durumYazi.textContent = '❌ Bağlantı kesildi! Sayfayı yenileyin.';
        });

        // Lobi güncellemesi
        socket.on('lobiGuncelle', (data) => {
            const durumYazi = document.getElementById('lobi-durum');
            if (durumYazi) {
                durumYazi.innerHTML = `
                    <div class="lobi-sayi">${data.sayi}/4 Oyuncu</div>
                    <div class="lobi-liste">
                        ${data.oyuncular.map((isim, i) => `<div class="lobi-oyuncu">${i + 1}. ${isim}</div>`).join('')}
                    </div>
                    ${data.sayi < 4 ? '<div class="lobi-bekle">Diğer oyuncular bekleniyor...</div>' : '<div class="lobi-basliyor">Oyun başlıyor!</div>'}
                `;
            }
        });

        // Oyun başladı
        socket.on('oyunBasladi', () => {
            Ses.initAudio();
            const lobiDiv = document.getElementById('lobi-ekrani');
            const oyunDiv = document.getElementById('oyun-alani');
            if (lobiDiv) lobiDiv.style.display = 'none';
            if (oyunDiv) oyunDiv.style.display = 'flex';
            const siraEl = document.getElementById('sira-gosterge');
            if (siraEl) siraEl.style.display = '';
        });

        // Durum güncellemesi
        socket.on('durumGuncelle', (yeniDurum) => {
            const elDegistiMI = JSON.stringify(durum.benimElim) !== JSON.stringify(yeniDurum.benimElim);

            durum = { ...durum, ...yeniDurum };
            benimIndexim = yeniDurum.benimIndexim;

            if (elDegistiMI) {
                rafSlotlariReconcile(yeniDurum.benimElim);
            }

            tumEkraniGuncelle();
        });

        // Bildirim
        socket.on('bildirim', ({ mesaj, tip, sure }) => {
            R.bildirimGoster(mesaj, tip || '', sure || 3000);
        });

        // Banner
        socket.on('banner', ({ mesaj, renk }) => {
            R.bannerGoster(mesaj, renk);
        });

        // Yandan al seçeneği
        socket.on('yandanAlSecenegi', ({ tas, atanIsim }) => {
            Ses.izinIste();
            yandanAlSecenekGoster(tas, atanIsim);
        });

        // İzin isteniyor
        socket.on('izinIsteniyor', ({ isteyenIsim, tas }) => {
            Ses.izinIste();
            izinPopupGoster(isteyenIsim, tas);
        });

        // Tur sonu
        socket.on('turSonu', (data) => {
            Ses.oyunBitti();
            turSonuGoster(data);
        });
    }

    // ─── EKRAN GÜNCELLEME ──────────────────────────────────

    function tumEkraniGuncelle() {
        // Kendi elimizi (rafSlots) render et
        R.eliRenderEt(rafSlots, document.getElementById('tas-rafi'), durum.okeyTasi, {
            seciliTasId: durum.seciliTasId,
            onTasClick: (tas, slotIdx) => tasaTiklandi(tas, slotIdx),
            onSlotDrop: tasSuruklendiRafa
        });

        // El puanını hesapla ve göster
        const elPuani = GameEngine.elPuaniniHesapla(rafSlots, durum.okeyTasi);
        R.elPuaniGuncelle(elPuani);

        // OyuncuPanelleri: Renderer'ın built-in fonksiyonuyla güncelle
        const pozisyonlar = pozisyonHesapla();
        const oyuncuBilgileri = pozisyonlar.map(({ poz, idx }) => ({
            isim: durum.oyuncular[idx]?.isim || poz,
            puan: durum.oyuncular[idx]?.puan || 0,
            tasSayisi: durum.oyuncular[idx]?.tasSayisi || 0,
            cifteIlanEtti: durum.oyuncular[idx]?.cifteIlanEtti || false,
            cifteGectiMi: durum.oyuncular[idx]?.cifteGectiMi || false,
            elAcildi: durum.oyuncular[idx]?.elAcildi || false,
            sonAtilanTas: durum.oyuncular[idx]?.sonAtilanTas || null
        }));
        R.oyuncuPanelleriGuncelle(oyuncuBilgileri, pozisyonlar.findIndex(p => p.idx === durum.aktifOyuncuIndex));

        // Diğer oyuncuların açılmış kombinasyonları
        pozisyonlar.forEach(({ poz, idx }) => {
            if (idx === benimIndexim) return; // Kendi komblarımız aşağıda ayrı render ediliyor
            const oyuncu = durum.oyuncular[idx];
            if (!oyuncu) return;

            const acilmisContainer = document.getElementById(`acilmis-${poz}`);
            if (acilmisContainer && oyuncu.acilmisKombs) {
                const islemAktif = durum.oyuncular[benimIndexim]?.elAcildi &&
                    durum.faz === 'atma' && durum.aktifOyuncuIndex === benimIndexim;
                const secenekler = islemAktif ? { onTasIsleDrop: tasIsle, oyuncuIndex: idx } : { oyuncuIndex: idx };
                R.acilmisKombRenderEt(oyuncu.acilmisKombs, acilmisContainer, durum.okeyTasi, secenekler);
            }
        });

        // Kendi açılmış kombinasyonlarımız (raf üstü)
        const acilmisRaf = document.getElementById('acilmis-raf');
        if (acilmisRaf && durum.oyuncular[benimIndexim]) {
            const benimKombs = durum.oyuncular[benimIndexim].acilmisKombs || [];
            const islemAktif = durum.oyuncular[benimIndexim]?.elAcildi &&
                durum.faz === 'atma' && durum.aktifOyuncuIndex === benimIndexim;
            const secenekler = islemAktif ? { onTasIsleDrop: tasIsle, oyuncuIndex: benimIndexim } : { oyuncuIndex: benimIndexim };
            R.acilmisKombRenderEt(benimKombs, acilmisRaf, durum.okeyTasi, secenekler);
        }

        // Son atılan taş
        const atilanContainer = document.getElementById('atilan-tas-alani');
        if (atilanContainer) {
            R.atilanTasRenderEt(durum.sonAtilanTas, durum.okeyTasi, atilanContainer);
        }

        // Gösterge / Okey
        const gostergeAlani = document.getElementById('gosterge-alani');
        if (gostergeAlani && durum.gostergeTasi) {
            R.gostergeRenderEt(durum.gostergeTasi, durum.okeyTasi, gostergeAlani);
        }

        // Istaka
        const istakaContainer = document.getElementById('istaka-yigini');
        if (istakaContainer) {
            R.istakaRenderEt(durum.istakaSayisi, istakaContainer);
        }

        // Skor
        R.skorGuncelle(oyuncuBilgileri, pozisyonlar.findIndex(p => p.idx === durum.aktifOyuncuIndex));

        // Oyuncu atılan taşlar
        R.oyuncuAtilanTasGuncelle(oyuncuBilgileri, pozisyonlar.findIndex(p => p.idx === durum.sonTasAtanIndex), durum.okeyTasi);

        // Tur
        const turEl = document.getElementById('tur-sayisi');
        if (turEl) turEl.textContent = durum.tur;

        // Sıra göstergesi
        const siraEl = document.getElementById('sira-gosterge');
        if (siraEl) {
            if (durum.aktifOyuncuIndex === benimIndexim) {
                siraEl.textContent = `📍 Sıra SİZDE — ${durum.faz === 'cekme' ? 'Taş çekin' : 'Taş atın'}`;
                siraEl.className = 'sira-gosterge aktif';

                // Zorunlu açma geri sayımı
                if (durum.zorunluAcma && durum.zorunluAcmaKalanSure > 0) {
                    siraEl.textContent += ` | ⏰ EL AÇ: ${durum.zorunluAcmaKalanSure}s`;
                    siraEl.className = 'sira-gosterge aktif zorunlu-acma';
                    zorunluAcmaGeriSayimBaslat(durum.zorunluAcmaKalanSure);
                }
            } else {
                siraEl.textContent = `⏳ ${durum.oyuncular[durum.aktifOyuncuIndex]?.isim || '...'} oynuyor`;
                siraEl.className = 'sira-gosterge bekle';
            }
        }

        butonlariGuncelle();
    }

    /**
     * Pozisyon hesapla: benimIndexim'e göre diğer oyuncuların masa pozisyonları
     * Ben her zaman "güney", sağımdaki "doğu", karşımdaki "kuzey", solumdaki "batı"
     */
    function pozisyonHesapla() {
        const pozlar = ['guney', 'dogu', 'kuzey', 'bati'];
        const sonuc = [];
        for (let offset = 0; offset < 4; offset++) {
            const idx = (benimIndexim + offset) % 4;
            sonuc.push({ poz: pozlar[offset], idx });
        }
        return sonuc;
    }

    // ─── BUTON YÖNETİMİ ─────────────────────────────────────

    function butonlariGuncelle() {
        const benSirada = durum.aktifOyuncuIndex === benimIndexim && !durum.oyunBitti;
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
            const benimOyuncu = durum.oyuncular[benimIndexim];
            cifteBtn.disabled = durum.oyunBitti || (benimOyuncu && benimOyuncu.cifteIlanEtti);
        }
    }

    // ─── OYUNCU AKSİYONLARI ─────────────────────────────────

    function istakadanCek() {
        if (!socket) return;
        socket.emit('tasCek');
    }

    function tasAt(tasId) {
        if (!socket) return;
        const id = tasId || durum.seciliTasId;
        if (!id) return;
        socket.emit('tasAt', { tasId: id });
        durum.seciliTasId = null;
    }

    function elAcmayaDene() {
        if (!socket) return;
        socket.emit('elAc', { slotlar: rafSlots });
    }

    function cifteIlanEt() {
        if (!socket) return;
        socket.emit('cifteIlan');
    }

    function tasIsle(tileId, hedefOyuncuIndex, kombIndex) {
        if (!socket) return;
        // meldId formatı: "ownerIndex:kombIndex" — sunucu tarafıyla veya single-player ile aynı
        const meldId = `${hedefOyuncuIndex}:${kombIndex}`;
        socket.emit('tasIsle', { tileId, meldId });
    }


    // ─── TAŞ TIKLANMA / SÜRÜKLEME ─────────────────────────

    function tasaTiklandi(tas, slotIndex) {
        if (durum.aktifOyuncuIndex !== benimIndexim) return;

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
     * Sunucudan gelen el verisi ile yerel raf slotlarını senkronize eder.
     * @param {Array} yeniEl - Sunucudan gelen taş listesi
     */
    function rafSlotlariReconcile(yeniEl) {
        // Mevcut slotlardaki taşları ID'lerine göre haritala
        const mevcutIdler = new Set(yeniEl.map(t => t.id));

        // 1. Artık olmayan taşları temizle
        for (let i = 0; i < rafSlots.length; i++) {
            if (rafSlots[i] && !mevcutIdler.has(rafSlots[i].id)) {
                rafSlots[i] = null;
            }
        }

        // 2. Yeni gelen taşları bul (rafSlots'da olmayanlar)
        const olanIdler = new Set(rafSlots.filter(t => t !== null).map(t => t.id));
        const yeniGelenler = yeniEl.filter(t => !olanIdler.has(t.id));

        // 3. Yeni gelenleri boş slotlara yerleştir
        yeniGelenler.forEach(tas => {
            const bosIndex = rafSlots.indexOf(null);
            if (bosIndex !== -1) {
                rafSlots[bosIndex] = tas;
            }
        });

        // 4. Mevcut taşların verilerini güncelle (ID aynı kalır ama özellikler değişmiş olabilir)
        const elMap = new Map(yeniEl.map(t => [t.id, t]));
        for (let i = 0; i < rafSlots.length; i++) {
            if (rafSlots[i]) {
                rafSlots[i] = elMap.get(rafSlots[i].id);
            }
        }
    }

    function tasSuruklendiRafa(kaynakIndex, hedefIndex) {
        if (kaynakIndex === hedefIndex) return;

        const kaynakTas = rafSlots[kaynakIndex];
        const hedefTas = rafSlots[hedefIndex];

        // Yer değiştir veya boşluğa taşı
        rafSlots[hedefIndex] = kaynakTas;
        rafSlots[kaynakIndex] = hedefTas;

        Ses.tasSec(); // Sürükleme sesi olarak kullan
        tumEkraniGuncelle();
    }

    // ─── YANDAN AL SEÇENEĞİ ────────────────────────────────

    function yandanAlSecenekGoster(tas, atanIsim) {
        // Mevcut yandan al panelini kullan
        const panel = document.getElementById('yandan-al-panel');
        if (panel) {
            panel.style.display = 'flex';
            panel.innerHTML = `
                <div class="yandan-al-icerik">
                    <p>${atanIsim} taş attı — almak ister misiniz?</p>
                    <div class="yandan-al-tas">${tas.jokerMi ? '★ Joker' : tas.sayi + ' ' + tas.renk}</div>
                    <div class="yandan-al-butonlar">
                        <button id="btn-yandan-al-evet" class="btn-aksiyon btn-onayla">✔ Al (İzin İste)</button>
                        <button id="btn-yandan-al-pas" class="btn-aksiyon btn-reddet">✖ Pas</button>
                    </div>
                </div>
            `;

            document.getElementById('btn-yandan-al-evet').onclick = () => {
                panel.style.display = 'none';
                socket.emit('yandanAl');
            };
            document.getElementById('btn-yandan-al-pas').onclick = () => {
                panel.style.display = 'none';
                socket.emit('yandanAlPas');
            };

            // Otomatik kapanma (8s)
            setTimeout(() => {
                if (panel.style.display === 'flex') {
                    panel.style.display = 'none';
                    socket.emit('yandanAlPas');
                }
            }, 7500);
        }
    }

    // ─── İZİN POPUP ─────────────────────────────────────────

    function izinPopupGoster(isteyenIsim, tas) {
        R.izinPopupGoster(isteyenIsim, tas,
            () => {
                socket.emit('izinVer');
            },
            () => {
                socket.emit('izinReddet');
            }
        );
    }

    // ─── TUR SONU ───────────────────────────────────────────

    function turSonuGoster(data) {
        let html = `<h3>${data.kazanan ? data.kazanan.isim + ' kazandı!' : 'Tur bitti!'}</h3>`;
        html += `<p>${data.sebep || ''}</p>`;
        html += '<table class="tur-sonu-tablo"><thead><tr><th>Oyuncu</th><th>Puan</th><th>Durum</th></tr></thead><tbody>';
        for (const o of data.oyuncular) {
            html += `<tr><td>${o.isim}</td><td>${o.puan}</td><td>${o.elAcildi ? '✅ Açık' : '❌ Kapalı'}</td></tr>`;
        }
        html += '</tbody></table>';

        const modal = document.createElement('div');
        modal.className = 'tur-sonu-modal';
        modal.innerHTML = `
            <div class="tur-sonu-kutu">
                ${html}
                <button class="btn-aksiyon" onclick="this.closest('.tur-sonu-modal').remove()">Kapat</button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // ─── BAŞLATMA ───────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', () => {
        lobiBaslat();

        // Buton bağlantıları
        const cekBtn = document.getElementById('btn-cek');
        const atBtn = document.getElementById('btn-at');
        const acBtn = document.getElementById('btn-ac');
        const cifteBtn = document.getElementById('btn-cifte');

        if (cekBtn) cekBtn.addEventListener('click', istakadanCek);
        if (atBtn) atBtn.addEventListener('click', () => tasAt());
        if (acBtn) acBtn.addEventListener('click', elAcmayaDene);
        if (cifteBtn) cifteBtn.addEventListener('click', cifteIlanEt);
    });

})();
