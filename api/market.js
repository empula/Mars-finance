export default async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Cache-Control’, ‘s-maxage=120, stale-while-revalidate=240’);

const safeJson = async (url) => {
try {
const r = await fetch(url, {signal: AbortSignal.timeout(7000)});
return await r.json();
} catch(e) { return null; }
};

const safeRSS = async (url) => {
try {
const r = await fetch(url, {
headers: {‘User-Agent’: ‘Mozilla/5.0’},
signal: AbortSignal.timeout(5000)
});
return await r.text();
} catch(e) { return null; }
};

const parseRSS = (xml, source, cat) => {
if(!xml) return [];
const items = [];
const itemRe = /<item[^>]*>([\s\S]*?)</item>/gi;
let m;
while((m = itemRe.exec(xml)) !== null && items.length < 4) {
const block = m[1];
const title = (block.match(/<title[^>]*><![CDATA[(.*?)]]></title>/) || block.match(/<title[^>]*>(.*?)</title>/) || [])[1];
const link = (block.match(/<link>(.*?)</link>/) || block.match(/<guid[^>]*>(https?[^<]+)</guid>/) || [])[1];
const pubDate = (block.match(/<pubDate>(.*?)</pubDate>/) || [])[1];
if(title && link) {
const ts = pubDate ? Math.floor(new Date(pubDate).getTime()/1000) : Math.floor(Date.now()/1000);
items.push({
title: title.replace(/&/g,’&’).replace(/</g,’<’).replace(/>/g,’>’).replace(/<[^>]+>/g,’’).trim(),
url: link.trim(),
source, cat, ts
});
}
}
return items;
};

// Önce kritik verileri çek
const [fx, cg, cgTop, fear] = await Promise.all([
safeJson(‘https://api.exchangerate-api.com/v4/latest/USD’),
safeJson(‘https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,avalanche-2,ripple,chainlink&vs_currencies=usd&include_24hr_change=true&include_market_cap=true’),
safeJson(‘https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h’),
safeJson(‘https://api.alternative.me/fng/?limit=30’),
]);

// Sonra haberleri çek (bunlar başarısız olsa bile fiyatlar çalışır)
const [rss1, rss2, rss3, rss4] = await Promise.all([
safeRSS(‘https://www.coindesk.com/arc/outboundfeeds/rss/’),
safeRSS(‘https://cointelegraph.com/rss’),
safeRSS(‘https://feeds.bbci.co.uk/news/world/rss.xml’),
safeRSS(‘https://feeds.reuters.com/reuters/businessNews’),
]);

let forex = {};
if(fx?.rates) {
const r = fx.rates, u = r.TRY;
forex = {
usd:{price:u}, eur:{price:u/r.EUR}, gbp:{price:u/r.GBP},
jpy:{price:(u/r.JPY)*100}, chf:{price:u/r.CHF},
cad:{price:u/r.CAD}, aud:{price:u/r.AUD}, sar:{price:u/r.SAR},
};
}

let crypto = {};
if(cg) {
crypto = {
btc:{price:cg.bitcoin?.usd, chg:cg.bitcoin?.usd_24h_change, mcap:cg.bitcoin?.usd_market_cap},
eth:{price:cg.ethereum?.usd, chg:cg.ethereum?.usd_24h_change, mcap:cg.ethereum?.usd_market_cap},
sol:{price:cg.solana?.usd, chg:cg.solana?.usd_24h_change, mcap:cg.solana?.usd_market_cap},
xrp:{price:cg.ripple?.usd, chg:cg.ripple?.usd_24h_change, mcap:cg.ripple?.usd_market_cap},
avax:{price:cg[‘avalanche-2’]?.usd, chg:cg[‘avalanche-2’]?.usd_24h_change, mcap:cg[‘avalanche-2’]?.usd_market_cap},
link:{price:cg.chainlink?.usd, chg:cg.chainlink?.usd_24h_change, mcap:cg.chainlink?.usd_market_cap},
};
}

const metals = {
gold:{price:3118}, silver:{price:33.80},
platinum:{price:1042}, copper:{price:4.38},
};

const fngData = fear?.data || [];
const fearIndex = {
value: parseInt(fngData[0]?.value||50),
label: fngData[0]?.value_classification||‘Nötr’,
timestamp: fngData[0]?.timestamp,
history: fngData.slice(0,30).map(d=>({
value:parseInt(d.value),
label:d.value_classification,
timestamp:d.timestamp
})),
};

const cryptoRank = (cgTop||[]).map((coin,i)=>({
rank:coin.market_cap_rank||i+1,
id:coin.id,
symbol:coin.symbol?.toUpperCase(),
name:coin.name,
price:coin.current_price,
mcap:coin.market_cap,
chg24:coin.price_change_percentage_24h,
}));

const news = [
…parseRSS(rss1, ‘CoinDesk’, ‘crypto’),
…parseRSS(rss2, ‘CoinTelegraph’, ‘crypto’),
…parseRSS(rss3, ‘BBC News’, ‘geo’),
…parseRSS(rss4, ‘Reuters’, ‘markets’),
].sort((a,b) => b.ts - a.ts).slice(0, 20);

return res.status(200).json({
ok:true,
ts:new Date().toISOString(),
forex, crypto, metals, fearIndex, cryptoRank, news
});
}
