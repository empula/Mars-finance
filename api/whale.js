const ETHERSCAN_KEY = 'DDAQFVQ45K1R3IZ2TACITJGA79IZCHH3R2';

const KNOWN = {
  '0x28c6c06298d514db089934071355e5743bf21d60': 'Binance',
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549': 'Binance 2',
  '0x4976a4a02f38326660d17bf34b431dc6e2eb2327': 'Kraken',
  '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43': 'Coinbase',
};

function label(addr) {
  if (!addr) return 'Bilinmiyor';
  const l = addr.toLowerCase();
  return KNOWN[l] || (addr.slice(0, 6) + '...' + addr.slice(-4));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30');

  try {
    const pr = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
    const prices = await pr.json();
    const btcPrice = prices?.bitcoin?.usd || 68000;
    const ethPrice = prices?.ethereum?.usd || 2000;

    const url = 'https://api.etherscan.io/api?module=account&action=txlist'
      + '&address=0x28c6c06298d514db089934071355e5743bf21d60'
      + '&startblock=0&endblock=99999999&page=1&offset=30&sort=desc'
      + '&apikey=' + ETHERSCAN_KEY;

    const er = await fetch(url);
    const ed = await er.json();
    const now = Math.floor(Date.now() / 1000);
    const whales = [];

    if (ed.result && Array.isArray(ed.result)) {
      for (const tx of ed.result) {
        const eth = parseFloat(tx.value) / 1e18;
        const usd = eth * ethPrice;
        if (usd < 100000) continue;
        const from = label(tx.from);
        const to = label(tx.to);
        const isEx = from.includes('Binance') || from.includes('Kraken') || from.includes('Coinbase')
          || to.includes('Binance') || to.includes('Kraken') || to.includes('Coinbase');
        whales.push({
          coin: 'ETH', ico: 'E',
          type: isEx ? 'exchange' : 'transfer',
          usdVal: usd,
          from, to,
          secsAgo: now - parseInt(tx.timeStamp),
          hash: tx.hash
        });
        if (whales.length >= 15) break;
      }
    }

    whales.sort((a, b) => b.usdVal - a.usdVal);
    return res.status(200).json({ ok: true, data: whales, btcPrice, ethPrice });

  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
