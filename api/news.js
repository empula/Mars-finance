// api/news.js — Vercel Serverless Function
// CoinDesk + CoinTelegraph RSS → JSON
// Kategori tespiti başlık/açıklama keywordlerine göre yapılır

export const config = { runtime: ‘nodejs’ };

const FEEDS = [
{
url: ‘https://www.coindesk.com/arc/outboundfeeds/rss/’,
source: ‘CoinDesk’,
},
{
url: ‘https://cointelegraph.com/rss’,
source: ‘CoinTelegraph’,
},
];

// Kategori belirleme — öncelik sırası: energy > geo > eco > markets > crypto
function getCategory(title = ‘’, desc = ‘’) {
const t = (title + ’ ’ + desc).toLowerCase();

if (/oil|brent|wti|opec|natural gas|crude|energy|fuel|petroleum|lng/.test(t))
return ‘energy’;

if (/war|geopolit|iran|ukraine|russia|china|taiwan|conflict|sanction|military|nato|middle east|israel|hamas/.test(t))
return ‘geo’;

if (/fed|federal reserve|inflation|gdp|economy|interest rate|recession|employment|unemployment|cpi|ppi|ecb|imf|central bank|monetary/.test(t))
return ‘eco’;

if (/stock|equity|nasdaq|s&p|dow|nyse|bond|yield|market|index|ipo|earnings|wall street/.test(t))
return ‘markets’;

return ‘crypto’; // varsayılan
}

// Basit XML/RSS parser (regex tabanlı, bağımlılık yok)
function parseRSS(xml, sourceName) {
const items = [];
const itemRegex = /<item>([\s\S]*?)</item>/gi;
let match;

while ((match = itemRegex.exec(xml)) !== null) {
const block = match[1];

```
const title = decodeEntities(extractTag(block, 'title'));
const link  = extractTag(block, 'link') || extractCDATA(block, 'link');
const desc  = decodeEntities(stripHtml(extractTag(block, 'description') || extractCDATA(block, 'description')));
const pubDate = extractTag(block, 'pubDate');

if (!title || !link) continue;

const ts = pubDate ? Math.floor(new Date(pubDate).getTime() / 1000) : Math.floor(Date.now() / 1000);
const cat = getCategory(title, desc);

const CAT_ICO = { crypto: '₿', markets: '📊', eco: '🏦', geo: '🌐', energy: '⚡' };

items.push({
  cat,
  ico: CAT_ICO[cat] || '📰',
  title,
  source: sourceName,
  url: link.trim(),
  ts,
});
```

}

return items;
}

function extractTag(xml, tag) {
const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, ‘i’));
return m ? m[1].trim() : ‘’;
}

function extractCDATA(xml, tag) {
const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, ‘i’));
return m ? m[1].trim() : ‘’;
}

function stripHtml(str) {
return str.replace(/<[^>]+>/g, ‘’).trim();
}

function decodeEntities(str) {
return str
.replace(/&/g, ‘&’)
.replace(/</g, ‘<’)
.replace(/>/g, ‘>’)
.replace(/"/g, ‘”’)
.replace(/'/g, “’”)
.replace(/ /g, ’ ’)
.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
}

export default async function handler(req, res) {
// CORS
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘GET’);
res.setHeader(‘Cache-Control’, ‘s-maxage=120, stale-while-revalidate=60’);

try {
// Her iki feed’i paralel çek
const fetches = FEEDS.map(feed =>
fetch(feed.url, {
headers: {
‘User-Agent’: ‘Mozilla/5.0 (compatible; MarsFinance/1.0)’,
‘Accept’: ‘application/rss+xml, application/xml, text/xml, */*’,
},
signal: AbortSignal.timeout(8000),
})
.then(r => r.ok ? r.text() : Promise.reject(new Error(`${feed.source} HTTP ${r.status}`)))
.then(xml => parseRSS(xml, feed.source))
.catch(err => {
console.warn(`[news] ${feed.source} error:`, err.message);
return []; // bu feed başarısız olsa bile devam et
})
);

```
const results = await Promise.all(fetches);
let allNews = results.flat();

// Tekrar eden başlıkları kaldır
const seen = new Set();
allNews = allNews.filter(n => {
  const key = n.title.slice(0, 60).toLowerCase();
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// Zaman sırasına göre sırala (en yeni önce)
allNews.sort((a, b) => b.ts - a.ts);

// Kategori başına max 8 haber
const catCount = {};
const filtered = allNews.filter(n => {
  catCount[n.cat] = (catCount[n.cat] || 0) + 1;
  return catCount[n.cat] <= 8;
});

res.status(200).json({ ok: true, count: filtered.length, news: filtered });
```

} catch (err) {
console.error(’[news] fatal:’, err);
res.status(500).json({ ok: false, error: err.message, news: [] });
}
}
