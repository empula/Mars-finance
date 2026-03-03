export default async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Cache-Control’, ‘s-maxage=120, stale-while-revalidate=240’);

const safeJson = async (url) => {
try {
const r = await fetch(url, {signal: AbortSignal.timeout(7000)});
return await r.json();
} catch(e) { return null; }
};

const NEWS_KEY = ‘1c3debc50f084efdbc99100c73d0494b’;

const [fx, cg, cgTop, fear, news1, news2] = await Promise.all([
safeJson(‘https://api.exchangerate-api.com/v4/latest/USD’),
safeJson(‘https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,avalanche-2,ripple,chainlink&vs_currencies=usd&include_24hr_change=true&include_market_cap=true’),
safeJson(‘https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h’),
safeJson(‘https://api.alternative.me/fng/?limit=30’),
safeJson(`https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=15&apiKey=${NEWS_KEY}`),
safeJson(`https://newsapi.org/v2/everything?q=bitcoin+crypto+gold&language=en&sortBy=publishedAt&pageSize=15&apiKey=${NEWS_KEY}`),
]);

const r = fx?.rates, u = r?.TRY;
const forex = r ? {
usd:{price:u}, eur:{price:u/r.EUR}, gbp:{price:u/r.GBP},
jpy:{price:(u/r.JPY)*100}, chf:{price:u/r.CHF},
cad:{price:u/r.CAD}, aud:{price:u/r.AUD}, sar:{price:u/r.SAR}
} : {};

const crypto = cg ? {
btc:{price:cg.bitcoin?.usd, chg:cg.bitcoin?.usd_24h_change, mcap:cg.bitcoin?.usd_market_cap},
eth:{price:cg.ethereum?.usd, chg:cg.ethereum?.usd_24h_change, mcap:cg.ethereum?.usd_market_cap},
sol:{price:cg.solana?.usd, chg:cg.solana?.usd_24h_change, mcap:cg.solana?.usd_market_cap},
xrp:{price:cg.ripple?.usd, chg:cg.ripple?.usd_24h_change, mcap:cg.ripple?.usd_market_cap},
avax:{price:cg[‘avalanche-2’]?.usd, chg:cg[‘avalanche-2’]?.usd_24h_change, mcap:cg[‘avalanche-2’]?.usd_market_cap},
link:{price:cg.chainlink?.usd, chg:cg.chainlink?.usd_24h_change, mcap:cg.chainlink?.usd_market_cap},
} : {};

const metals = {gold:{price:3118},silver:{price:33.80},platinum:{price:1042},copper:{price:4.38}};

const fngData = fear?.data || [];
const fearIndex = {
value: parseInt(fngData[0]?.value||50),
label: fngData[0]?.value_classification||‘Nötr’,
timestamp: fngData[0]?.timestamp,
history: fngData.slice(0,30).map(d=>({value:parseInt(d.value),label:d.value_classification,timestamp:d.timestamp}))
};

const cryptoRank = (cgTop||[]).map((c,i)=>({
rank:c.market_cap_rank||i+1, id:c.id, symbol:c.symbol?.toUpperCase(),
name:c.name, price:c.current_price, mcap:c.market_cap, chg24:c.price_change_percentage_24h
}));

const catMap = (title) => {
const t = (title||’’).toLowerCase();
if(/bitcoin|crypto|ethereum|solana|blockchain|coin/.test(t)) return ‘crypto’;
if(/war|conflict|geopolit|military|ukraine|russia|china|turkey/.test(t)) return ‘geo’;
if(/oil|gas|energy|opec|solar|nuclear/.test(t)) return ‘energy’;
if(/fed|inflation|gdp|economy|rate|central bank|ecb/.test(t)) return ‘eco’;
return ‘markets’;
};

const allNews = [
…(news1?.articles||[]),
…(news2?.articles||[]),
].filter(a => a.title && a.url && a.title !== ‘[Removed]’)
.map(a => ({
title: a.title,
url: a.url,
source: a.source?.name || ‘Haber’,
cat: catMap(a.title),
ts: a.publishedAt ? Math.floor(new Date(a.publishedAt).getTime()/1000) : Math.floor(Date.now()/1000)
}))
.sort((a,b) => b.ts - a.ts)
.slice(0, 30);

return res.status(200).json({ok:true, ts:new Date().toISOString(), forex, crypto, metals, fearIndex, cryptoRank, news:allNews});
}
