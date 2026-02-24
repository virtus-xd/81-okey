/**
 * 81 Okey — Taş Renderer (DOM Tabanlı)
 * 
 * Taşları DOM elemanları olarak oluşturur ve yönetir.
 * Canvas yerine DOM kullanarak kolay drag & drop desteği sağlar.
 */

(function () {
    'use strict';

    const RENK_SINIF = {
        'Kırmızı': 'kirmizi', 'kirmizi': 'kirmizi', 'Kirmizi': 'kirmizi',
        'Sarı': 'sari', 'sari': 'sari', 'Sari': 'sari',
        'Mavi': 'mavi', 'mavi': 'mavi',
        'Siyah': 'siyah', 'siyah': 'siyah',
        joker: 'joker'
    };

    const RENK_EMOJI = {
        kirmizi: '●',
        sari: '●',
        mavi: '●',
        siyah: '●'
    };

    /**
     * Tek bir taş DOM elemanı oluşturur.
     * @param {Object} tas - Taş verisi
     * @param {Object} okeyTasi - Okey taşı (wildcard tespiti için)
     * @param {Object} [secenekler] - Ek seçenekler
     * @returns {HTMLElement} Taş DOM elemanı
     */
    function tasOlustur(tas, okeyTasi = null, secenekler = {}) {
        const el = document.createElement('div');
        el.className = 'tas';
        el.dataset.tasId = tas.id;

        // Mantıksal değerler (Görsel için)
        let renderSayi = tas.sayi;
        let renderRenk = tas.renk;

        // Sahte Okey (Yıldızlı taş) -> Okeyin değerini gösterir
        if (tas.jokerMi && okeyTasi) {
            renderSayi = okeyTasi.sayi;
            renderRenk = okeyTasi.renk;
        }

        el.dataset.sayi = renderSayi;
        el.dataset.renk = renderRenk;

        if (secenekler.kapali) {
            el.classList.add('kapali');
            if (secenekler.kucuk) el.classList.add('kucuk');
            return el;
        }

        // Renk sınıfı
        el.classList.add(RENK_SINIF[renderRenk] || 'siyah');

        if (secenekler.kucuk) {
            el.classList.add('kucuk');
        }

        // İçerik
        if (tas.jokerMi) {
            // Sahte okey: Sadece yıldız gösterilir
            el.innerHTML = `<span class="tas-sahte-okey-yildiz">★</span>`;
            el.classList.add('sahte-okey');
        } else {
            // Normal taş veya Gerçek Okey (Wild Card)
            el.innerHTML = `<span class="tas-sayi">${tas.sayi}</span>`;

            // Eğer bu taş okeyse (wild card olarak belirlendiyse)
            if (okeyTasi && tas.sayi === okeyTasi.sayi && tas.renk === okeyTasi.renk) {
                el.classList.add('okey-wild');
                el.innerHTML += '<span class="tas-wild-ikon">★</span>';
            }
        }

        return el;
    }

    /**
     * Oyuncu eli taşlarını raf üzerinde render eder. (2 Katlı, 28 Slot)
     * @param {Array} slotlar - 28 elemanlı dizi (taş objesi veya null)
     * @param {HTMLElement} rafEl - Raf DOM elemanı
     * @param {Object} okeyTasi - Okey taşı
     * @param {Object} secenekler - { seciliTasId, onTasClick, onSlotDrop, ... }
     */
    function eliRenderEt(slotlar, rafEl, okeyTasi, secenekler = {}) {
        rafEl.innerHTML = '';
        const toplamSlot = 28;

        for (let i = 0; i < toplamSlot; i++) {
            const slotEl = document.createElement('div');
            slotEl.className = 'tas-slot';
            slotEl.dataset.slotIndex = i;

            const tas = slotlar[i];

            if (tas) {
                const tasEl = tasOlustur(tas, okeyTasi, secenekler);
                tasEl.dataset.slotIndex = i;
                tasEl.draggable = true;

                // Seçili taş vurgusu
                if (secenekler.seciliTasId && secenekler.seciliTasId === tas.id) {
                    tasEl.classList.add('secili');
                }

                // Tıklama
                tasEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (secenekler.onTasClick) secenekler.onTasClick(tas, i);
                });

                // Drag başlangıcı
                tasEl.addEventListener('dragstart', (e) => {
                    tasEl.classList.add('surukleniyor');
                    e.dataTransfer.setData('text/plain', JSON.stringify({ id: tas.id, slotIndex: i }));
                    e.dataTransfer.effectAllowed = 'move';
                });

                tasEl.addEventListener('dragend', () => {
                    tasEl.classList.remove('surukleniyor');
                    document.querySelectorAll('.tas-slot.drop-hedef').forEach(el => el.classList.remove('drop-hedef'));
                });

                slotEl.appendChild(tasEl);
            } else {
                slotEl.classList.add('bos');
            }

            // Slot drop hedefleri
            slotEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                slotEl.classList.add('drop-hedef');
            });

            slotEl.addEventListener('dragleave', () => {
                slotEl.classList.remove('drop-hedef');
            });

            slotEl.addEventListener('drop', (e) => {
                e.preventDefault();
                slotEl.classList.remove('drop-hedef');
                try {
                    const veri = JSON.parse(e.dataTransfer.getData('text/plain'));
                    if (secenekler.onSlotDrop) {
                        secenekler.onSlotDrop(veri.slotIndex, i);
                    }
                } catch (err) { /* ignore */ }
            });

            rafEl.appendChild(slotEl);
        }
    }

    /**
     * Diğer oyuncuların kapalı taşlarını render eder (canvas üzerinde bilgi olarak).
     * @param {number} tasSayisi - Oyuncunun elindeki taş sayısı
     * @param {string} pozisyon - 'kuzey', 'dogu', 'bati'
     * @returns {HTMLElement} Kapalı taş grubu
     */
    function kapaliTaslarOlustur(tasSayisi, pozisyon) {
        const container = document.createElement('div');
        container.className = `kapali-taslar ${pozisyon}`;
        container.style.display = 'flex';
        container.style.gap = '2px';

        const gosterilenSayi = Math.min(tasSayisi, pozisyon === 'kuzey' ? 14 : 7);

        for (let i = 0; i < gosterilenSayi; i++) {
            const tas = document.createElement('div');
            tas.className = 'tas kapali kucuk';
            container.appendChild(tas);
        }

        return container;
    }

    /**
     * Istaka yığınını render eder.
     * @param {number} kalanSayi - Kalan taş sayısı
     * @param {HTMLElement} container - Istaka container
     */
    function istakaRenderEt(kalanSayi, container) {
        container.innerHTML = '';

        // 3 kapalı taş yığını
        for (let i = 0; i < 3; i++) {
            const tas = document.createElement('div');
            tas.className = 'istaka-tas';
            container.appendChild(tas);
        }

        // Sayı göstergesi
        const sayiEl = document.createElement('div');
        sayiEl.id = 'istaka-sayi';
        sayiEl.textContent = kalanSayi;
        container.appendChild(sayiEl);
    }

    /**
     * Gösterge taşını render eder.
     * @param {Object} gostergeTasi - Gösterge taşı
     * @param {Object} okeyTasi - Okey taşı
     * @param {HTMLElement} container - Gösterge alanı
     */
    function gostergeRenderEt(gostergeTasi, okeyTasi, container) {
        container.innerHTML = '';

        const etiket = document.createElement('div');
        etiket.className = 'etiket';
        etiket.textContent = 'GÖSTERGE';
        container.appendChild(etiket);

        const tasEl = tasOlustur(gostergeTasi, okeyTasi, { kucuk: true });
        container.appendChild(tasEl);

        const okeyBilgi = document.createElement('div');
        okeyBilgi.className = 'okey-bilgi';
        if (okeyTasi.jokerMi) {
            okeyBilgi.textContent = 'Okey: ★ Joker';
        } else {
            okeyBilgi.textContent = `Okey: ${okeyTasi.sayi} ${okeyTasi.renk}`;
        }
        container.appendChild(okeyBilgi);
    }

    /**
     * Atılan taşı render eder.
     * @param {Object|null} tas - Atılan taş (yoksa boş)
     * @param {HTMLElement} container - Atılan taş alanı container
     */
    function atilanTasRenderEt(tas, okeyTasi, container) {
        container.innerHTML = '';

        const etiket = document.createElement('div');
        etiket.className = 'etiket';
        etiket.textContent = 'ATILAN';
        container.appendChild(etiket);

        if (tas) {
            const tasEl = tasOlustur(tas, okeyTasi, { kucuk: true });
            tasEl.style.cursor = 'pointer';
            tasEl.id = 'son-atilan-tas';
            container.appendChild(tasEl);
        } else {
            const bos = document.createElement('div');
            bos.className = 'tas kucuk kapali';
            bos.style.opacity = '0.3';
            container.appendChild(bos);
        }
    }

    /**
     * Açılmış kombinasyonları render eder.
     * @param {Array<Array>} kombinasyonlar - Açılmış kombinasyonlar
     * @param {HTMLElement} container - Açılmış alan container
     * @param {Object} [secenekler] - { onTasIsleDrop, oyuncuIndex }
     */
    function acilmisKombRenderEt(kombinasyonlar, container, okeyTasi, secenekler = {}) {
        container.innerHTML = '';

        for (let ki = 0; ki < kombinasyonlar.length; ki++) {
            const komb = kombinasyonlar[ki];
            const grup = document.createElement('div');
            grup.className = 'kombinasyon-grubu';
            grup.style.position = 'relative';
            grup.dataset.kombIndex = ki;
            if (secenekler.oyuncuIndex !== undefined) {
                grup.dataset.oyuncuIndex = secenekler.oyuncuIndex;
            }

            let puan = 0;
            for (const tas of komb) {
                const tasEl = tasOlustur(tas, okeyTasi, { kucuk: true });
                tasEl.style.cursor = 'default';
                grup.appendChild(tasEl);

                // Puan hesapla (Real Okey = 0, Sahte Okey = Okey Değeri)
                if (okeyTasi && tas.sayi === okeyTasi.sayi && tas.renk === okeyTasi.renk && !tas.jokerMi) {
                    puan += 0;
                } else if (tas.jokerMi && okeyTasi) {
                    puan += okeyTasi.sayi;
                } else {
                    puan += tas.sayi;
                }
            }

            // Puan badge
            const badge = document.createElement('div');
            badge.className = 'puan-badge';
            badge.textContent = puan;
            grup.appendChild(badge);

            // Drag-drop hedefi (taş işleme için)
            if (secenekler.onTasIsleDrop) {
                grup.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                    grup.classList.add('isle-hedef');
                });

                grup.addEventListener('dragleave', () => {
                    grup.classList.remove('isle-hedef');
                });

                grup.addEventListener('drop', (e) => {
                    e.preventDefault();
                    grup.classList.remove('isle-hedef');
                    try {
                        const veri = JSON.parse(e.dataTransfer.getData('text/plain'));
                        const tasIdx = veri.slotIndex; // dragstart'ta 'slotIndex' ile gönderildi
                        const oyuncuIdx = parseInt(grup.dataset.oyuncuIndex);
                        const kombIdx = parseInt(grup.dataset.kombIndex);
                        if (secenekler.onTasIsleDrop && tasIdx !== undefined) {
                            secenekler.onTasIsleDrop(tasIdx, oyuncuIdx, kombIdx);
                        }
                    } catch (err) { /* ignore */ }
                });
            }

            container.appendChild(grup);
        }
    }

    /**
     * Banner mesajı gösterir (kafa atma vb.)
     * @param {string} mesaj - Banner mesajı
     * @param {string} [renk] - Renk sınıfı
     */
    function bannerGoster(mesaj, renk) {
        const banner = document.getElementById('banner');
        if (!banner) return;

        banner.textContent = mesaj;
        if (renk) banner.style.color = renk;
        banner.className = 'goster';

        setTimeout(() => {
            banner.className = '';
            banner.style.color = '';
        }, 2500);
    }

    /**
     * Bildirim gösterir.
     * @param {string} mesaj - Bildirim mesajı
     * @param {string} [tip] - 'cifte-bildirim' vb.
     * @param {number} [sure=3000] - Gösterim süresi (ms)
     */
    function bildirimGoster(mesaj, tip, sure = 3000) {
        const container = document.getElementById('bildirimler');
        if (!container) return;

        const el = document.createElement('div');
        el.className = `bildirim ${tip || ''}`;
        el.textContent = mesaj;
        container.appendChild(el);

        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(-10px)';
            el.style.transition = '0.3s ease';
            setTimeout(() => el.remove(), 300);
        }, sure);
    }

    /**
     * Skor tablosunu günceller.
     * @param {Array} oyuncular - Oyuncu bilgileri
     * @param {number} aktifIndex - Aktif oyuncu index'i
     */
    function skorGuncelle(oyuncular, aktifIndex) {
        const tbody = document.querySelector('#skor-tablo tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        oyuncular.forEach((o, i) => {
            const tr = document.createElement('tr');
            if (i === aktifIndex) tr.className = 'aktif-skor';
            tr.innerHTML = `<td>${o.isim}</td><td>${o.puan || 0}</td>`;
            tbody.appendChild(tr);
        });
    }

    /**
     * Oyuncu panellerini günceller.
     * @param {Array} oyuncular - Oyuncu bilgileri
     * @param {number} aktifIndex - Aktif oyuncu index'i
     */
    function oyuncuPanelleriGuncelle(oyuncular, aktifIndex) {
        const pozisyonlar = ['guney', 'dogu', 'kuzey', 'bati'];

        pozisyonlar.forEach((poz, i) => {
            const panel = document.getElementById(`oyuncu-${poz}`);
            if (!panel || !oyuncular[i]) return;

            const oyuncu = oyuncular[i];
            panel.querySelector('.isim').textContent = oyuncu.isim;
            panel.querySelector('.puan').textContent = `${oyuncu.puan || 0} puan`;

            const tasSayiEl = panel.querySelector('.tas-sayisi');
            if (tasSayiEl && oyuncu.el) {
                tasSayiEl.textContent = `${oyuncu.el.length} taş`;
            }

            if (i === aktifIndex) {
                panel.classList.add('aktif');
            } else {
                panel.classList.remove('aktif');
            }
        });
    }

    /**
     * Modal gösterir.
     * @param {string} baslik - Modal başlığı
     * @param {string} icerik - Modal içeriği (HTML)
     * @param {Array} butonlar - [{text, sinif, onClick}]
     */
    function modalGoster(baslik, icerik, butonlar = []) {
        const overlay = document.getElementById('modal-overlay');
        if (!overlay) return;

        const modal = overlay.querySelector('.modal');
        modal.innerHTML = '';

        const h2 = document.createElement('h2');
        h2.textContent = baslik;
        modal.appendChild(h2);

        const p = document.createElement('div');
        p.innerHTML = icerik;
        p.style.cssText = 'font-size:14px;color:rgba(255,255,255,0.7);text-align:center;margin-bottom:20px;line-height:1.5;';
        modal.appendChild(p);

        if (butonlar.length > 0) {
            const btnContainer = document.createElement('div');
            btnContainer.className = 'modal-butonlar';

            for (const btn of butonlar) {
                const btnEl = document.createElement('button');
                btnEl.className = `aksiyon-btn ${btn.sinif || ''}`;
                btnEl.textContent = btn.text;
                btnEl.addEventListener('click', () => {
                    modalKapat();
                    if (btn.onClick) btn.onClick();
                });
                btnContainer.appendChild(btnEl);
            }

            modal.appendChild(btnContainer);
        }

        overlay.classList.add('gorunur');
    }

    /**
     * Modalı kapatır.
     */
    function modalKapat() {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.classList.remove('gorunur');
    }

    /**
     * İzin isteme popup'ı gösterir.
     * @param {string} isteyenIsim - İzin isteyen oyuncu adı
     * @param {Object} tas - İstenen taş
     * @param {Function} onIzinVer - İzin verildiğinde çağrılacak fonksiyon
     * @param {Function} onReddet - Reddedildiğinde çağrılacak fonksiyon
     */
    function izinPopupGoster(isteyenIsim, tas, onIzinVer, onReddet) {
        // Arka plan
        const arka = document.createElement('div');
        arka.className = 'izin-popup-arka';
        arka.id = 'izin-popup-arka';
        document.body.appendChild(arka);

        // Popup
        const popup = document.createElement('div');
        popup.className = 'izin-popup';
        popup.id = 'izin-popup';

        // Başlık
        const baslik = document.createElement('div');
        baslik.className = 'izin-baslik';
        baslik.textContent = '🤝 İzin İsteniyor!';
        popup.appendChild(baslik);

        // Mesaj
        const mesaj = document.createElement('div');
        mesaj.className = 'izin-mesaj';
        mesaj.innerHTML = `<strong>${isteyenIsim}</strong> attığın taşı almak istiyor:`;
        popup.appendChild(mesaj);

        // Taş gösterimi
        const tasAlani = document.createElement('div');
        tasAlani.className = 'izin-tas';
        const tasEl = tasOlustur(tas);
        tasAlani.appendChild(tasEl);
        popup.appendChild(tasAlani);

        // Butonlar
        const butonlar = document.createElement('div');
        butonlar.className = 'izin-butonlar';

        const verBtn = document.createElement('button');
        verBtn.className = 'aksiyon-btn basari';
        verBtn.textContent = '✅ İzin Ver';
        verBtn.addEventListener('click', () => {
            izinPopupKapat();
            if (onIzinVer) onIzinVer();
        });

        const redBtn = document.createElement('button');
        redBtn.className = 'aksiyon-btn tehlike';
        redBtn.textContent = '❌ Reddet';
        redBtn.addEventListener('click', () => {
            izinPopupKapat();
            if (onReddet) onReddet();
        });

        butonlar.appendChild(verBtn);
        butonlar.appendChild(redBtn);
        popup.appendChild(butonlar);

        document.body.appendChild(popup);
    }

    /**
     * İzin popup'ını kapatır.
     */
    function izinPopupKapat() {
        const popup = document.getElementById('izin-popup');
        const arka = document.getElementById('izin-popup-arka');
        if (popup) popup.remove();
        if (arka) arka.remove();
    }

    /**
     * Çifte gösterge durumunu günceller.
     * @param {boolean} aktifMi - Gösterge görünür olacak mı
     * @param {string} [metin] - Opsiyonel alternatif metin
     */
    function cifteGostergeGuncelle(aktifMi, metin) {
        const el = document.getElementById('cifte-gosterge');
        if (!el) return;

        if (aktifMi) {
            el.classList.add('gorunur');
            if (metin) el.textContent = metin;
        } else {
            el.classList.remove('gorunur');
        }
    }

    /**
     * Canlı puan sayacı gösterir.
     * El açılırken puanın 0'dan hedef puana animasyonlu olarak sayılmasını sağlar.
     * 
     * @param {number} hedefPuan - Hedef puan
     * @param {string} oyuncuIsim - Oyuncu adı
     * @param {string} yontem - 'seri' veya 'cift'
     * @returns {Promise} Animasyon tamamlandığında resolve olur
     */
    function canliSayacGoster(hedefPuan, oyuncuIsim, yontem = 'seri') {
        return new Promise((resolve) => {
            const overlay = document.getElementById('canli-sayac-overlay');
            const degerEl = document.getElementById('sayac-deger');
            const etiketEl = document.getElementById('sayac-etiket');
            const baslikEl = overlay?.querySelector('.sayac-baslik');

            if (!overlay || !degerEl || !etiketEl) {
                resolve();
                return;
            }

            // Başlığı ayarla
            if (baslikEl) {
                baslikEl.textContent = yontem === 'cift'
                    ? `${oyuncuIsim} — ÇİFT AÇIYOR`
                    : `${oyuncuIsim} — EL AÇIYOR`;
            }

            // Sıfırla
            degerEl.textContent = '0';
            degerEl.className = 'sayac-deger';
            etiketEl.textContent = '';
            etiketEl.className = 'sayac-etiket';

            // Göster
            overlay.classList.add('gorunur');

            // Sayaç animasyonu
            let mevcutDeger = 0;
            const adimSayisi = Math.min(hedefPuan, 40); // Max 40 adım
            const adimDeger = hedefPuan / adimSayisi;
            const adimSure = Math.max(30, 1500 / adimSayisi); // Toplam ~1.5s
            let adim = 0;

            const interval = setInterval(() => {
                adim++;
                mevcutDeger = Math.round(adimDeger * adim);
                if (mevcutDeger >= hedefPuan) mevcutDeger = hedefPuan;

                degerEl.textContent = mevcutDeger;

                // Tick sesi
                if (adim % 3 === 0 && window.SesEfekt) {
                    window.SesEfekt.sayacTick();
                }

                // Renk değişimi
                if (yontem === 'seri') {
                    if (mevcutDeger >= 121) {
                        degerEl.className = 'sayac-deger cift-kafa';
                        etiketEl.textContent = '🔥 ÇİFT KAFA! -200 Puan';
                        etiketEl.className = 'sayac-etiket cift-kafa gorunur';
                    } else if (mevcutDeger >= 101) {
                        degerEl.className = 'sayac-deger kafa';
                        etiketEl.textContent = '🎯 KAFA ATTINIZ! -100 Puan';
                        etiketEl.className = 'sayac-etiket kafa gorunur';
                    }
                }

                if (mevcutDeger >= hedefPuan) {
                    clearInterval(interval);

                    // Çift kafa/kafa finalinde sparkle efekti
                    if (yontem === 'seri' && hedefPuan >= 101) {
                        sparkleEfekti(hedefPuan >= 121 ? '#ffd700' : '#4ade80');
                    }

                    // 2 saniye bekle ve kapat
                    setTimeout(() => {
                        overlay.classList.remove('gorunur');
                        resolve();
                    }, 2000);
                }
            }, adimSure);
        });
    }

    /**
     * Sparkle (parıltı) efekti oluşturur.
     * @param {string} renk - Parçacık rengi
     * @param {number} [adet=30] - Parçacık sayısı
     */
    function sparkleEfekti(renk = '#ffd700', adet = 30) {
        const container = document.getElementById('sparkle-container');
        if (!container) return;

        for (let i = 0; i < adet; i++) {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle';
            sparkle.style.backgroundColor = renk;
            sparkle.style.left = `${40 + Math.random() * 20}%`;
            sparkle.style.top = `${40 + Math.random() * 20}%`;
            sparkle.style.width = `${4 + Math.random() * 8}px`;
            sparkle.style.height = sparkle.style.width;
            sparkle.style.setProperty('--sx', `${(Math.random() - 0.5) * 300}px`);
            sparkle.style.setProperty('--sy', `${(Math.random() - 0.5) * 300}px`);
            sparkle.style.animationDelay = `${Math.random() * 0.3}s`;
            sparkle.style.opacity = `${0.5 + Math.random() * 0.5}`;

            container.appendChild(sparkle);

            // Temizle
            setTimeout(() => sparkle.remove(), 2000);
        }
    }

    /**
     * Her oyuncunun köşesindeki atılan taş alanını günceller.
     * @param {Array} oyuncular - [{isim, sonAtilanTas}]
     * @param {number} sonAtanIndex - En son taş atan oyuncunun index'i (-1 ise yok)
     */
    function oyuncuAtilanTasGuncelle(oyuncular, sonAtanIndex, okeyTasi) {
        const pozisyonlar = ['guney', 'dogu', 'kuzey', 'bati'];

        pozisyonlar.forEach((poz, i) => {
            const alan = document.getElementById(`atilan-${poz}`);
            if (!alan) return;

            const yuvasi = alan.querySelector('.atilan-tas-yuvasi');
            if (!yuvasi) return;

            const oyuncu = oyuncular[i];
            yuvasi.innerHTML = '';

            // Aktif vurgu
            if (i === sonAtanIndex) {
                alan.classList.add('aktif-atilan');
            } else {
                alan.classList.remove('aktif-atilan');
            }

            if (oyuncu && oyuncu.sonAtilanTas) {
                const tasEl = tasOlustur(oyuncu.sonAtilanTas, okeyTasi, { kucuk: true });
                tasEl.style.cursor = 'default';
                yuvasi.appendChild(tasEl);
            } else {
                // Boş placeholder
                const bos = document.createElement('div');
                bos.className = 'tas kucuk kapali';
                bos.style.opacity = '0.15';
                yuvasi.appendChild(bos);
            }
        });
    }

    /**
     * El puanı sayacını günceller.
     * @param {number} puan - Toplam per puanı
     */
    function elPuaniGuncelle(puan) {
        const degerEl = document.getElementById('el-puani-deger');
        const konteynirEl = document.getElementById('el-puani-konteynir');
        if (degerEl) degerEl.textContent = puan;
        if (konteynirEl) {
            if (puan > 0) konteynirEl.classList.add('aktif');
            else konteynirEl.classList.remove('aktif');
        }
    }

    // Global export
    window.Renderer = {
        tasOlustur,
        eliRenderEt,
        kapaliTaslarOlustur,
        istakaRenderEt,
        gostergeRenderEt,
        atilanTasRenderEt,
        acilmisKombRenderEt,
        bannerGoster,
        bildirimGoster,
        skorGuncelle,
        oyuncuPanelleriGuncelle,
        modalGoster,
        modalKapat,
        izinPopupGoster,
        izinPopupKapat,
        cifteGostergeGuncelle,
        canliSayacGoster,
        sparkleEfekti,
        oyuncuAtilanTasGuncelle,
        elPuaniGuncelle
    };

})();
