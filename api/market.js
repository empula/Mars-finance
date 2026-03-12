export default async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Cache-Control’, ‘s-maxage=60, stale-while-revalidate=120’);

const safe = async (url) => {
try {
const r = await fetch(url);
if (!r.ok) return null;
return await r.json();
} catch(e) { return null; }
};

const [fx, cg, binanceTickers, fear] = await Promise.all([
safe(‘https://api.exchangerate-api.com/v4/latest/USD’),
safe(‘https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,avalanche-2,ripple,chainlink&vs_currencies=usd&include_24hr_change=true&include_market_cap=true’),
safe(‘https://api.binance.com/api/v3/ticker/24hr’),
safe(‘https://api.alternative.me/fng/?limit=30’),
]);

let forex = {};
if(fx?.rates) {
const r = fx.rates;
const u = r.TRY;
forex = {
usd: {price: parseFloat(u.toFixed(2))},
eur: {price: parseFloat((u/r.EUR).toFixed(2))},
gbp: {price: parseFloat((u/r.GBP).toFixed(2))},
jpy: {price: parseFloat((u/r.JPY).toFixed(2))},
chf: {price: parseFloat((u/r.CHF).toFixed(2))},
cad: {price: parseFloat((u/r.CAD).toFixed(2))},
aud: {price: parseFloat((u/r.AUD).toFixed(2))},
sar: {price: parseFloat((u/r.SAR).toFixed(2))},
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
gold:{price:5265}, silver:{price:94},
platinum:{price:2010}, copper:{price:4.38},
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

const TOP_SYMBOLS = [
‘BTCUSDT’,‘ETHUSDT’,‘BNBUSDT’,‘SOLUSDT’,‘XRPUSDT’,
‘DOGEUSDT’,‘ADAUSDT’,‘AVAXUSDT’,‘LINKUSDT’,‘DOTUSDT’,
‘TRXUSDT’,‘LTCUSDT’,‘XLMUSDT’,‘UNIUSDT’,‘NEARUSDT’,
‘APTUSDT’,‘OPUSDT’,‘MATICUSDT’,‘ATOMUSDT’,‘FILUSDT’,
‘ICPUSDT’,‘LDOUSDT’,‘INJUSDT’,‘SUIUSDT’,‘SEIUSDT’,
‘TIAUSDT’,‘FETUSDT’,‘WLDUSDT’,‘JUPUSDT’,‘ARBUSDT’,
‘AAVEUSDT’,‘MKRUSDT’,‘STXUSDT’,‘RUNEUSDT’,‘ALGOUSDT’,
‘EGLDUSDT’,‘FLOWUSDT’,‘XTZUSDT’,‘SANDUSDT’,‘MANAUSDT’,
‘GALAUSDT’,‘APEUSDT’,‘CRVUSDT’,‘COMPUSDT’,‘SNXUSDT’,
‘ZECUSDT’,‘DASHUSDT’,‘ENJUSDT’,‘CHZUSDT’,‘BATUSDT’,
];

const cryptoRank = (binanceTickers || [])
.filter(t => TOP_SYMBOLS.includes(t.symbol))
.sort((a, b) => TOP_SYMBOLS.indexOf(a.symbol) - TOP_SYMBOLS.indexOf(b.symbol))
.map((t, i) => ({
rank:  i + 1,
id:    t.symbol,
symbol: t.symbol.replace(‘USDT’, ‘’),
name:  t.symbol.replace(‘USDT’, ‘’),
price: parseFloat(t.lastPrice),
mcap:  parseFloat(t.quoteVolume),
chg24: parseFloat(t.priceChangePercent),
}));

return res.status(200).json({
ok: true,
ts: new Date().toISOString(),
forex, crypto, metals, fearIndex, cryptoRank, news:[]
});
}
