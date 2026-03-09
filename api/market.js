const https = require(‘https’);

function httpGet(url, ms) {
ms = ms || 5000;
return new Promise(function(resolve, reject) {
try {
const req = https.get(url, { headers: { ‘User-Agent’: ‘Mozilla/5.0’ } }, function(res) {
if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
httpGet(res.headers.location, ms).then(resolve).catch(reject);
return;
}
var data = ‘’;
res.on(‘data’, function(c) { data += c; });
res.on(‘end’, function() {
try { resolve(JSON.parse(data)); }
catch(e) { reject(e); }
});
res.on(‘error’, reject);
});
req.setTimeout(ms, function() { req.destroy(); reject(new Error(‘timeout’)); });
req.on(‘error’, reject);
} catch(e) { reject(e); }
});
}

function ago(ts) {
if (!ts) return ‘’;
var s = (Date.now() / 1000) - ts;
if (s < 3600) return Math.round(s / 60) + ’ dk’;
if (s < 86400) return Math.round(s / 3600) + ’ sa’;
return Math.round(s / 86400) + ’ gun’;
}

function agoDate(str) {
try {
var s = (Date.now() - new Date(str).getTime()) / 1000;
if (s < 3600) return Math.round(s / 60) + ’ dk’;
if (s < 86400) return Math.round(s / 3600) + ’ sa’;
return Math.round(s / 86400) + ’ gun’;
} catch(e) { return ‘’; }
}

module.exports = function(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Cache-Control’, ‘s-maxage=120, stale-while-revalidate=60’);

var ER_KEY = process.env.EXCHANGERATE_KEY || ‘’;
var GNEWS_KEY = process.env.GNEWS_KEY || ‘’;

var forex = {};
var crypto = {};
var cryptoRank = [];
var metals = { gold:{price:5265}, silver:{price:94}, platinum:{price:1042}, copper:{price:4.38} };
var fearIndex = null;
var news = [];

var tasks = [];

// FOREX
tasks.push(
httpGet(‘https://v6.exchangerate-api.com/v6/’ + ER_KEY + ‘/latest/USD’)
.then(function(d) {
if (d.conversion_rates) {
var TRY = d.conversion_rates.TRY || 1;
forex.usd = { price: TRY };
[‘EUR’,‘GBP’,‘JPY’,‘CHF’,‘CAD’,‘AUD’,‘SAR’].forEach(function(c) {
if (d.conversion_rates[c]) forex[c.toLowerCase()] = { price: TRY / d.conversion_rates[c] };
});
}
}).catch(function(){})
);

// CRYPTO
tasks.push(
httpGet(‘https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,ripple,avalanche-2,chainlink&order=market_cap_desc&per_page=10&sparkline=false&price_change_percentage=24h’)
.then(function(d) {
var keyMap = { bitcoin:‘btc’, ethereum:‘eth’, solana:‘sol’, ripple:‘xrp’, ‘avalanche-2’:‘avax’, chainlink:‘link’ };
d.forEach(function(c) {
var k = keyMap[c.id];
if (k) crypto[k] = { price: c.current_price, chg: c.price_change_percentage_24h };
cryptoRank.push({ id: c.id, name: c.name, symbol: (c.symbol||’’).toUpperCase(), mcap: c.market_cap, chg24: c.price_change_percentage_24h });
});
}).catch(function(){})
);

// FEAR & GREED
tasks.push(
httpGet(‘https://api.alternative.me/fng/?limit=30’, 4000)
.then(function(d) {
if (d.data && d.data.length) {
fearIndex = {
value: parseInt(d.data[0].value),
label: d.data[0].value_classification,
history: d.data.slice(1,5).map(function(x) { return { value: parseInt(x.value), label: x.value_classification }; })
};
}
}).catch(function(){})
);

// NEWS - CoinGecko
tasks.push(
httpGet(‘https://api.coingecko.com/api/v3/news?per_page=20’)
.then(function(d) {
var items = Array.isArray(d) ? d : (d.data || []);
items.slice(0, 15).forEach(function(a) {
if (!a.title || !a.url) return;
news.push({
cat: ‘crypto’, ico: ‘B’,
title: a.title,
source: a.news_site || a.author || ‘CoinGecko’,
url: a.url,
time: ago(a.updated_at || a.created_at)
});
});
}).catch(function(){})
);

// NEWS - CryptoPanic
tasks.push(
httpGet(‘https://cryptopanic.com/api/free/v1/posts/?auth_token=free&public=true&kind=news&filter=hot’, 6000)
.then(function(d) {
(d.results || []).slice(0, 12).forEach(function(a) {
if (!a.title) return;
var url = a.url || (‘https://cryptopanic.com/news/’ + a.id + ‘/click/’);
var isMacro = !a.currencies || a.currencies.length === 0;
news.push({
cat: isMacro ? ‘markets’ : ‘crypto’,
ico: isMacro ? ‘$’ : ‘C’,
title: a.title,
source: (a.source && a.source.title) || ‘CryptoPanic’,
url: url,
time: agoDate(a.published_at)
});
});
}).catch(function(){})
);

Promise.all(tasks).then(function() {
res.json({
ok: true,
forex: forex,
crypto: crypto,
metals: metals,
fearIndex: fearIndex,
cryptoRank: cryptoRank.slice(0, 15),
news: news.length >= 5 ? news : []
});
}).catch(function(e) {
res.json({ ok: false, error: e.message });
});
};
