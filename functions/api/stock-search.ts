// Cloudflare Pages Function: /api/stock-search?q=apple
export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url)
  const q = url.searchParams.get('q')?.trim()
  if (!q) return json([])

  const res = await fetch(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&listsCount=0`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  )
  if (!res.ok) return json([])

  const data = await res.json() as {
    quotes?: Array<{ symbol: string; shortname?: string; longname?: string; quoteType?: string; exchDisp?: string }>
  }
  const results = (data.quotes ?? [])
    .filter(q => q.quoteType === 'EQUITY' || q.quoteType === 'ETF' || q.quoteType === 'MUTUALFUND')
    .map(q => ({
      symbol: q.symbol,
      name: q.shortname ?? q.longname ?? q.symbol,
      type: q.quoteType ?? '',
      exchange: q.exchDisp ?? '',
    }))

  return json(results)
}

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
