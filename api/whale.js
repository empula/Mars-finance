const ETHERSCAN_KEY = 'DDAQFVQ45K1R3IZ2TACITJGA79IZCHH3R2';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const r = await fetch(
      'https://api.etherscan.io/api?module=account&action=txlist'
      + '&address=0x28c6c06298d514db089934071355e5743bf21d60'
      + '&page=1&offset=5&sort=desc'
      + '&apikey=' + ETHERSCAN_KEY
    );
    const d = await r.json();
    return res.status(200).json({ ok: true, status: d.status, message: d.message, count: d.result?.length });
  } catch(e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
}
