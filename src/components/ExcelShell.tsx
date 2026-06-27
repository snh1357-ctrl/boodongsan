// src/components/ExcelShell.tsx
import type { ReactNode } from 'react'

interface Tab {
  id: string
  label: string
}

interface Props {
  activeTab: string
  onTabChange: (id: string) => void
  children: ReactNode
  statusText?: string
  resultCount?: number
}

const TABS: Tab[] = [
  { id: 'home', label: '홈' },
  { id: 'region', label: '지역검색' },
]

export function ExcelShell({ activeTab, onTabChange, children, statusText, resultCount = 0 }: Props) {
  return (
    <div className="xl">
      {/* 타이틀바 */}
      <div id="xlTopScroll">
        <div id="xlTopInner">
          <div className="xl-title">
            <div className="xl-logo" />
            <div className="xl-qat">
              <span className="xl-autosave-lbl">부동산</span>
            </div>
            <div className="xl-title-text">아파트 실거래가 대시보드</div>
            <div className="xl-title-right" />
          </div>

          {/* 리본 탭 */}
          <div className="xl-rtabs">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`xl-rtab${activeTab === tab.id ? ' on' : ''}`}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 시트 영역 */}
      {children}

      {/* 시트 탭 */}
      <div className="xl-tabs">
        {TABS.map(tab => (
          <div
            key={tab.id}
            className={`xl-tab${activeTab === tab.id ? ' on' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </div>
        ))}
      </div>

      {/* 상태바 */}
      <div className="xl-status">
        <span>{statusText ?? '아파트명을 검색하거나 지역을 선택하세요'}</span>
        <div className="sr">
          {resultCount > 0 && <span>조회 결과: {resultCount}개 단지</span>}
        </div>
      </div>
    </div>
  )
}
