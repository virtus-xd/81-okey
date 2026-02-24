const assert = require('assert');
const GE = require('./gameEngine.js');

function testSahteOkeyScoring() {
    console.log('Testing Sahte Okey Scoring Fix...');

    // Okey is Red 5
    const okeyTasi = { sayi: 5, renk: 'kirmizi' };

    // 1. Per Test: Yellow 5, Blue 5, Sahte Okey (acts as Red 5)
    // Note: Sahte okey will adapt the dominant color (sari) in kombinasyonGecerliMi
    // BUT _perKontrol expects different COLORS for per. 
    // If Sahte Okey adapts 'sari', and we already have a 'sari 5', it would fail.
    // So Sahte Okey must resolve to a color not present in the per.
    const slotlarPer = new Array(28).fill(null);
    slotlarPer[0] = { id: 'p1', sayi: 5, renk: 'sari' };
    slotlarPer[1] = { id: 'p2', sayi: 5, renk: 'mavi' };
    slotlarPer[2] = { id: 'p3', sayi: 0, renk: 'joker', jokerMi: true };

    const gruplarPer = GE.slotlariGrupla(slotlarPer);
    if (gruplarPer.length === 0) {
        console.error('❌ Error: Per group not detected by slotlariGrupla');
        process.exit(1);
    }

    const puanPer = GE.elPuaniniHesapla(slotlarPer, okeyTasi);
    console.log(`Calculated Per Hand Score: ${puanPer}`);
    assert.strictEqual(puanPer, 15, 'Per hand score should be 15 (5+5+5)');

    // 2. Seri Test: Sari 3, Sari 4, Sahte Okey (Acts as Sari 5)
    const slotlarSeri = new Array(28).fill(null);
    slotlarSeri[14] = { id: 's1', sayi: 3, renk: 'sari' };
    slotlarSeri[15] = { id: 's2', sayi: 4, renk: 'sari' };
    slotlarSeri[16] = { id: 's3', sayi: 0, renk: 'sari', jokerMi: true };

    const gruplarSeri = GE.slotlariGrupla(slotlarSeri);
    if (gruplarSeri.length === 0) {
        console.error('❌ Error: Seri group not detected by slotlariGrupla');
        process.exit(1);
    }

    const puanSeri = GE.elPuaniniHesapla(slotlarSeri, okeyTasi);
    console.log(`Calculated Seri Hand Score: ${puanSeri}`);
    assert.strictEqual(puanSeri, 12, 'Seri hand score should be 12 (3+4+5)');

    console.log('✅ Sahte Okey Scoring Fix Verified Successfully!');
}

try {
    testSahteOkeyScoring();
} catch (error) {
    console.error('❌ Test Failed:');
    console.error(error.message);
    process.exit(1);
}
