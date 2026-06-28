// src/components/ExcelShell.tsx
import type { ReactNode } from 'react'

const RIBBON_TABS = ['파일', '홈', '삽입', '그리기', '페이지 레이아웃', '수식', '데이터', '검토', '보기', '자동화', '도움말']

const SHEET_TABS = [
  { id: 'apt', label: '아파트' },
  { id: 'manual', label: '메뉴얼' },
  { id: 'request', label: '요청' },
]

interface Props {
  activeTab: string
  onTabChange: (id: string) => void
  children: ReactNode
  statusText?: string
  resultCount?: number
}

export function ExcelShell({ activeTab, onTabChange, children, statusText, resultCount = 0 }: Props) {
  return (
    <div className="xl">
      <div id="xlTopScroll">
        <div id="xlTopInner">
          {/* 타이틀바 */}
          <div className="xl-title">
            <div className="xl-logo" />
            <div className="xl-qat">
              <span className="xl-autosave-lbl">부동산</span>
              <span className="xl-toggle" />
              <span className="xl-qat-sep" />
              <button className="xl-qat-btn" title="저장">💾</button>
              <button className="xl-qat-btn dim" title="실행취소">↩</button>
              <button className="xl-qat-btn dim" title="다시실행">↪</button>
            </div>
            <span className="xl-title-text">아파트 실거래가.xlsx — 부동산</span>
            <div className="xl-search">
              <span className="xl-search-ico">🔍</span>
              <input className="xl-search-inp" type="text" placeholder="검색 (Alt+Q)" readOnly />
            </div>
            <div className="xl-title-right">
              <div className="xl-avatar" title="계정">부</div>
              <button className="xl-cr-btn share-btn">공유</button>
              <div className="xl-win">
                <button className="xl-win-btn">─</button>
                <button className="xl-win-btn">□</button>
                <button className="xl-win-btn danger">✕</button>
              </div>
            </div>
          </div>

          {/* 리본 탭 */}
          <div className="xl-rtabs">
            <button className="xl-filebtn">{RIBBON_TABS[0]}</button>
            {RIBBON_TABS.slice(1).map(tab => (
              <span key={tab} className={`xl-rtab${tab === '홈' ? ' on' : ''}`}>{tab}</span>
            ))}
            <div className="xl-rtabs-right">
              <button className="xl-rtab-ico" title="리본 축소">∧</button>
            </div>
          </div>

          {/* 리본 콘텐츠 */}
          <div className="xl-ribbon">
            <div className="rg rg-deco rg-d1">
              <div className="rg-top">
                <button className="rb lg" style={{ padding: '3px 10px', borderRight: '1px solid #e0e0e0', marginRight: 3 }}>
                  <span className="rb-ico">📋</span>
                  <span className="rb-lbl">Paste ▾</span>
                </button>
                <div className="rg-top col">
                  <button className="rb">✂ Cut</button>
                  <button className="rb">📄 Copy</button>
                  <button className="rb">🖌 Format</button>
                </div>
              </div>
              <div className="rg-lbl">클립보드</div>
            </div>

            <div className="rg rg-deco rg-d2">
              <div className="rg-top col">
                <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <select className="rsel wide"><option>맑은 고딕</option></select>
                  <select className="rsel sm"><option>12</option></select>
                </div>
                <div style={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <button className="rb bold sq" style={{ fontSize: 13 }}>B</button>
                  <button className="rb ital sq" style={{ fontSize: 12 }}>I</button>
                  <button className="rb undr sq" style={{ fontSize: 12 }}>U</button>
                  <span className="rg-sep" />
                  <button className="rb sq">A</button>
                  <button className="rb sq">▲</button>
                </div>
              </div>
              <div className="rg-lbl">글꼴</div>
            </div>

            <div className="rg rg-deco rg-d3">
              <div className="rg-top col">
                <div style={{ display: 'flex', gap: 1 }}>
                  <button className="rb sq">⊤</button>
                  <button className="rb sq">⊥</button>
                  <button className="rb sq">≡</button>
                  <span className="rg-sep" />
                  <button className="rb sq">↵</button>
                </div>
                <div style={{ display: 'flex', gap: 1 }}>
                  <button className="rb sq">⬛</button>
                  <button className="rb sq">⬜</button>
                  <button className="rb sq">▦</button>
                </div>
              </div>
              <div className="rg-lbl">맞춤</div>
            </div>

            <div className="rg rg-deco rg-d4">
              <div className="rg-top col">
                <select className="rsel mid"><option>일반</option></select>
                <div style={{ display: 'flex', gap: 1 }}>
                  <button className="rb sq">₩</button>
                  <button className="rb sq">%</button>
                  <button className="rb sq">,</button>
                  <button className="rb sq">.0</button>
                </div>
              </div>
              <div className="rg-lbl">표시 형식</div>
            </div>

            <div className="rg rg-deco rg-d5">
              <div className="rg-top col">
                <div className="sty-row">
                  <div className="sty-box sty-good">Good</div>
                  <div className="sty-box sty-bad">Bad</div>
                </div>
                <div className="sty-row">
                  <div className="sty-box sty-neutral">Neutral</div>
                  <div className="sty-box sty-calc">Calc</div>
                </div>
              </div>
              <div className="rg-lbl">스타일</div>
            </div>

            <div className="rg rg-deco rg-d6">
              <div className="rg-top col" style={{ justifyContent: 'center' }}>
                <button className="rb">삽입 ▾</button>
                <button className="rb">삭제 ▾</button>
                <button className="rb">서식 ▾</button>
              </div>
              <div className="rg-lbl">셀</div>
            </div>

            <div className="rg">
              <div className="rg-top" style={{ alignItems: 'center', gap: 3 }}>
                <button className="rb lg refresh">
                  <span className="ricon btn-icon">↻</span>
                  <span className="rlbl">Refresh All</span>
                </button>
              </div>
              <div className="rg-lbl">데이터</div>
            </div>
          </div>
        </div>
      </div>

      {children}

      {/* 시트 탭 */}
      <div className="xl-tabs">
        <button className="xl-newtab">+</button>
        {SHEET_TABS.map(tab => (
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
        <span>{statusText ?? '아파트명을 검색하세요'}</span>
        <div className="sr">
          {resultCount > 0 && <span>조회 결과: {resultCount}개 단지</span>}
        </div>
      </div>
    </div>
  )
}
