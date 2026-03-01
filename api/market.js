export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=240');
  try {
    const [fxR, cgR, cgTopR, mtR, fearR, newsR] = await Promise.all([
      fetch('https://api.exchangerate-api.com/v4/latest/USD'),
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,avalanche-2,ripple,chainlink&vs_currencies=usd&include_24hr_change=true&include_market_cap=true'),
      fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h'),
      fetch('https://api.metals.live/v1/spot/gold,silver,platinum,copper'),
      fetch('https://api.alternative.me/fng/?limit=30&format=json'),
      fetch('https://api.coindesk.com/v1/news/'),
    ]);

    const [fx, cg, cgTop, mt, fear] = await Promise.all([
      fxR.json(), cgR.json(), cgTopR.json(), mtR.json(), fearR.json()
    ]);

    let newsData = [];
    try {
      const nd = await newsR.json();
      const articles = nd.Data || nd.articles || nd.data || nd || [];
      newsData = articles.slice(0, 25).map(n => ({
        title: n.title || n.Title,
        url: n.url || n.URL || n.link,
        source: n.source_info?.name || n.source || n.Source || 'CoinDesk',
        ts: n.published_on || n.publishedAt || Math.floor(Date.now()/1000),
      })).filter(n => n.title && n.url);
    } catch(e) {}

    const r = fx.rates, u = r.TRY;
    const forex = {
      usd:{price:u}, eur:{price:u/r.EUR}, gbp:{price:u/r.GBP},
      jpy:{price:(u/r.JPY)*100}, chf:{price:u/r.CHF},
      cad:{price:u/r.CAD}, aud:{price:u/r.AUD}, sar:{price:u/r.SAR},
    };

    const crypto = {
      btc:{price:cg.bitcoin?.usd, chg:cg.bitcoin?.usd_24h_change, mcap:cg.bitcoin?.usd_market_cap},
      eth:{price:cg.ethereum?.usd, chg:cg.ethereum?.usd_24h_change, mcap:cg.ethereum?.usd_market_cap},
      sol:{price:cg.solana?.usd, chg:cg.solana?.usd_24h_change, mcap:cg.solana?.usd_market_cap},
      xrp:{price:cg.ripple?.usd, chg:cg.ripple?.usd_24h_change, mcap:cg.ripple?.usd_market_cap},
      avax:{price:cg['avalanche-2']?.usd, chg:cg['avalanche-2']?.usd_24h_change, mcap:cg['avalanche-2']?.usd_market_cap},
      link:{price:cg.chainlink?.usd, chg:cg.chainlink?.usd_24h_change, mcap:cg.chainlink?.usd_market_cap},
    };

    let gold=null,silver=null,platinum=null,copper=null;
    for(const i of mt){
      if(i.gold) gold=i.gold;
      if(i.silver) silver=i.silver;
      if(i.platinum) platinum=i.platinum;
      if(i.copper) copper=i.copper;
    }
    const metals={gold:{price:gold},silver:{price:silver},platinum:{price:platinum},copper:{price:copper}};

    const fngData=fear?.data||[];
    const fearIndex={
      value:parseInt(fngData[0]?.value||50),
      label:fngData[0]?.value_classification||'Nötr',
      timestamp:fngData[0]?.timestamp,
      history:fngData.slice(0,30).map(d=>({value:parseInt(d.value),label:d.value_classification,timestamp:d.timestamp})),
    };

    const cryptoRank=cgTop.map((coin,i)=>({
      rank:coin.market_cap_rank||i+1,
      id:coin.id,
      symbol:coin.symbol?.toUpperCase(),
      name:coin.name,
      price:coin.current_price,
      mcap:coin.market_cap,
      chg24:coin.price_change_percentage_24h,
    }));

    return res.status(200).json({ok:true,ts:new Date().toISOString(),forex,crypto,metals,fearIndex,cryptoRank,news:newsData});
  } catch(e) {
    return res.status(500).json({ok:false,error:e.message});
  }
}
