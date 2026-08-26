export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const safe = async (url, timeoutMs) => {
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), timeoutMs || 8000);
    try {
      const r = await fetch(url, {signal: ctrl.signal});
      return await r.json();
    } catch(e) { return null; }
    finally { clearTimeout(t); }
  };
  // Bir kaynak sırayla dener, ilk geçerli (rates alanı dolu) yanıtı döner.
  const safeChain = async (urls) => {
    for (const url of urls) {
      const d = await safe(url);
      if (d?.rates) return d;
    }
    return null;
  };

  const [fx, cg, cgTop, fear, goldR, silverR, platR, copperR, newsR] = await Promise.all([
    // api.exchangerate-api.com/v4 (anahtarsız) ücretsiz kullanıcılar için
    // durağan/bayat veri döndürmeye başladı; open.er-api.com resmi halefi.
    safeChain(['https://open.er-api.com/v6/latest/USD','https://api.exchangerate-api.com/v4/latest/USD']),
    safe('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,avalanche-2,ripple,chainlink&vs_currencies=usd&include_24hr_change=true&include_market_cap=true'),
    safe('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h'),
    safe('https://api.alternative.me/fng/?limit=30'),
    safe('https://api.gold-api.com/price/XAU'),
    safe('https://api.gold-api.com/price/XAG'),
    safe('https://api.gold-api.com/price/XPT'),
    safe('https://api.gold-api.com/price/XCU'),
    safe('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&limit=30&sortOrder=latest'),
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
      avax:{price:cg['avalanche-2']?.usd, chg:cg['avalanche-2']?.usd_24h_change, mcap:cg['avalanche-2']?.usd_market_cap},
      link:{price:cg.chainlink?.usd, chg:cg.chainlink?.usd_24h_change, mcap:cg.chainlink?.usd_market_cap},
    };
  }

  // gold-api.com anahtar gerektirmez ama garantili SLA sunmaz; alan adı
  // farklı çıkarsa veya servis çökerse aşağıdaki sabit değerlere düşülür.
  const parsePrice = (obj) => {
    if(!obj) return null;
    const v = obj.price ?? obj.rate ?? obj.value ?? obj.ask ?? obj.bid;
    return typeof v === 'number' && isFinite(v) && v > 0 ? v : null;
  };
  const metals = {
    gold:{price: parsePrice(goldR) || 4670},
    silver:{price: parsePrice(silverR) || 69},
    platinum:{price: parsePrice(platR) || 1867},
    copper:{price: parsePrice(copperR) || 6.75},
  };

  // Haberler (CryptoCompare - anahtar gerektirmez)
  let news = [];
  if(newsR?.Data) {
    const getCat = (t) => {
      t = (t||'').toLowerCase();
      if(/oil|energy|opec|brent|wti|gas|fuel/.test(t)) return 'energy';
      if(/war|iran|ukraine|russia|china|conflict|sanction|military|nato|israel/.test(t)) return 'geo';
      if(/fed|inflation|gdp|economy|rate|recession|employment|cpi/.test(t)) return 'eco';
      if(/stock|nasdaq|s&p|dow|equity|bond|yield|earnings/.test(t)) return 'markets';
      return 'crypto';
    };
    const ICO = {crypto:'₿', markets:'📊', eco:'🏦', geo:'🌍', energy:'⚡'};
    news = newsR.Data.slice(0,30).filter(a=>a.title && a.url).map(a=>{
      const cat = getCat(a.title+' '+(a.tags||''));
      return {
        cat, ico: ICO[cat], title: a.title,
        source: a.source_info?.name || a.source || 'Haber',
        url: a.url, ts: a.published_on,
      };
    });
  }

  const fngData = fear?.data || [];
  const fearIndex = {
    value: parseInt(fngData[0]?.value||50),
    label: fngData[0]?.value_classification||'Nötr',
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

  return res.status(200).json({
    ok:true,
    ts:new Date().toISOString(),
    forex, crypto, metals, fearIndex, cryptoRank, news
  });
}
