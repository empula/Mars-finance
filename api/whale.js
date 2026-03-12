const ETHERSCAN_KEY = 'DT65SXWRJUV8P7F4T3HC5HF7J8WMW3RTHF';

const KNOWN = {
  '0x28c6c06298d514db089934071355e5743bf21d60': 'Binance',
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549': 'Binance 2',
  '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8': 'Binance 3',
  '0x4976a4a02f38326660d17bf34b431dc6e2eb2327': 'Kraken',
  '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43': 'Coinbase',
  '0x71660c4005ba85c37ccec55d0c4493e66fe775d3': 'Coinbase 2',
  '0x503828976d22510aad0201ac7ec88293211d23da': 'Coinbase 3',
  '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be': 'Binance Hot',
};

const WATCH_ADDRS = [
  '0x28c6c06298d514db089934071355e5743bf21d60',
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549',
  '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43',
  '0x4976a4a02f38326660d17bf34b431dc6e2eb2327',
];

function label(addr) {
  if (!addr) return 'Bilinmiyor';
  const l = addr.toLowerCase();
  return KNOWN[l] || (addr.slice(0, 6) + '…' + addr.slice(-4));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30');

  try {
    const ethPrice = 2000;
    const btcPrice = 68000;
    const now = Math.floor(Date.now() / 1000);
    const whales = [];
    const seen = new Set();

    const fetches = WATCH_ADDRS.map(addr =>
      fetch(
        'https://api.etherscan.io/api?module=account&action=txlist'
        + '&address=' + addr
        + '&page=1&offset=20&sort=desc'
        + '&apikey=' + ETHERSCAN_KEY
      )
      .then(r => r.json())
      .catch(() => ({ result: [] }))
    );

    const results = await Promise.all(fetches);

    for (const ed of results) {
      if (!ed.result || !Array.isArray(ed.result)) continue;
      for (const tx of ed.result) {
        if (seen.has(tx.hash)) continue;
        seen.add(tx.hash);
        const eth = parseFloat(tx.value) / 1e18;
        const usd = eth * ethPrice;
        const from = label(tx.from);
        const to = label(tx.to);
        const isEx = [from, to].some(x =>
          x.includes('Binance') || x.includes('Kraken') || x.includes('Coinbase')
        );
        whales.push({
          coin: 'ETH', ico: 'Ξ',
          type: isEx ? 'exchange' : 'transfer',
          usdVal: usd,
          coinVal: eth.toFixed(2),
          from, to,
          secsAgo: now - parseInt(tx.timeStamp),
          hash: tx.hash,
        });
      }
    }

    whales.sort((a, b) => b.usdVal - a.usdVal);

    return res.status(200).json({
      ok: true,
      data: whales.slice(0, 20),
      btcPrice,
      ethPrice,
    });

  } catch(e) {
    return res.status(200).json({ ok: false, error: e.message, data: [] });
  }
}
