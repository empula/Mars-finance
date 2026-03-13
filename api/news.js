module.exports = async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Cache-Control’, ‘s-maxage=120, stale-while-revalidate=60’);

var feeds = [
‘https://www.coindesk.com/arc/outboundfeeds/rss/’,
‘https://cointelegraph.com/rss’
];

var allNews = [];

function getcat(title) {
var t = title.toLowerCase();
if (/oil|energy|opec|brent|wti|petrol|gas|fuel/.test(t)) return ‘energy’;
if (/war|geopolit|iran|ukraine|russia|china|taiwan|conflict|sanction/.test(t)) return ‘geo’;
if (/fed|inflation|gdp|economy|rate|interest|recession|employment/.test(t)) return ‘eco’;
if (/stock|market|nasdaq|sp500|dow|equity|bond|yield|index/.test(t)) return ‘markets’;
return ‘crypto’;
}

function parseRSS(xml, sourceName) {
var items = [];
var itemRe = /<item>([\s\S]*?)</item>/g;
var match;
while ((match = itemRe.exec(xml)) !== null) {
var block = match[1];
var titleM = block.match(/<title>(?:<![CDATA[)?([\s\S]*?)(?:]]>)?</title>/);
var linkM = block.match(/<link>([\s\S]*?)</link>/) || block.match(/<guid[^>]*>([\s\S]*?)</guid>/);
var dateM = block.match(/<pubDate>([\s\S]*?)</pubDate>/);
if (!titleM || !linkM) continue;
var title = titleM[1].trim();
var url = linkM[1].trim();
var ts = dateM ? Math.floor(new Date(dateM[1].trim()).getTime() / 1000) : Math.floor(Date.now() / 1000);
var cat = getcat(title);
var ico = cat === ‘crypto’ ? ‘₿’ : cat === ‘markets’ ? ‘📊’ : cat === ‘eco’ ? ‘🏦’ : cat === ‘geo’ ? ‘🌍’ : ‘⚡’;
items.push({ cat: cat, ico: ico, title: title, source: sourceName, url: url, ts: ts });
}
return items;
}

for (var i = 0; i < feeds.length; i++) {
try {
var sourceName = i === 0 ? ‘CoinDesk’ : ‘CoinTelegraph’;
var r = await fetch(feeds[i], { headers: { ‘User-Agent’: ‘Mozilla/5.0’ }, signal: AbortSignal.timeout(5000) });
if (!r.ok) continue;
var xml = await r.text();
var parsed = parseRSS(xml, sourceName);
allNews = allNews.concat(parsed);
} catch (e) {
// feed başarısız, devam et
}
}

// Kategoriye göre max 8, zaman sırasına göre sırala
var counts = {};
var filtered = [];
allNews.sort(function(a, b) { return b.ts - a.ts; });
for (var j = 0; j < allNews.length; j++) {
var n = allNews[j];
counts[n.cat] = (counts[n.cat] || 0);
if (counts[n.cat] < 8) {
filtered.push(n);
counts[n.cat]++;
}
}

res.status(200).json({ ok: true, count: filtered.length, news: filtered });
};
