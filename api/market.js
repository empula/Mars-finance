export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await r.json();
    const u = data.rates.TRY;
    
    return res.status(200).json({
      ok: true,
      usd: u,
      eur: u / data.rates.EUR,
      gbp: u / data.rates.GBP,
    });
  } catch(e) {
    return res.status(200).json({ok: false, error: e.message});
  }
}
