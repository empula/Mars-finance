export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  try {
    return await buildResponse(res);
  } catch(e) {
    // Beklenmeyen bir hata tüm endpoint'i 500'e düşürmesin diye ok:false
    // ile döneriz - frontend bunu görünce kendi simülasyonuna geçer (en
    // azından ekran donuk kalmaz), gerçek veri geldiğinde onu kullanır.
    return res.status(200).json({
      ok:false, ts:new Date().toISOString(), error: String(e && e.message || e),
      forex:{}, crypto:{},
      metals:{gold:{price:4670},silver:{price:69},platinum:{price:1867},copper:{price:6.75}},
      fearIndex:{value:null,label:null,timestamp:null,history:[]},
      cryptoRank:[], news:[],
    });
  }
}

async function buildResponse(res) {
  // Tek bir dış çağrının patlaması ya da asılı kalması tüm endpoint'i
  // 500'e düşürmesin diye safe() ASLA reject etmez, hep null döner.
  const safe = async (url, timeoutMs) => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(()=>ctrl.abort(), timeoutMs || 8000);
      try {
        // Bazı ücretsiz API'ler User-Agent'sız/generic sunucu isteklerini
        // bot sanıp 403 ile reddediyor - tarayıcı benzeri bir UA gönderiyoruz.
        const r = await fetch(url, {
          signal: ctrl.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/json',
          },
        });
        return await r.json();
      } finally { clearTimeout(t); }
    } catch(e) { return null; }
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
  try {
    const r = fx?.rates;
    const u = r?.TRY;
    if(typeof u === 'number') {
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
  } catch(e) { /* forex boş kalır, frontend son bilinen değeri korur */ }

  // Her bölüm kendi try/catch'i içinde - biri (ör. rate-limit'e takılıp
  // dizi yerine hata nesnesi dönen bir kaynak) patlarsa diğerlerinin
  // topladığı veri çöpe gitmesin.
  let crypto = {};
  try {
    if(cg && typeof cg === 'object') {
      crypto = {
        btc:{price:cg.bitcoin?.usd, chg:cg.bitcoin?.usd_24h_change, mcap:cg.bitcoin?.usd_market_cap},
        eth:{price:cg.ethereum?.usd, chg:cg.ethereum?.usd_24h_change, mcap:cg.ethereum?.usd_market_cap},
        sol:{price:cg.solana?.usd, chg:cg.solana?.usd_24h_change, mcap:cg.solana?.usd_market_cap},
        xrp:{price:cg.ripple?.usd, chg:cg.ripple?.usd_24h_change, mcap:cg.ripple?.usd_market_cap},
        avax:{price:cg['avalanche-2']?.usd, chg:cg['avalanche-2']?.usd_24h_change, mcap:cg['avalanche-2']?.usd_market_cap},
        link:{price:cg.chainlink?.usd, chg:cg.chainlink?.usd_24h_change, mcap:cg.chainlink?.usd_market_cap},
      };
    }
  } catch(e) { /* crypto boş kalır */ }

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

  // Haberler (CryptoCompare - anahtar gerektirmez). Rate-limit'e takılırsa
  // Data alanı dizi değil hata nesnesi olabilir - Array.isArray ile korunur.
  let news = [];
  try {
    if(Array.isArray(newsR?.Data)) {
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
  } catch(e) { /* news boş kalır */ }

  // API başarısız olursa value:null döner - sahte "50 Nötr" göstermeyiz,
  // frontend bunu "veri yok" sayıp mevcut/simüle değeri korur.
  const fngData = fear?.data || [];
  const fearIndex = fngData.length ? {
    value: parseInt(fngData[0].value),
    label: fngData[0].value_classification || 'Nötr',
    timestamp: fngData[0].timestamp,
    history: fngData.slice(0,30).map(d=>({
      value:parseInt(d.value),
      label:d.value_classification,
      timestamp:d.timestamp
    })),
  } : { value: null, label: null, timestamp: null, history: [] };

  // CoinGecko rate-limit'e takılırsa dizi yerine hata nesnesi dönebilir.
  let cryptoRank = [];
  try {
    if(Array.isArray(cgTop)) {
      cryptoRank = cgTop.map((coin,i)=>({
        rank:coin.market_cap_rank||i+1,
        id:coin.id,
        symbol:coin.symbol?.toUpperCase(),
        name:coin.name,
        price:coin.current_price,
        mcap:coin.market_cap,
        chg24:coin.price_change_percentage_24h,
      }));
    }
  } catch(e) { /* cryptoRank boş kalır */ }

  return res.status(200).json({
    ok:true,
    ts:new Date().toISOString(),
    forex, crypto, metals, fearIndex, cryptoRank, news,
    // Hangi dış kaynağın yanıt verdiğini gösterir - tanı amaçlı, arayüzde kullanılmaz.
    _sources: {
      forex: Object.keys(forex).length>0, crypto: Object.keys(crypto).length>0,
      cryptoRank: cryptoRank.length>0, fear: fngData.length>0,
      gold: parsePrice(goldR)!=null, silver: parsePrice(silverR)!=null,
      platinum: parsePrice(platR)!=null, copper: parsePrice(copperR)!=null,
      news: news.length>0,
    },
  });
}
