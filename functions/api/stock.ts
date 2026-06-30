// Cloudflare Pages Function: /api/stock?symbol=AMD
// Returns current price, ATH, 52w stats from Yahoo Finance

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url)
  const symbol = url.searchParams.get('symbol')?.toUpperCase().trim()
  if (!symbol) return json({ error: 'symbol required' }, 400)

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Accept: 'application/json',
  }

  try {
    // Fetch quote + ATH history in parallel
    const [quoteRes, chartRes] = await Promise.all([
      fetch(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=price,summaryDetail`, { headers }),
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=max&interval=1mo`, { headers }),
    ])

    if (!quoteRes.ok) return json({ error: `Yahoo Finance error: ${quoteRes.status}` }, 502)

    const quoteData = await quoteRes.json() as YahooQuoteSummary
    const result = quoteData?.quoteSummary?.result?.[0]
    if (!result) return json({ error: 'Symbol not found' }, 404)

    const price = result.price
    const summary = result.summaryDetail

    const currentPrice = price.regularMarketPrice?.raw ?? 0
    const currency = price.currency ?? 'USD'
    const market: 'US' | 'KR' = (price.exchangeName ?? '').includes('KSC') || symbol.endsWith('.KS') || symbol.endsWith('.KQ') ? 'KR' : 'US'

    // Pre/After market
    let prePostPrice: number | undefined
    let prePostLabel: 'Pre' | 'After' | undefined
    const now = new Date()
    const utcHour = now.getUTCHours()
    const isPreMarket = utcHour >= 9 && utcHour < 13.5  // ~4am-9:30am ET (UTC-4)
    if (market === 'US') {
      const preMarket = price.preMarketPrice?.raw
      const postMarket = price.postMarketPrice?.raw
      if (preMarket && preMarket !== currentPrice) { prePostPrice = preMarket; prePostLabel = 'Pre' }
      else if (postMarket && postMarket !== currentPrice) { prePostPrice = postMarket; prePostLabel = 'After' }
      void isPreMarket
    }

    // ATH from historical monthly data
    let ath = summary?.fiftyTwoWeekHigh?.raw ?? currentPrice
    let athDate = ''
    if (chartRes.ok) {
      const chartData = await chartRes.json() as YahooChart
      const chartResult = chartData?.chart?.result?.[0]
      if (chartResult) {
        const timestamps = chartResult.timestamp ?? []
        const highs = chartResult.indicators?.quote?.[0]?.high ?? []
        let maxHigh = 0
        let maxTs = 0
        for (let i = 0; i < highs.length; i++) {
          const h = highs[i]
          if (h != null && h > maxHigh) { maxHigh = h; maxTs = timestamps[i] }
        }
        if (maxHigh > 0) {
          ath = maxHigh
          const d = new Date(maxTs * 1000)
          athDate = `${d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
        }
      }
    }

    const athDiff = currentPrice - ath
    const athDiffPct = ath > 0 ? ((currentPrice / ath) - 1) * 100 : 0

    const week52High = summary?.fiftyTwoWeekHigh?.raw ?? currentPrice
    const week52Low = summary?.fiftyTwoWeekLow?.raw ?? currentPrice
    const week52HighPct = week52High > 0 ? ((currentPrice / week52High) - 1) * 100 : 0
    const week52LowPct = week52Low > 0 ? ((currentPrice / week52Low) - 1) * 100 : 0

    const dailyChange = price.regularMarketChange?.raw ?? 0
    const dailyChangePct = price.regularMarketChangePercent?.raw ? price.regularMarketChangePercent.raw * 100 : 0

    return json({
      symbol,
      market,
      name: price.shortName ?? price.longName ?? symbol,
      currency,
      currentPrice,
      prePostPrice,
      prePostLabel,
      dailyChange,
      dailyChangePct,
      ath,
      athDate,
      athDiff,
      athDiffPct,
      week52High,
      week52HighPct,
      week52Low,
      week52LowPct,
    })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
}

// Yahoo Finance search autocomplete
export const onRequestGet2: PagesFunction = async ({ request }) => {
  const url = new URL(request.url)
  const q = url.searchParams.get('q')
  if (!q) return json([], 200)
  const res = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&listsCount=0`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (!res.ok) return json([], 200)
  const data = await res.json() as { quotes?: Array<{ symbol: string; shortname?: string; longname?: string; quoteType?: string; exchDisp?: string }> }
  const results = (data.quotes ?? []).map(q => ({
    symbol: q.symbol,
    name: q.shortname ?? q.longname ?? q.symbol,
    type: q.quoteType ?? '',
    exchange: q.exchDisp ?? '',
  }))
  return json(results, 200)
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

// --- Yahoo Finance response types (partial) ---
interface YFValue { raw: number; fmt?: string }
interface YahooQuoteSummary {
  quoteSummary: {
    result?: [{
      price: {
        shortName?: string; longName?: string; currency?: string; exchangeName?: string
        regularMarketPrice?: YFValue; regularMarketChange?: YFValue; regularMarketChangePercent?: YFValue
        preMarketPrice?: YFValue; postMarketPrice?: YFValue
      }
      summaryDetail: { fiftyTwoWeekHigh?: YFValue; fiftyTwoWeekLow?: YFValue }
    }]
  }
}
interface YahooChart {
  chart: {
    result?: [{ timestamp: number[]; indicators: { quote: [{ high: (number | null)[] }] } }]
  }
}
