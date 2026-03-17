export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const tickers = ['GLD','XLE','XOP','XLK','XLU','XLF','SLV','GDX',
                   'XLV','SOXL','SOXS','TECL','IWM','TLT','XLB','UUP','DBA']

  const results = {}

  await Promise.allSettled(tickers.map(async (tk) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${tk}?interval=1d&range=6mo`
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
      const j = await response.json()
      const result = j?.chart?.result?.[0]
      if (!result) throw new Error('no data')
      const closes = (result.indicators?.quote?.[0]?.close || []).filter(v => v != null)
      const meta = result.meta || {}
      const n = closes.length
      if (n < 5) throw new Error('insufficient data')
      results[tk] = {
        n:  +((meta.regularMarketPrice || closes[n-1]) ?? 0).toFixed(2),
        m1: +((n > 21 ? closes[n-22] : closes[0]) ?? 0).toFixed(2),
        m3: +((n > 63 ? closes[n-64] : closes[0]) ?? 0).toFixed(2),
        m6: +(closes[0] ?? 0).toFixed(2),
      }
    } catch(e) {
      results[tk] = null
    }
  }))

  res.status(200).json(results)
}
