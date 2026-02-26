
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
