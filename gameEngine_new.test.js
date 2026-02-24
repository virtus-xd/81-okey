const assert = require('assert');
const GE = require('./gameEngine');

console.log('🧪 Testing New GameEngine Functions...');

// 1. slotlariGrupla Test
console.log('  Testing slotlariGrupla...');
const mockSlots = new Array(28).fill(null);
mockSlots[0] = { id: 1, sayi: 3, renk: 'kirmizi' };
mockSlots[1] = { id: 2, sayi: 4, renk: 'kirmizi' };
mockSlots[2] = { id: 3, sayi: 5, renk: 'kirmizi' };
// Blank at index 3
mockSlots[4] = { id: 4, sayi: 7, renk: 'mavi' };
mockSlots[5] = { id: 5, sayi: 7, renk: 'sari' };
mockSlots[6] = { id: 6, sayi: 7, renk: 'siyah' };

const gruplar = GE.slotlariGrupla(mockSlots);
assert.strictEqual(gruplar.length, 2, 'Should find 2 groups');
assert.strictEqual(gruplar[0].length, 3, 'First group should have 3 tiles');
assert.strictEqual(gruplar[1].length, 3, 'Second group should have 3 tiles');
console.log('    ✅ slotlariGrupla passed');

// 2. elAcmaKontrol Test (Sequence)
console.log('  Testing elAcmaKontrol (Sequence)...');
const okeyTasi = { sayi: 1, renk: 'mavi' }; // Okey doesn't matter much for this test
const result = GE.elAcmaKontrol(mockSlots, okeyTasi, 10);
assert.ok(result, 'Should allow opening with sequence');
assert.strictEqual(result.yontem, 'seri');
// 3+4+5 = 12, 7+7+7 = 21. Total = 33
assert.strictEqual(result.puan, 33, 'Total score should be 33');
console.log('    ✅ elAcmaKontrol (Sequence) passed');

// 3. User Issue: 4+ tiles sequence
console.log('  Testing 4+ tiles sequence (User Issue)...');
const longSeqSlots = new Array(28).fill(null);
longSeqSlots[0] = { id: 10, sayi: 9, renk: 'kirmizi' };
longSeqSlots[1] = { id: 11, sayi: 10, renk: 'kirmizi' };
longSeqSlots[2] = { id: 12, sayi: 11, renk: 'kirmizi' };
longSeqSlots[3] = { id: 13, sayi: 12, renk: 'kirmizi' };
longSeqSlots[4] = { id: 14, sayi: 13, renk: 'kirmizi' };

const longResult = GE.elAcmaKontrol(longSeqSlots, okeyTasi, 20);
assert.ok(longResult, 'Should allow opening with 5-tile sequence');
assert.strictEqual(longResult.puan, 9 + 10 + 11 + 12 + 13, 'Score should be 55');
console.log('    ✅ 4+ tiles sequence passed');

// 4. Double (Çift) opening
console.log('  Testing Double (Çift) opening...');
const ciftSlots = new Array(28).fill(null);
ciftSlots[0] = { id: 1, sayi: 5, renk: 'kirmizi' };
ciftSlots[1] = { id: 2, sayi: 5, renk: 'kirmizi' };
// Blank
ciftSlots[3] = { id: 3, sayi: 8, renk: 'mavi' };
ciftSlots[4] = { id: 4, sayi: 8, renk: 'mavi' };
// Blank
ciftSlots[6] = { id: 5, sayi: 1, renk: 'sari' };
ciftSlots[7] = { id: 6, sayi: 1, renk: 'sari' };
// Blank
ciftSlots[9] = { id: 7, sayi: 12, renk: 'siyah' };
ciftSlots[10] = { id: 8, sayi: 12, renk: 'siyah' };

const ciftResult = GE.elAcmaKontrol(ciftSlots, okeyTasi, 81);
assert.ok(ciftResult, 'Should allow opening with 4 doubles');
assert.strictEqual(ciftResult.yontem, 'cift');
console.log('    ✅ Double (Çift) opening passed');

console.log('\n🚀 ALL NEW TESTS PASSED!');
process.exit(0);
