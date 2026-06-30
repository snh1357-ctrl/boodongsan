// src/App.tsx
import { useState } from 'react'
import bjdongData from './data/bjdong.json'
import type { BjdongEntry } from './types'
import { ExcelShell } from './components/ExcelShell'
import { SearchBar } from './components/SearchBar'
import { AptTable } from './components/AptTable'
import { StockSearchBar } from './components/StockSearchBar'
import { StockTable } from './components/StockTable'
import { useAptSearch } from './hooks/useAptSearch'
import { useStockTracker } from './hooks/useStockTracker'

const bjdong = bjdongData as BjdongEntry[]

function ManualPage() {
  return (
    <div className="manual-page">
      <h1>📖 메뉴얼</h1>
      <p className="manual-intro">아파트 실거래가 대시보드 사용 방법을 안내합니다.</p>

      <div className="manual-section">
        <h2>🔍 아파트 검색</h2>
        <p>상단 수식 입력줄에 아파트명을 입력하면 자동완성 목록이 나타납니다.</p>
        <div className="m-box">
          <strong>검색 예시:</strong><br />
          • <code>래미안</code> — 아파트명에 "래미안" 포함<br />
          • <code>ㄹㅁㅇ</code> — 초성으로 "래미안" 검색<br />
          • <code>평촌 엘프라우드</code> — 지역명 + 아파트명 조합
        </div>
        <div className="m-tip">💡 초성 검색을 지원합니다. ㅍㅊ → 평촌, ㄸㅅ → 대성 등</div>
      </div>

      <div className="manual-section">
        <h2>📊 조회 결과</h2>
        <p>아파트를 선택하면 다음 정보를 조회합니다:</p>
        <div className="m-box">
          • <strong>최근 거래가</strong>: 가장 최근 실거래 가격<br />
          • <strong>3개월 평균</strong>: 최근 3개월 평균 거래가<br />
          • <strong>역대 최고가(ATH)</strong>: 기록상 가장 높은 거래가<br />
          • <strong>최고가 대비 등락률</strong>: 현재 거래가 ÷ 역대 최고가<br />
          • <strong>3개월 거래건수</strong>: 최근 3개월 거래량
        </div>
      </div>

      <div className="manual-section">
        <h2>📁 데이터 출처</h2>
        <p>국토교통부 실거래가 공개시스템 API를 활용합니다.</p>
        <div className="m-tip">⚠ 데이터는 신고 기준으로, 실제 잔금일과 다를 수 있습니다.</div>
      </div>
    </div>
  )
}

function RequestPage() {
  return (
    <div id="requestSheet" className="manual-page">
      <h1>💬 요청 / 문의</h1>
      <p className="manual-intro">기능 요청이나 오류 신고는 아래로 연락해 주세요.</p>

      <div className="manual-section">
        <h2>📧 연락처</h2>
        <div className="m-box">
          이메일: <code>snh1357@gmail.com</code>
        </div>
      </div>

      <div className="manual-section">
        <h2>🐛 알려진 문제</h2>
        <ul>
          <li>최초 조회 시 전체 기간 데이터를 로딩하므로 20~40초 소요될 수 있습니다.</li>
          <li>일부 소규모 단지는 데이터가 없을 수 있습니다.</li>
        </ul>
      </div>

      <div className="manual-section">
        <h2>🗺 로드맵</h2>
        <ul>
          <li>지역별 아파트 목록 탐색</li>
          <li>면적별 필터링</li>
          <li>거래 추이 차트</li>
        </ul>
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('apt')
  const [stockFilter, setStockFilter] = useState<'all' | 'US' | 'KR'>('all')
  const { results, loading: aptLoading, loadingAth, error, search, removeResult } = useAptSearch()
  const { stocks, loading: stockLoading, fetchStock, removeStock, refreshAll } = useStockTracker()

  const handleRefresh = () => {
    if (activeTab === 'stock') refreshAll()
    else window.location.reload()
  }

  const isStockLoading = stockLoading.size > 0

  return (
    <ExcelShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      resultCount={activeTab === 'stock' ? stocks.length : results.length}
      onRefresh={handleRefresh}
      stockFilter={activeTab === 'stock' ? stockFilter : undefined}
      onStockFilterChange={setStockFilter}
      statusText={
        activeTab === 'stock'
          ? (isStockLoading ? '주식 데이터 조회중…' : undefined)
          : (aptLoading ? '최근 거래 조회중…' :
             loadingAth ? 'ATH 조회중… (역대 최고가 업데이트 중)' :
             error ? `오류: ${error}` : undefined)
      }
    >
      {activeTab === 'apt' && (
        <>
          <SearchBar bjdong={bjdong} onSearch={(dongCode, aptName) => search({ dongCode, aptName })} loading={aptLoading} />
          <AptTable results={results} onRemove={removeResult} />
        </>
      )}
      {activeTab === 'stock' && (
        <>
          <StockSearchBar onAdd={fetchStock} loading={isStockLoading} />
          <StockTable stocks={stocks} loading={stockLoading} filter={stockFilter} onRemove={removeStock} />
        </>
      )}
      {activeTab === 'manual' && <ManualPage />}
      {activeTab === 'request' && <RequestPage />}
    </ExcelShell>
  )
}
