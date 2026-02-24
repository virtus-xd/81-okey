/**
 * 81 Okey — Ses Efektleri Modülü
 * 
 * Web Audio API ile sentezlenmiş ses efektleri.
 * Hiçbir harici ses dosyası gerektirmez — tüm sesler programatik olarak üretilir.
 */

(function () {
    'use strict';

    let audioCtx = null;
    let sesAcik = true;

    /** AudioContext'i başlat (kullanıcı etkileşimi gerektirir) */
    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    /** Ses açma/kapama */
    function sesToggle() {
        sesAcik = !sesAcik;
        return sesAcik;
    }

    /** Basit bir nota çalar */
    function notaCal(frekans, sure = 0.15, tip = 'sine', hacim = 0.3, gecikme = 0) {
        if (!sesAcik || !audioCtx) return;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = tip;
        osc.frequency.value = frekans;

        gain.gain.setValueAtTime(0, audioCtx.currentTime + gecikme);
        gain.gain.linearRampToValueAtTime(hacim, audioCtx.currentTime + gecikme + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + gecikme + sure);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(audioCtx.currentTime + gecikme);
        osc.stop(audioCtx.currentTime + gecikme + sure);
    }

    /** Gürültü (noise) oluşturur — taş sesleri için */
    function gurutuCal(sure = 0.08, hacim = 0.1) {
        if (!sesAcik || !audioCtx) return;

        const bufferSize = audioCtx.sampleRate * sure;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.5;
        }

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(hacim, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + sure);

        // Lowpass filter — ahşap çarpma hissi
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        source.start();
    }

    // ─── SES EFEKTLERİ ─────────────────────────────────────

    /** Taş çekme sesi — hafif tık */
    function tasCek() {
        initAudio();
        gurutuCal(0.06, 0.12);
        notaCal(600, 0.08, 'sine', 0.15);
    }

    /** Taş atma sesi — biraz daha sert tık */
    function tasAt() {
        initAudio();
        gurutuCal(0.1, 0.15);
        notaCal(400, 0.1, 'sine', 0.12);
    }

    /** Taş tıklama — seçme sesi */
    function tasSec() {
        initAudio();
        notaCal(800, 0.06, 'sine', 0.1);
    }

    /** El açma sesi — yükselen arpej */
    function elAc() {
        initAudio();
        const notalar = [523, 659, 784, 1047]; // C5, E5, G5, C6
        notalar.forEach((f, i) => {
            notaCal(f, 0.2, 'sine', 0.2, i * 0.08);
        });
    }

    /** Kafa atma fanfar sesi */
    function kafaAt() {
        initAudio();
        // Kısa zafer fanfarı
        const notalar = [523, 659, 784, 1047, 1319];
        notalar.forEach((f, i) => {
            notaCal(f, 0.25, 'square', 0.12, i * 0.1);
        });
        // Trompet benzeri uzun nota
        notaCal(1047, 0.5, 'sawtooth', 0.08, 0.5);
    }

    /** Çift kafa atma — daha dramatik fanfar */
    function ciftKafaAt() {
        initAudio();
        // Büyük fanfar
        const notalar = [392, 523, 659, 784, 1047, 1319, 1568];
        notalar.forEach((f, i) => {
            notaCal(f, 0.3, 'square', 0.1, i * 0.08);
        });
        notaCal(1568, 0.6, 'sawtooth', 0.1, 0.6);
        notaCal(1047, 0.6, 'sawtooth', 0.06, 0.6);
    }

    /** Çifte ilan etme sesi — gerilim */
    function cifteIlan() {
        initAudio();
        // Dramatik düşen akor
        notaCal(880, 0.3, 'square', 0.15);
        notaCal(659, 0.3, 'square', 0.12, 0.15);
        notaCal(440, 0.4, 'sawtooth', 0.1, 0.3);
        // Thunder-benzeri gürültü
        gurutuCal(0.3, 0.08);
    }

    /** Çifte geçti — uyarı sesi */
    function cifteGecti() {
        initAudio();
        // Alarm benzeri
        notaCal(880, 0.15, 'square', 0.15);
        notaCal(660, 0.15, 'square', 0.15, 0.15);
        notaCal(880, 0.15, 'square', 0.15, 0.3);
    }

    /** İzin isteme — dikkat sesi */
    function izinIste() {
        initAudio();
        notaCal(660, 0.1, 'sine', 0.15);
        notaCal(880, 0.15, 'sine', 0.15, 0.12);
    }

    /** İzin verildi */
    function izinVerildi() {
        initAudio();
        notaCal(523, 0.1, 'sine', 0.15);
        notaCal(784, 0.2, 'sine', 0.15, 0.1);
    }

    /** İzin reddedildi */
    function izinReddet() {
        initAudio();
        notaCal(300, 0.2, 'square', 0.15);
        notaCal(200, 0.3, 'square', 0.15, 0.2);
    }

    /** Tur sonu sesi */
    function turSonu() {
        initAudio();
        notaCal(440, 0.3, 'sine', 0.2);
        notaCal(330, 0.3, 'sine', 0.2, 0.3);
        notaCal(262, 0.5, 'sine', 0.15, 0.6);
    }

    /** Zamanlayıcı uyarı (son 5 saniye) */
    function zamanlayiciUyari() {
        initAudio();
        notaCal(1000, 0.05, 'sine', 0.08);
    }

    /** Sayaç tick sesi (canlı puan sayacı için) */
    function sayacTick() {
        initAudio();
        notaCal(1200, 0.03, 'sine', 0.05);
    }

    // ─── GLOBAL EXPORT ─────────────────────────────────────

    window.SesEfekt = {
        initAudio,
        sesToggle,
        tasCek,
        tasAt,
        tasSec,
        elAc,
        kafaAt,
        ciftKafaAt,
        cifteIlan,
        cifteGecti,
        izinIste,
        izinVerildi,
        izinReddet,
        turSonu,
        zamanlayiciUyari,
        sayacTick
    };

})();
