const https = require(‘https’);

function httpGet(url) {
return new Promise(function(resolve, reject) {
var options = {
headers: {
‘User-Agent’: ‘Mozilla/5.0’,
‘Accept’: ‘*/*’
},
timeout: 8000
};
https.get(url, options, function(res) {
var data = ‘’;
res.on(‘data’, function(chunk) { data += chunk; });
res.on(‘end’, function() { resolve(data); });
}).on(‘error’, reject).on(‘timeout’, function() { reject(new Error(‘timeout’)); });
});
}

function getcat(t) {
t = (t || ‘’).toLowerCase();
if (/oil|energy|opec|brent|wti|gas|fuel/.test(t)) return ‘energy’;
if (/war|iran|ukraine|russia|china|conflict|sanction|military|nato|israel/.test(t)) return ‘geo’;
if (/fed|inflation|gdp|economy|rate|recession|employment|cpi/.test(t)) return ‘eco’;
if (/stock|nasdaq|sp500|dow|equity|bond|yield|earnings/.test(t)) return ‘markets’;
return ‘crypto’;
}

var ICO = { crypto: ‘₿’, markets: ‘📊’, eco: ‘🏦’, geo: ‘🌍’, energy: ‘⚡’ };

function parseRSS(xml, source) {
var items = [];
var re = /<item>([\s\S]*?)</item>/g;
var m;
while ((m = re.exec(xml)) !== null) {
var b = m[1];
var tM = b.match(/<title>(?:<![CDATA[)?([\s\S]*?)(?:]]>)?</title>/);
var lM = b.match(/<link>([\s\S]*?)</link>/);
var dM = b.match(/<pubDate>([\s\S]*?)</pubDate>/);
if (!tM || !lM) continue;
var title = tM[1].trim();
var url = lM[1].trim();
var ts = dM ? Math.floor(new Date(dM[1]).getTime() / 1000) : Math.floor(Date.now() / 1000);
var cat = getcat(title);
items.push({ cat: cat, ico: ICO[cat], title: title, source: source, url: url, ts: ts });
}
return items;
}

module.exports = async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Cache-Control’, ‘s-maxage=120, stale-while-revalidate=60’);

var allNews = [];

// 1) CryptoCompare
try {
var cc = await httpGet(‘https://min-api.cryptocompare.com/data/v2/news/?lang=EN&limit=30&sortOrder=latest’);
var d = JSON.parse(cc);
(d.Data || []).forEach(function(a) {
if (!a.title || !a.url) return;
var cat = getcat(a.title + ’ ’ + (a.tags || ‘’));
allNews.push({
cat: cat, ico: ICO[cat], title: a.title,
source: (a.source_info && a.source_info.name) ? a.source_info.name : a.source,
url: a.url, ts: a.published_on
});
});
} catch(e) {}

// 2) Reuters RSS
try {
var rss1 = await httpGet(‘https://feeds.reuters.com/reuters/businessNews’);
allNews = allNews.concat(parseRSS(rss1, ‘Reuters’));
} catch(e) {}

// 3) BBC RSS
try {
var rss2 = await httpGet(‘https://feeds.bbci.co.uk/news/business/rss.xml’);
allNews = allNews.concat(parseRSS(rss2, ‘BBC’));
} catch(e) {}

// Tekrar kaldır
var seen = new Set();
allNews = allNews.filter(function(n) {
var key = n.title.slice(0, 60).toLowerCase();
if (seen.has(key)) return false;
seen.add(key);
return true;
});

// Sırala
allNews.sort(function(a, b) { return b.ts - a.ts; });

// Max 8 per cat
var counts = {};
var filtered = allNews.filter(function(n) {
counts[n.cat] = (counts[n.cat] || 0) + 1;
return counts[n.cat] <= 8;
});

return res.status(200).json({ ok: true, count: filtered.length, news: filtered });
};
