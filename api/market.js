// api/market.js - Mars Finance v2
export default async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Cache-Control’, ‘s-maxage=120, stale-while-revalidate=60’);

const COINGECKO = ‘https://api.coingecko.com/api/v3’;
const ER_KEY = process.env.EXCHANGERATE_KEY || ‘’;
const t = (ms) => AbortSignal.timeout(ms);

// ── FOREX ────────────────────────────────────────────────
let forex = {};
try {
const r = await fetch(`https://v6.exchangerate-api.com/v6/${ER_KEY}/latest/USD`, { signal: t(5000) });
const d = await r.json();
if (d.conversion_rates) {
const TRY = d.conversion_rates.TRY || 1;
forex.usd = { price: TRY };
[‘EUR’,‘GBP’,‘JPY’,‘CHF’,‘CAD’,‘AUD’,‘SAR’].forEach(c => {
if (d.conversion_rates[c]) forex[c.toLowerCase()] = { price: TRY / d.conversion_rates[c] };
});
}
} catch {}

// ── CRYPTO ───────────────────────────────────────────────
let crypto = {}, cryptoRank = [];
try {
const r = await fetch(`${COINGECKO}/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,ripple,avalanche-2,chainlink&order=market_cap_desc&per_page=10&sparkline=false&price_change_percentage=24h`, { signal: t(5000) });
const d = await r.json();
const keyMap = { bitcoin:‘btc’, ethereum:‘eth’, solana:‘sol’, ripple:‘xrp’, ‘avalanche-2’:‘avax’, chainlink:‘link’ };
d.forEach(c => {
const k = keyMap[c.id];
if (k) crypto[k] = { price: c.current_price, chg: c.price_change_percentage_24h };
cryptoRank.push({ id: c.id, name: c.name, symbol: c.symbol?.toUpperCase(), mcap: c.market_cap, chg24: c.price_change_percentage_24h });
});
} catch {}

// ── METALS (statik) ──────────────────────────────────────
const metals = { gold:{price:5265}, silver:{price:94}, platinum:{price:1042}, copper:{price:4.38} };

// ── FEAR & GREED ─────────────────────────────────────────
let fearIndex = null;
try {
const r = await fetch(‘https://api.alternative.me/fng/?limit=30’, { signal: t(4000) });
const d = await r.json();
if (d.data?.length) {
fearIndex = {
value: parseInt(d.data[0].value),
label: d.data[0].value_classification,
history: d.data.slice(1,5).map(x => ({ value: parseInt(x.value), label: x.value_classification }))
};
}
} catch {}

// ── NEWS ─────────────────────────────────────────────────
const news = [];

function ago(ts) {
if (!ts) return ‘’;
const s = (Date.now()/1000) - ts;
if (s < 3600) return Math.round(s/60) + ’ dk’;
if (s < 86400) return Math.round(s/3600) + ’ sa’;
return Math.round(s/86400) + ’ gün’;
}

function agoDate(str) {
try {
const s = (Date.now() - new Date(str).getTime()) / 1000;
if (s < 3600) return Math.round(s/60) + ’ dk’;
if (s < 86400) return Math.round(s/3600) + ’ sa’;
return Math.round(s/86400) + ’ gün’;
} catch { return ‘’; }
}

// 1) CoinGecko News — kripto haberler, key yok
try {
const r = await fetch(`${COINGECKO}/news?per_page=20`, { signal: t(5000) });
if (r.ok) {
const d = await r.json();
const items = Array.isArray(d) ? d : (d.data || []);
items.slice(0, 15).forEach(a => {
if (!a.title || !a.url) return;
news.push({
cat: ‘crypto’, ico: ‘₿’,
title: a.title,
source: a.news_site || a.author || ‘CoinGecko’,
url: a.url,
time: ago(a.updated_at || a.created_at)
});
});
}
} catch {}

// 2) CryptoPanic — kripto + makro, public endpoint
try {
const r = await fetch(
‘https://cryptopanic.com/api/free/v1/posts/?auth_token=free&public=true&kind=news&filter=hot’,
{ signal: t(6000), redirect: ‘follow’ }
);
if (r.ok) {
const d = await r.json();
(d.results || []).slice(0, 12).forEach(a => {
if (!a.title) return;
// CryptoPanic kendi sayfasına link veriyor, source url’den al
const url = a.url || (‘https://cryptopanic.com/news/’ + a.id + ‘/click/’);
const isMacro = !a.currencies || a.currencies.length === 0;
news.push({
cat: isMacro ? ‘markets’ : ‘crypto’,
ico: isMacro ? ‘📊’ : ‘🪙’,
title: a.title,
source: a.source?.title || ‘CryptoPanic’,
url,
time: agoDate(a.published_at)
});
});
}
} catch {}

// 3) GNews — ekonomi & jeopolitik & enerji (GNEWS_KEY env var)
const GNEWS_KEY = process.env.GNEWS_KEY || ‘’;
if (GNEWS_KEY) {
const queries = [
{ q: ‘stock market economy finance Fed’, cat: ‘eco’, ico: ‘🏦’, max: 8 },
{ q: ‘geopolitics war Iran Middle East’, cat: ‘geo’, ico: ‘🌐’, max: 6 },
{ q: ‘oil energy petrol OPEC’, cat: ‘energy’, ico: ‘⚡’, max: 5 },
];
await Promise.allSettled(queries.map(async ({ q, cat, ico, max }) => {
try {
const r = await fetch(`https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=en&max=${max}&token=${GNEWS_KEY}`, { signal: t(5000) });
if (!r.ok) return;
const d = await r.json();
(d.articles || []).forEach(a => {
news.push({ cat, ico, title: a.title, source: a.source?.name || ‘GNews’, url: a.url, time: agoDate(a.publishedAt) });
});
} catch {}
}));
}

// Haber gelmezse boş array dönme — index.html statik NEWS kullanır
res.json({
ok: true,
forex,
crypto,
metals,
fearIndex,
cryptoRank: cryptoRank.slice(0, 15),
news: news.length >= 5 ? news : []
});
}
