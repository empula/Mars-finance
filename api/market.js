export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const safe = async (url) => {
    try {
      const r = await fetch(url, {
        headers: {'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json'},
        signal: AbortSignal.timeout(7000)
      });
      return await r.json();
    } catch(e) { return null; }
  };

  const [fx, cg, cgTop, mt, fear] = await Promise.all([
    safe('https://api.exchangerate-api.com/v4/latest/USD'),
    safe('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,avalanche-2,ripple,chainlink&vs_currencies=usd&include_24hr_change=true&include_market_cap=true'),
    safe('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h'),
    safe('https://api.metals.live/v1/spot/gold,silver,platinum,copper'),
    safe('https://api.alternative.me/fng/?limit=30&format=json'),
  ]);

  const debug = {fx:!!fx, cg:!!cg, cgTop:!!cgTop, mt:!!mt, fear:!!fear};

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
      avax:{price:cg['avalanche-2']?.usd, chg:cg['avalanche-2']?.usd_24h_change, mcap:cg['avalanche-2']?.usd_market_cap},
      link:{price:cg.chainlink?.usd, chg:cg.chainlink?.usd_24h_change, mcap:cg.chainlink?.usd_market_cap},
    };
  }

  let metals = {gold:{price:null},silver:{price:null},platinum:{price:null},copper:{price:null}};
  if(mt && Array.isArray(mt)) {
    for(const i of mt){
      if(i.gold) metals.gold.price=i.gold;
      if(i.silver) metals.silver.price=i.silver;
      if(i.platinum) metals.platinum.price=i.platinum;
      if(i.copper) metals.copper.price=i.copper;
    }
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

  const cryptoRank = (​​​​​​​​​​​​​​​​
