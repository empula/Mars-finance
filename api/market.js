export default async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Cache-Control’, ‘s-maxage=120, stale-while-revalidate=240’);

const safeJson = async (url) => {
try { const r = await fetch(url, {signal: AbortSignal.timeout(7000)}); return await r.json(); } catch(e) { return null; }
};

const safeRSS = async (url) => {
try { const r = await fetch(url, {headers:{‘User-Agent’:‘Mozilla/5.0’}, signal: AbortSignal.timeout(5000)}); return await r.text(); } catch(e) { return null; }
};

const parseRSS = (xml, source, cat) => {
if(!xml) return [];
const items = [], re = /<item[^>]*>([\s\S]*?)</item>/gi;
let m;
while((m = re.exec(xml)) !== null && items.length < 5) {
const b = m[1];
const title = (b.match(/<title[^>]*><![CDATA[(.*?)]]></title>/) || b.match(/<title[^>]*>(.*?)</title>/) || [])[1];
const link = (b.match(/<link>(.*?)</link>/) || b.match(/<guid[^>]*>(https?[^<]+)</guid>/) || [])[1];
const pub = (b.match(/<pubDate>(.*?)</pubDate>/) || [])[1];
if(title && link) items.push({
title: title.replace(/&/g,’&’).replace(/</g,’<’).replace(/>/g,’>’).replace(/<[^>]+>/g,’’).trim(),
url: link.trim(), source, cat,
ts: pub ? Math.floor(new Date(pub).getTime()/1000) : Math.floor(Date.now()/1000)
});
}
return items;
};

const [fx, cg, cgTop, fear] = await Promise.all([
safeJson(‘https://api.exchangerate-api.com/v4/latest/USD’),
safeJson(‘https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,avalanche-2,ripple,chainlink&vs_currencies=usd&include_24hr_change=true&include_market_cap=true’),
safeJson(‘https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h’),
safeJson(‘https://api.alternative.me/fng/?limit=30’),
]);

const [r1, r2, r3, r4, r5] = await Promise.all([
safeRSS(‘https://www.coindesk.com/arc/outboundfeeds/rss/’),
safeRSS(‘https://cointelegraph.com/rss’),
safeRSS(‘https://feeds.bbci.co.uk/news/world/rss.xml’),
safeRSS(‘https://feeds.reuters.com/reuters/businessNews’),
safeRSS(‘https://www.ft.com/rss/home’),
]);

const r = fx?.rates, u = r?.TRY;
const forex = r ? {usd:{price:u},eur:{price:u/r.EUR},gbp:{price:u/r.GBP},jpy:{price:(u/r.JPY)*100},chf:{price:u/r.CHF},cad:{price:u/r.CAD},aud:{price:u/r.AUD},sar:{price:u/r.SAR}} : {};
const crypto = cg ? {btc:{price:cg.bitcoin?.usd,chg:cg.bitcoin?.usd_24h_change,mcap:cg.bitcoin?.usd_market_cap},eth:{price:cg.ethereum?.usd,chg:cg.ethereum?.usd_24h_change,mcap:cg.ethereum?.usd_market_cap},sol:{price:cg.solana?.usd,chg:cg.solana?.usd_24h_change,mcap:cg.solana?.usd_market_cap},xrp:{price:cg.ripple?.usd,chg:cg.ripple?.usd_24h_change,mcap:cg.ripple?.usd_market_cap},avax:{price:cg[‘avalanche-2’]?.usd,chg:cg[‘avalanche-2’]?.usd_24h_change,mcap:cg[‘avalanche-2’]?.usd_market_cap},link:{price:cg.chainlink?.usd,chg:cg.chainlink?.usd_24h_change,mcap:cg.chainlink?.usd_market_cap}} : {};
const metals = {gold:{price:3118},silver:{price:33.80},platinum:{price:1042},copper:{price:4.38}};
const fngData = fear?.data || [];
const fearIndex = {value:parseInt(fngData[0]?.value||50),label:fngData[0]?.value_classification||‘Nötr’,timestamp:fngData[0]?.timestamp,history:fngData.slice(0,30).map(d=>({value:parseInt(d.value),label:d.value_classification,timestamp:d.timestamp}))};
const cryptoRank = (cgTop||[]).map((c,i)=>({rank:c.market_cap_rank||i+1,id:c.id,symbol:c.symbol?.toUpperCase(),name:c.name,price:c.current_price,mcap:c.market_cap,chg24:c.price_change_percentage_24h}));
const news = […parseRSS(r1,‘CoinDesk’,‘crypto’),…parseRSS(r2,‘CoinTelegraph’,‘crypto’),…parseRSS(r3,‘BBC News’,‘geo’),…parseRSS(r4,‘Reuters’,‘markets’),…parseRSS(r5,‘Financial Times’,‘eco’)].sort((a,b)=>b.ts-a.ts).slice(0,20);

return res.status(200).json({ok:true,ts:new Date().toISOString(),forex,crypto,metals,fearIndex,cryptoRank,news});
}
