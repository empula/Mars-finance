// api/market.js - Mars Finance
// News section: CoinGecko (crypto) + RSS (general)

const COINGECKO = ‘https://api.coingecko.com/api/v3’;
const EXCHANGERATE = ‘https://v6.exchangerate-api.com/v6’;
const ER_KEY = process.env.EXCHANGERATE_KEY || ‘’;
const FEAR_API = ‘https://api.alternative.me/fng/?limit=30’;

// RSS feeds - key gerektirmiyor
const RSS_FEEDS = [
{ url: ‘https://feeds.reuters.com/reuters/businessNews’, cat: ‘markets’, label: ‘Reuters’ },
{ url: ‘https://feeds.bbci.co.uk/news/business/rss.xml’, cat: ‘eco’, label: ‘BBC’ },
{ url: ‘https://www.aljazeera.com/xml/rss/all.xml’, cat: ‘geo’, label: ‘Al Jazeera’ },
];

async function parseRSS(url) {
try {
const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
const text = await res.text();
const items = [];
const itemRegex = /<item>([\s\S]*?)</item>/g;
let m;
while ((m = itemRegex.exec(text)) !== null) {
const item = m[1];
const title = (item.match(/<title><![CDATA[(.*?)]]></title>/) || item.match(/<title>(.*?)</title>/) || [])[1] || ‘’;
const link = (item.match(/<link>(.*?)</link>/) || item.match(/<guid[^>]*>(https?[^<]+)</guid>/) || [])[1] || ‘’;
const pubDate = (item.match(/<pubDate>(.*?)</pubDate>/) || [])[1] || ‘’;
if (title && link) items.push({ title: title.trim(), url: link.trim(), pubDate });
}
return items.slice(0, 8);
} catch (e) { return []; }
}

function timeAgo(pubDate) {
try {
const d = new Date(pubDate);
const diff = (Date.now() - d.getTime()) / 1000;
if (diff < 3600) return Math.round(diff / 60) + ’ dk’;
if (diff < 86400) return Math.round(diff / 3600) + ’ sa’;
return Math.round(diff / 86400) + ’ gün’;
} catch { return ‘’; }
}

export default async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Cache-Control’, ‘s-maxage=120, stale-while-revalidate=60’);

try {
const [forexRes, cgRes, fearRes, cgNewsRes] = await Promise.allSettled([
// Forex
fetch(`${EXCHANGERATE}/${ER_KEY}/latest/USD`, { signal: AbortSignal.timeout(5000) }),
// Crypto
fetch(`${COINGECKO}/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,ripple,avalanche-2,chainlink&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h`, { signal: AbortSignal.timeout(5000) }),
// Fear & Greed
fetch(FEAR_API, { signal: AbortSignal.timeout(4000) }),
// CoinGecko News (kripto haberler)
fetch(`${COINGECKO}/news?per_page=20`, { signal: AbortSignal.timeout(5000) }),
]);

```
// Forex
const forex = {};
if (forexRes.status === 'fulfilled' && forexRes.value.ok) {
  const fd = await forexRes.value.json();
  if (fd.conversion_rates) {
    const tryRate = fd.conversion_rates.TRY || 1;
    ['EUR','GBP','JPY','CHF','CAD','AUD','SAR'].forEach(c => {
      if (fd.conversion_rates[c]) {
        forex[c.toLowerCase()] = { price: tryRate / fd.conversion_rates[c] };
      }
    });
    forex.usd = { price: tryRate };
  }
}

// Crypto
const crypto = {};
const cryptoRank = [];
if (cgRes.status === 'fulfilled' && cgRes.value.ok) {
  const cd = await cgRes.value.json();
  cd.forEach(coin => {
    const key = coin.id === 'bitcoin' ? 'btc' : coin.id === 'ethereum' ? 'eth' :
      coin.id === 'solana' ? 'sol' : coin.id === 'ripple' ? 'xrp' :
      coin.id === 'avalanche-2' ? 'avax' : coin.id === 'chainlink' ? 'link' : null;
    if (key) crypto[key] = { price: coin.current_price, chg: coin.price_change_percentage_24h };
    cryptoRank.push({ id: coin.id, name: coin.name, symbol: coin.symbol?.toUpperCase(), mcap: coin.market_cap, chg24: coin.price_change_percentage_24h });
  });
}

// Metals (static)
const metals = { gold: { price: 5265 }, silver: { price: 94 }, platinum: { price: 1042 }, copper: { price: 4.38 } };

// Fear & Greed
let fearIndex = null;
if (fearRes.status === 'fulfilled' && fearRes.value.ok) {
  const fd = await fearRes.value.json();
  if (fd.data?.length) {
    fearIndex = { value: parseInt(fd.data[0].value), label: fd.data[0].value_classification, history: fd.data.slice(1, 5).map(d => ({ value: parseInt(d.value), label: d.value_classification })) };
  }
}

// NEWS - CoinGecko kripto haberleri
const news = [];

// CoinGecko news
if (cgNewsRes.status === 'fulfilled' && cgNewsRes.value.ok) {
  const nd = await cgNewsRes.value.json();
  const articles = nd.data || nd || [];
  articles.slice(0, 15).forEach(a => {
    if (!a.title || !a.url) return;
    const diff = a.updated_at ? (Date.now()/1000 - a.updated_at) : 0;
    const time = diff < 3600 ? Math.round(diff/60)+'dk' : diff < 86400 ? Math.round(diff/3600)+'sa' : Math.round(diff/86400)+'gün';
    news.push({
      cat: 'crypto',
      ico: '₿',
      title: a.title,
      source: a.author || a.news_site || 'CoinGecko',
      url: a.url,
      time
    });
  });
}

// RSS haberleri - Reuters, BBC, Al Jazeera
const rssResults = await Promise.allSettled(RSS_FEEDS.map(f => parseRSS(f.url)));
rssResults.forEach((r, i) => {
  if (r.status !== 'fulfilled') return;
  const feed = RSS_FEEDS[i];
  r.value.forEach(item => {
    news.push({
      cat: feed.cat,
      ico: feed.cat === 'markets' ? '📊' : feed.cat === 'eco' ? '🏦' : '🌐',
      title: item.title,
      source: feed.label,
      url: item.url,
      time: item.pubDate ? timeAgo(item.pubDate) : ''
    });
  });
});

// Energy haberler - Reuters energy RSS
try {
  const energyItems = await parseRSS('https://feeds.reuters.com/reuters/energy');
  energyItems.slice(0, 5).forEach(item => {
    news.push({ cat: 'energy', ico: '⚡', title: item.title, source: 'Reuters', url: item.url, time: item.pubDate ? timeAgo(item.pubDate) : '' });
  });
} catch {}

res.json({
  ok: true,
  forex, crypto, metals, fearIndex,
  cryptoRank: cryptoRank.slice(0, 15),
  news: news.slice(0, 50)
});
```

} catch (e) {
res.status(500).json({ ok: false, error: e.message });
}
}
