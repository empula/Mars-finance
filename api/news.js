export default async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Cache-Control’, ‘s-maxage=120, stale-while-revalidate=60’);

function getcat(t) {
t = (t || ‘’).toLowerCase();
if (/oil|energy|opec|brent|wti|gas|fuel/.test(t)) return ‘energy’;
if (/war|iran|ukraine|russia|china|conflict|sanction|military|nato|israel/.test(t)) return ‘geo’;
if (/fed|inflation|gdp|economy|rate|recession|employment|cpi/.test(t)) return ‘eco’;
if (/stock|nasdaq|sp500|dow|equity|bond|yield|earnings/.test(t)) return ‘markets’;
return ‘crypto’;
}

const ICO = { crypto: ‘₿’, markets: ‘📊’, eco: ‘🏦’, geo: ‘🌍’, energy: ‘⚡’ };

function parseRSS(xml, source) {
const items = [];
const re = /<item>([\s\S]*?)</item>/g;
let m;
while ((m = re.exec(xml)) !== null) {
const b = m[1];
const tM = b.match(/<title>(?:<![CDATA[)?([\s\S]*?)(?:]]>)?</title>/);
const lM = b.match(/<link>([\s\S]*?)</link>/);
const dM = b.match(/<pubDate>([\s\S]*?)</pubDate>/);
if (!tM || !lM) continue;
const title = tM[1].trim();
const url = lM[1].trim();
const ts = dM ? Math.floor(new Date(dM[1]).getTime() / 1000) : Math.floor(Date.now() / 1000);
const cat = getcat(title);
items.push({ cat, ico: ICO[cat], title, source, url, ts });
}
return items;
}

let allNews = [];

// 1) CryptoCompare
try {
const r = await fetch(‘https://min-api.cryptocompare.com/data/v2/news/?lang=EN&limit=30&sortOrder=latest’);
const d = await r.json();
(d.Data || []).forEach(a => {
if (!a.title || !a.url) return;
const cat = getcat(a.title + ’ ’ + (a.tags || ‘’));
allNews.push({
cat, ico: ICO[cat], title: a.title,
source: a.source_info?.name || a.source,
url: a.url, ts: a.published_on
});
});
} catch(e) {}

// 2) Reuters RSS
try {
const r2 = await fetch(‘https://feeds.reuters.com/reuters/businessNews’, {
headers: { ‘User-Agent’: ‘Mozilla/5.0’ }
});
if (r2.ok) allNews = allNews.concat(parseRSS(await r2.text(), ‘Reuters’));
} catch(e) {}

// 3) BBC RSS
try {
const r3 = await fetch(‘https://feeds.bbci.co.uk/news/business/rss.xml’, {
headers: { ‘User-Agent’: ‘Mozilla/5.0’ }
});
if (r3.ok) allNews = allNews.concat(parseRSS(await r3.text(), ‘BBC’));
} catch(e) {}

// Tekrar kaldır
const seen = new Set();
allNews = allNews.filter(n => {
const key = n.title.slice(0, 60).toLowerCase();
if (seen.has(key)) return false;
seen.add(key);
return true;
});

// Sırala
allNews.sort((a, b) => b.ts - a.ts);

// Max 8 per cat
const counts = {};
const filtered = allNews.filter(n => {
counts[n.cat] = (counts[n.cat] || 0) + 1;
return counts[n.cat] <= 8;
});

return res.status(200).json({ ok: true, count: filtered.length, news: filtered });
}
