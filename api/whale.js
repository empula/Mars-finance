const ETHERSCAN_KEY = ‘DDAQFVQ45K1R3IZ2TACITJGA79IZCHH3R2’;
const BLOCKCHAIN_KEY = ‘YOUR_KEY’; // BTC için kullanılmıyor, public API

const KNOWN = {
‘0x28c6c06298d514db089934071355e5743bf21d60’: ‘Binance’,
‘0x21a31ee1afc51d94c2efccaa2092ad1028285549’: ‘Binance 2’,
‘0xbe0eb53f46cd790cd13851d5eff43d12404d33e8’: ‘Binance 3’,
‘0x4976a4a02f38326660d17bf34b431dc6e2eb2327’: ‘Kraken’,
‘0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43’: ‘Coinbase’,
‘0x71660c4005ba85c37ccec55d0c4493e66fe775d3’: ‘Coinbase 2’,
‘0x503828976d22510aad0201ac7ec88293211d23da’: ‘Coinbase 3’,
‘0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be’: ‘Binance Hot’,
};

// İzlenecek adresler (en aktif exchange adresleri)
const WATCH_ADDRS = [
‘0x28c6c06298d514db089934071355e5743bf21d60’,
‘0x21a31ee1afc51d94c2efccaa2092ad1028285549’,
‘0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43’,
‘0x4976a4a02f38326660d17bf34b431dc6e2eb2327’,
];

function label(addr) {
if (!addr) return ‘Bilinmiyor’;
const l = addr.toLowerCase();
return KNOWN[l] || (addr.slice(0, 6) + ‘…’ + addr.slice(-4));
}

export default async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Cache-Control’, ‘s-maxage=30’);

try {
// Fiyatları çek
const pr = await fetch(‘https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd’);
const prices = await pr.json();
const btcPrice = prices?.bitcoin?.usd || 68000;
const ethPrice = prices?.ethereum?.usd || 2000;

```
const now = Math.floor(Date.now() / 1000);
const whales = [];
const seen = new Set();

// ETH transferleri — birden fazla adresten paralel çek
const fetches = WATCH_ADDRS.map(addr =>
  fetch(
    'https://api.etherscan.io/api?module=account&action=txlist'
    + '&address=' + addr
    + '&startblock=0&endblock=99999999&page=1&offset=20&sort=desc'
    + '&apikey=' + ETHERSCAN_KEY
  ).then(r => r.json()).catch(() => ({ result: [] }))
);

const results = await Promise.all(fetches);

for (const ed of results) {
  if (!ed.result || !Array.isArray(ed.result)) continue;
  for (const tx of ed.result) {
    if (seen.has(tx.hash)) continue;
    seen.add(tx.hash);

    const eth = parseFloat(tx.value) / 1e18;
    const usd = eth * ethPrice;
    if (usd < 500000) continue; // min $500K

    const from = label(tx.from);
    const to = label(tx.to);
    const isEx = [from, to].some(x =>
      x.includes('Binance') || x.includes('Kraken') || x.includes('Coinbase')
    );

    whales.push({
      coin: 'ETH', ico: 'E',
      type: isEx ? 'exchange' : 'transfer',
      usdVal: usd,
      from, to,
      secsAgo: now - parseInt(tx.timeStamp),
      hash: tx.hash
    });
  }
}

// BTC büyük transferleri — Blockchain.com public API
try {
  const btcR = await fetch('https://blockchain.info/unconfirmed-transactions?format=json&limit=50');
  const btcD = await btcR.json();
  if (btcD.txs) {
    for (const tx of btcD.txs) {
      const totalOut = tx.out.reduce((s, o) => s + (o.value || 0), 0);
      const btcAmt = totalOut / 1e8;
      const usd = btcAmt * btcPrice;
      if (usd < 500000) continue; // min $500K
      if (seen.has(tx.hash)) continue;
      seen.add(tx.hash);

      const fromAddr = tx.inputs?.[0]?.prev_out?.addr || '';
      const toAddr = tx.out?.[0]?.addr || '';

      whales.push({
        coin: 'BTC', ico: 'B',
        type: 'transfer',
        usdVal: usd,
        from: fromAddr ? (fromAddr.slice(0, 6) + '...' + fromAddr.slice(-4)) : 'Bilinmiyor',
        to: toAddr ? (toAddr.slice(0, 6) + '...' + toAddr.slice(-4)) : 'Bilinmiyor',
        secsAgo: 0, // unconfirmed = yeni
        hash: tx.hash
      });
    }
  }
} catch (btcErr) {
  // BTC çekilemedi, ETH yeterli
}

whales.sort((a, b) => b.usdVal - a.usdVal);
const top = whales.slice(0, 20);

return res.status(200).json({ ok: true, data: top, btcPrice, ethPrice });
```

} catch (e) {
return res.status(500).json({ ok: false, error: e.message });
}
};
