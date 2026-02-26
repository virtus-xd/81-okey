const fs = require('fs');

const gePath = 'gameEngine.js';
let geConfig = fs.readFileSync(gePath, 'utf8');

// Insert a log right before the loop in islerTasBelirle
geConfig = geConfig.replace(
    /for \(const kombinasyon of kombinasyonlar\) \{/,
    "console.log('islerTasBelirle CALL:', { atilacakTas, numKombs: kombinasyonlar.length, kombs: JSON.stringify(kombinasyonlar, null, 2) });\n  for (const kombinasyon of kombinasyonlar) {"
);

fs.writeFileSync('gameEngine_debug.js', geConfig);

const mockGame = `
const GE = require('./gameEngine_debug.js');
const durum = {
    oyuncular: [
        {
            acilmisKombs: [
                [
                    {sayi: 5, renk: 'kirmizi', id: 't1', jokerMi: false},
                    {sayi: 6, renk: 'kirmizi', id: 't2', jokerMi: false},
                    {sayi: 7, renk: 'kirmizi', id: 't3', jokerMi: false}
                ]
            ],
            puan: 0
        }
    ],
    okeyTasi: {sayi: 13, renk: 'sari', id: 'okey', jokerMi: false}
};

const atilanTas = {sayi: 8, renk: 'kirmizi', id: 't4', jokerMi: false};
const tümAçılmışKomblar = durum.oyuncular.flatMap(o => o.acilmisKombs);
console.log('tümAçılmışKomblar:', JSON.stringify(tümAçılmışKomblar));
const islekSonuc = GE.islerTasBelirle(atilanTas, tümAçılmışKomblar, durum.okeyTasi);
console.log('Result:', islekSonuc);
`;

fs.writeFileSync('mock_game.js', mockGame);
console.log('Mock setup complete!');
