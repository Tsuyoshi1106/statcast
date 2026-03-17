export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const tickers = ['GLD','XLE','XOP','XLK','XLU','XLF','SLV','XLV',
                   'SOXL','SOXS','TECL','IWM','TLT','XLB','UUP','SPY','DBA','USO','UNG']

  const LEV = { SOXL: 3, SOXS: 3, TECL: 3 }
  const results = {}

  await Promise.allSettled(tickers.map(async (tk) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${tk}?interval=1d&range=3mo`
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      const j = await r.json()
      const result = j?.chart?.result?.[0]
      if (!result) throw new Error('no data')

      const raw = result.indicators?.quote?.[0] || {}
      const highs  = (raw.high  || []).filter((v,i) => v != null)
      const lows   = (raw.low   || []).filter((v,i) => v != null)
      const closes = (raw.close || []).filter(v => v != null)
      const n = closes.length
      if (n < 22) throw new Error('insufficient data')

      const meta = result.meta || {}
      const now = meta.regularMarketPrice || closes[n-1]

      // ── Parkinson IV（20日ローリング、直近20日） ──
      const ln2x4 = 4 * Math.log(2)
      let parkSum = 0
      const parkWindow = Math.min(20, highs.length, lows.length)
      const hArr = highs.slice(-parkWindow)
      const lArr = lows.slice(-parkWindow)
      for (let i = 0; i < parkWindow; i++) {
        const ratio = hArr[i] / Math.max(lArr[i], 0.0001)
        parkSum += Math.log(ratio) ** 2
      }
      const parkinson_iv = Math.sqrt((252 / ln2x4) * (parkSum / parkWindow))

      // ── MA10 / MA30 ──
      const ma = (arr, p) => arr.slice(-p).reduce((s,v)=>s+v,0)/p
      const ma10 = n >= 10 ? ma(closes, 10) : null
      const ma30 = n >= 30 ? ma(closes, 30) : null

      // ── R1M (21営業日) ──
      const p1m = n > 21 ? closes[n-22] : closes[0]
      const r1m = (now - p1m) / p1m * 100

      // ── R5D (直近5営業日) ──
      const p5d = n > 5 ? closes[n-6] : closes[0]
      const r5d = (now - p5d) / p5d * 100

      // ── streak (連続下落日数) ──
      let streak = 0
      for (let i = n-1; i > 0; i--) {
        if (closes[i] < closes[i-1]) streak++
        else break
      }

      // ── 新スコア式 ──
      // Score = 0.5×R1M + 0.5×(R5D×5) ÷ レバ − 1.0(MA10<MA30)
      const lev = LEV[tk] || 1
      let score = (0.5 * r1m + 0.5 * (r5d * 5)) / lev
      if (ma10 && ma30 && ma10 < ma30) score -= 1.0
      const excluded = streak >= 3 && r5d < -3.0

      results[tk] = {
        n:    +now.toFixed(2),
        m1:   +p1m.toFixed(2),
        r1m:  +r1m.toFixed(2),
        r5d:  +r5d.toFixed(2),
        ma10: ma10 ? +ma10.toFixed(2) : null,
        ma30: ma30 ? +ma30.toFixed(2) : null,
        streak,
        iv:   +parkinson_iv.toFixed(4),
        score: +score.toFixed(2),
        excluded,
        daily: closes.slice(-10).map(v => +v.toFixed(2)),
      }
    } catch(e) {
      results[tk] = null
    }
  }))

  res.status(200).json(results)
}
