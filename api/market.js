export default async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Cache-Control’, ‘s-maxage=60, stale-while-revalidate=120’);

const safe = async (url) => {
try {
const r = await fetch(url, {signal: AbortSignal.timeout(8000)});
return await r.json();
} catch(e) { return null; }
};

const AV = ‘E8HD0R47BF0JJCQI’;
const SYMBOLS = [‘AAPL’,‘MSFT’,‘NVDA’,‘AMZN’,‘GOOGL’,‘TSLA’,‘BRK.B’,‘JPM’,‘LLY’,‘ARAMCO’];

const [fx, cg, cgTop, fear, …stocks] = await Promise.all([
safe(‘https://api.exchangerate-api.com/v4/latest/USD’),
safe(‘https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,avalanche-2,ripple,chainlink&vs_currencies=usd&include_24hr_change=true&include_market_cap=true’),
safe(‘https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h’),
safe(‘https://api.alternative.me/fng/?limit=30’),
…SYMBOLS.map(s => safe(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${s}&apikey=${AV}`)),
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

// Hisse verileri - Alpha Vantage
const STOCK_INFO = {
‘AAPL’:  {name:‘Apple’,     ico:‘🏢’, mcap:3.4e12},
‘MSFT’:  {name:‘Microsoft’, ico:‘🤖’, mcap:3.1e12},
‘NVDA’:  {name:‘NVIDIA’,    ico:‘🔍’, mcap:2.9e12},
‘AMZN’:  {name:‘Amazon’,    ico:‘🛒’, mcap:2.1e12},
‘GOOGL’: {name:‘Alphabet’,  ico:‘🔎’, mcap:2.0e12},
‘TSLA’:  {name:‘Tesla’,     ico:‘⚡’, mcap:8.9e11},
‘BRK.B’: {name:‘Berkshire’, ico:‘🏦’, mcap:1.08e12},
‘JPM’:   {name:‘JPMorgan’,  ico:‘💰’, mcap:6.8e11},
‘LLY’:   {name:‘Eli Lilly’, ico:‘💊’, mcap:7.2e11},
‘ARAMCO’:{name:‘Saudi Aramco’,ico:‘🛢️’,mcap:1.76e12},
};

const stockRank = SYMBOLS.map((sym, i) => {
const d = stocks[i]?.[‘Global Quote’];
const info = STOCK_INFO[sym];
if (!d || !d[‘05. price’]) return {symbol:sym, …info, price:null, chg:null};
return {
symbol: sym,
name: info.name,
ico: info.ico,
price: parseFloat(d[‘05. price’]),
chg: parseFloat(d[‘10. change percent’]?.replace(’%’,’’)||0),
mcap: info.mcap,
};
});

return res.status(200).json({
ok:true,
ts:new Date().toISOString(),
forex, crypto, metals, fearIndex, cryptoRank, stockRank, news:[]
});
}
