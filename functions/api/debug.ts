// functions/api/debug.ts — API 연결 테스트용 (배포 후 삭제 예정)
interface Env { MOLIT_API_KEY: string }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const key = context.env.MOLIT_API_KEY
  const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade?serviceKey=${key}&LAWD_CD=41173&DEAL_YMD=202501&numOfRows=3&pageNo=1`

  let status = 0, body = '', error = ''
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/xml, text/xml, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer': 'https://www.data.go.kr/',
      }
    })
    status = res.status
    body = (await res.text()).slice(0, 500)
  } catch (e: any) {
    error = e?.message ?? String(e)
  }

  return new Response(JSON.stringify({ status, body, error, keyLen: key?.length ?? 0 }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  })
}
