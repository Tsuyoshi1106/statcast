export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const tickers = ['GLD','XLE','XOP','XLK','XLU','XLF','SLV','GDX',
                   'XLV','SOXL','SOXS','TECL','IWM','TLT','XLB','UUP','DBA']

  const results = {}

  await Promise.allSettled(tickers.map(async (tk) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${tk}?interval=1d&range=6mo`
      const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      const j = await response.json()
      const result = j?.chart?.result?.[0]
      if (!result) throw new Error('no data')

      const closes = (result.indicators?.quote?.[0]?.close || []).filter(v => v != null)
      const meta = result.meta || {}
      const n = closes.length
      if (n < 10) throw new Error('insufficient data')

      const now = meta.regularMarketPrice || closes[n-1]

      // 移動平均
      const ma = (arr, period) => arr.slice(-period).reduce((s,v)=>s+v,0)/period
      const ma10 = ma(closes, 10)
      const ma30 = n >= 30 ? ma(closes, 30) : null

      // 連続マイナス日数
      let streak = 0
      for (let i = n-1; i > 0; i--) {
        if (closes[i] < closes[i-1]) streak++
        else break
      }

      // 直近5日リターン
      const r5d = n > 5 ? (closes[n-1] - closes[n-6]) / closes[n-6] * 100 : 0

      // 直近10日の終値（ミニチャート用）
      const daily = closes.slice(-10).map(v => +v.toFixed(2))

      results[tk] = {
        n:   +(now ?? 0).toFixed(2),
        m1:  +((n > 21 ? closes[n-22] : closes[0]) ?? 0).toFixed(2),
        m3:  +((n > 63 ? closes[n-64] : closes[0]) ?? 0).toFixed(2),
        m6:  +(closes[0] ?? 0).toFixed(2),
        r5d: +r5d.toFixed(2),
        ma10: +ma10.toFixed(2),
        ma30: ma30 ? +ma30.toFixed(2) : null,
        streak,
        daily,
      }
    } catch(e) {
      results[tk] = null
    }
  }))

  res.status(200).json(results)
}
