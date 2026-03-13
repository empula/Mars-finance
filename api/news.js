module.exports = async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Cache-Control’, ‘s-maxage=120, stale-while-revalidate=60’);

function getcat(t) {
t = (t || ‘’).toLowerCase();
if (/oil|energy|opec|brent|wti|gas|fuel|petroleum/.test(t)) return ‘energy’;
if (/war|iran|ukraine|russia|china|taiwan|conflict|sanction|military|nato|israel|hamas/.test(t)) return ‘geo’;
if (/fed|inflation|gdp|economy|rate|recession|employment|cpi|ecb|central bank/.test(t)) return ‘eco’;
if (/stock|nasdaq|sp500|dow|equity|bond|yield|wall street|earnings/.test(t)) return ‘markets’;
return ‘crypto’;
}

var ICO = { crypto: ‘B’, markets: ‘M’, eco: ‘E’, geo: ‘G’, energy: ‘N’ };

var allNews = [];

// 1) CryptoCompare - kripto haberleri
try {
var r1 = await fetch(‘https://min-api.cryptocompare.com/data/v2/news/?lang=EN&limit=30&sortOrder=latest’);
if (r1.ok) {
var d1 = await r1.json();
(d1.Data || []).forEach(function(a) {
if (!a.title || !a.url) return;
var cat = getcat(a.title + ’ ’ + (a.tags || ‘’));
allNews.push({
cat: cat,
ico: ICO[cat],
title: a.title,
source: (a.source_info && a.source_info.name) ? a.source_info.name : a.source,
url: a.url,
ts: a.published_on
});
});
}
} catch(e) {}

// 2) Reuters Business RSS
try {
var r2 = await fetch(‘https://feeds.reuters.com/reuters/businessNews’, {
headers: { ‘User-Agent’: ‘Mozilla/5.0’ }
});
if (r2.ok) {
var xml = await r2.text();
var itemRe = /<item>([\s\S]*?)</item>/g;
var m;
while ((m = itemRe.exec(xml)) !== null) {
var block = m[1];
var titleM = block.match(/<title>(?:<![CDATA[)?([\s\S]*?)(?:]]>)?</title>/);
var linkM = block.match(/<link>([\s\S]*?)</link>/);
var dateM = block.match(/<pubDate>([\s\S]*?)</pubDate>/);
if (!titleM || !linkM) continue;
var title = titleM[1].trim();
var url = linkM[1].trim();
var ts = dateM ? Math.floor(new Date(dateM[1]).getTime() / 1000) : Math.floor(Date.now() / 1000);
var cat = getcat(title);
allNews.push({ cat: cat, ico: ICO[cat], title: title, source: ‘Reuters’, url: url, ts: ts });
}
}
} catch(e) {}

// 3) BBC Business RSS
try {
var r3 = await fetch(‘https://feeds.bbci.co.uk/news/business/rss.xml’, {
headers: { ‘User-Agent’: ‘Mozilla/5.0’ }
});
if (r3.ok) {
var xml3 = await r3.text();
var itemRe3 = /<item>([\s\S]*?)</item>/g;
var m3;
while ((m3 = itemRe3.exec(xml3)) !== null) {
var block3 = m3[1];
var tM = block3.match(/<title>(?:<![CDATA[)?([\s\S]*?)(?:]]>)?</title>/);
var lM = block3.match(/<link>([\s\S]*?)</link>/);
var dM = block3.match(/<pubDate>([\s\S]*?)</pubDate>/);
if (!tM || !lM) continue;
var t3 = tM[1].trim();
var u3 = lM[1].trim();
var s3 = dM ? Math.floor(new Date(dM[1]).getTime() / 1000) : Math.floor(Date.now() / 1000);
var c3 = getcat(t3);
allNews.push({ cat: c3, ico: ICO[c3], title: t3, source: ‘BBC’, url: u3, ts: s3 });
}
}
} catch(e) {}

// Tekrarları kaldır
var seen = new Set();
allNews = allNews.filter(function(n) {
var key = n.title.slice(0, 60).toLowerCase();
if (seen.has(key)) return false;
seen.add(key);
return true;
});

// Zamana gore sirala
allNews.sort(function(a, b) { return b.ts - a.ts; });

// Kategori basina max 8
var counts = {};
var filtered = allNews.filter(function(n) {
counts[n.cat] = (counts[n.cat] || 0) + 1;
return counts[n.cat] <= 8;
});

return res.status(200).json({ ok: true, count: filtered.length, news: filtered });
};
