// api/whale.js - Vercel Serverless Function
// BTC: mempool.space | ETH: Etherscan

const ETHERSCAN_KEY = ‘DDAQFVQ45K1R3IZ2TACITJGA79IZCHH3R2’;

// Bilinen borsa adresleri
const KNOWN_ADDRS = {
‘0x28c6c06298d514db089934071355e5743bf21d60’: ‘Binance’,
‘0x21a31ee1afc51d94c2efccaa2092ad1028285549’: ‘Binance 2’,
‘0xdfd5293d8e347dfe59e90efd55b2956a1343963d’: ‘Binance 3’,
‘0xbe0eb53f46cd790cd13851d5eff43d12404d33e8’: ‘Binance Cold’,
‘0x4976a4a02f38326660d17bf34b431dc6e2eb2327’: ‘Kraken’,
‘0xae2d4617c862309a3d75a0ffb358c7a5009c673f’: ‘Kraken 2’,
‘0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43’: ‘Coinbase’,
‘0x71660c4005ba85c37ccec55d0c4493e66fe775d3’: ‘Coinbase 2’,
‘0x503828976d22510aad0201ac7ec88293211d23da’: ‘Coinbase 3’,
‘0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be’: ‘Binance Legacy’,
};

function labelAddr(addr) {
if (!addr) return ‘Bilinmiyor’;
const lower = addr.toLowerCase();
if (KNOWN_ADDRS[lower]) return KNOWN_ADDRS[lower];
return addr.slice(0, 6) + ‘…’ + addr.slice(-4);
}

async function getBtcWhales(btcPrice) {
const res = await fetch(‘https://mempool.space/api/mempool/recent’);
const txs = await res.json();
const whales = [];

for (const tx of txs) {
const btc = (tx.value || 0) / 1e8;
const usd = btc * btcPrice;
if (usd < 500000) continue;

```
whales.push({
  coin: 'BTC',
  ico: '₿',
  type: 'transfer',
  usdVal: usd,
  coinVal: btc.toFixed(4),
  from: 'BTC Wallet',
  to: 'BTC Wallet',
  secsAgo: 0,
  hash: tx.txid,
});

if (whales.length >= 8) break;
```

}

return whales;
}

async function getEthWhales(ethPrice) {
// Binance hot wallet’a gelen/giden büyük transferler
const url = `https://api.etherscan.io/api?module=account&action=txlist` +
`&address=0x28c6c06298d514db089934071355e5743bf21d60` +
`&startblock=0&endblock=99999999&page=1&offset=30&sort=desc` +
`&apikey=${ETHERSCAN_KEY}`;

const res = await fetch(url);
const data = await res.json();
const whales = [];

if (!data.result || !Array.isArray(data.result)) return whales;

const now = Math.floor(Date.now() / 1000);

for (const tx of data.result) {
const eth = parseFloat(tx.value) / 1e18;
const usd = eth * ethPrice;
if (usd < 100000) continue;

```
const from = labelAddr(tx.from);
const to = labelAddr(tx.to);
const isExchange = from.includes('Binance') || from.includes('Kraken') ||
  from.includes('Coinbase') || to.includes('Binance') ||
  to.includes('Kraken') || to.includes('Coinbase');

whales.push({
  coin: 'ETH',
  ico: 'Ξ',
  type: isExchange ? 'exchange' : 'transfer',
  usdVal: usd,
  coinVal: eth.toFixed(3),
  from,
  to,
  secsAgo: now - parseInt(tx.timeStamp),
  hash: tx.hash,
});

if (whales.length >= 8) break;
```

}

return whales;
}

export default async function handler(req, res) {
// CORS headers
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘GET’);
res.setHeader(‘Cache-Control’, ‘s-maxage=30, stale-while-revalidate=60’);

try {
// Fiyatları CoinGecko’dan al
const priceRes = await fetch(
‘https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd’
);
const prices = await priceRes.json();
const btcPrice = prices?.bitcoin?.usd || 68000;
const ethPrice = prices?.ethereum?.usd || 2000;

```
// BTC ve ETH balinalarını paralel çek
const [btcWhales, ethWhales] = await Promise.allSettled([
  getBtcWhales(btcPrice),
  getEthWhales(ethPrice),
]);

const btc = btcWhales.status === 'fulfilled' ? btcWhales.value : [];
const eth = ethWhales.status === 'fulfilled' ? ethWhales.value : [];

// Birleştir, USD'ye göre sırala
const all = [...btc, ...eth].sort((a, b) => b.usdVal - a.usdVal);

return res.status(200).json({ ok: true, data: all, btcPrice, ethPrice });
```

} catch (e) {
return res.status(500).json({ ok: false, error: e.message });
}
}
