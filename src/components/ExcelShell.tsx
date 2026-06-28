// src/components/ExcelShell.tsx
import { useEffect, type ReactNode } from 'react'

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
  onRefresh?: () => void
}

function toggleDarkMode() {
  const on = document.body.classList.toggle('dark')
  localStorage.setItem('darkMode', on ? '1' : '')
  const btn = document.getElementById('darkModeBtn')
  if (btn) {
    btn.querySelector('.btn-icon')!.textContent = on ? '☀' : '🌙'
    btn.querySelector('.btn-lbl')!.textContent = on ? ' 라이트' : ' 다크'
  }
}

function toggleAllBlack() {
  const on = document.body.classList.toggle('all-black')
  localStorage.setItem('allBlack', on ? '1' : '')
  const btn = document.getElementById('allBlackBtn')
  if (btn) btn.querySelector('.btn-lbl')!.textContent = on ? ' 컬러' : ' 올블랙'
}

export function ExcelShell({ activeTab, onTabChange, children, statusText, resultCount = 0, onRefresh }: Props) {
  useEffect(() => {
    if (localStorage.getItem('darkMode')) {
      document.body.classList.add('dark')
      const btn = document.getElementById('darkModeBtn')
      if (btn) {
        btn.querySelector('.btn-icon')!.textContent = '☀'
        btn.querySelector('.btn-lbl')!.textContent = ' 라이트'
      }
    }
    if (localStorage.getItem('allBlack')) {
      document.body.classList.add('all-black')
      const btn = document.getElementById('allBlackBtn')
      if (btn) btn.querySelector('.btn-lbl')!.textContent = ' 컬러'
    }
  }, [])

  return (
    <div className="xl">
      <div id="xlTopScroll">
        <div id="xlTopInner">

          {/* ── 타이틀바 ── */}
          <div className="xl-title">
            <div className="xl-logo" />
            <div className="xl-qat">
              <span className="xl-autosave-lbl">자동저장</span>
              <span className="xl-toggle" />
              <span className="xl-qat-sep" />
              <button className="xl-qat-btn" title="저장">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="1" width="12" height="12" rx="1.5" stroke="rgba(255,255,255,0.9)" strokeWidth="1.2"/>
                  <rect x="3.5" y="1" width="5" height="4" fill="rgba(255,255,255,0.9)" rx="0.5"/>
                  <rect x="2.5" y="7.5" width="9" height="4.5" rx="0.5" stroke="rgba(255,255,255,0.9)" strokeWidth="1.1" fill="none"/>
                </svg>
              </button>
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

          {/* ── 리본 탭 ── */}
          <div className="xl-rtabs">
            <button className="xl-filebtn">파일</button>
            {['홈','삽입','그리기','페이지 레이아웃','수식','데이터','검토','보기','자동화','도움말'].map((t,i) => (
              <span key={t} className={`xl-rtab${i === 0 ? ' on' : ''}`}>{t}</span>
            ))}
            <div className="xl-rtabs-right">
              <button className="xl-rtab-ico" title="리본 축소">∧</button>
            </div>
          </div>

          {/* ── 리본 콘텐츠 ── */}
          <div className="xl-ribbon">

            {/* 클립보드 */}
            <div className="rg rg-deco rg-d1">
              <div className="rg-top">
                <button className="rb lg" style={{padding:'3px 10px',borderRight:'1px solid #e0e0e0',marginRight:3}}>
                  <span className="rb-ico" style={{fontSize:22}}>📋</span>
                  <span className="rb-lbl">붙여넣기 ▾</span>
                </button>
                <div className="rg-top col">
                  <button className="rb">✂ 잘라내기</button>
                  <button className="rb">📄 복사 ▾</button>
                  <button className="rb">🖌 서식 복사</button>
                </div>
              </div>
              <div className="rg-lbl">클립보드</div>
            </div>

            {/* 글꼴 */}
            <div className="rg rg-deco rg-d2">
              <div className="rg-top col">
                <div style={{display:'flex',gap:2,alignItems:'center'}}>
                  <select className="rsel wide"><option>맑은 고딕</option></select>
                  <select className="rsel sm"><option>12</option></select>
                  <button className="rb sq" style={{fontSize:11}}>A+</button>
                  <button className="rb sq" style={{fontSize:11}}>A-</button>
                </div>
                <div style={{display:'flex',gap:1,alignItems:'center'}}>
                  <button className="rb bold sq" style={{fontSize:13}}>B</button>
                  <button className="rb ital sq" style={{fontSize:12}}>I</button>
                  <button className="rb undr sq" style={{fontSize:12,textDecoration:'underline'}}>U</button>
                  <button className="rb sq" style={{fontSize:12,textDecoration:'line-through'}}>S</button>
                  <span className="rg-sep"/>
                  <button className="rb sq" style={{fontSize:11,color:'#c00'}}>A</button>
                  <button className="rb sq" style={{fontSize:11}}>A</button>
                </div>
              </div>
              <div className="rg-lbl">글꼴</div>
            </div>

            {/* 맞춤 */}
            <div className="rg rg-deco rg-d3">
              <div className="rg-top col">
                <div style={{display:'flex',gap:1}}>
                  <button className="rb sq">⊤</button>
                  <button className="rb sq">⊟</button>
                  <button className="rb sq">⊥</button>
                  <span className="rg-sep"/>
                  <button className="rb sq" style={{fontSize:9}}>↵줄</button>
                </div>
                <div style={{display:'flex',gap:1}}>
                  <button className="rb sq">≡</button>
                  <button className="rb sq">⬜</button>
                  <button className="rb sq">▦</button>
                  <span className="rg-sep"/>
                  <button className="rb" style={{fontSize:9,whiteSpace:'nowrap'}}>병합하고<br/>가운데 맞춤 ▾</button>
                </div>
              </div>
              <div className="rg-lbl">맞춤</div>
            </div>

            {/* 표시 형식 */}
            <div className="rg rg-deco rg-d4">
              <div className="rg-top col">
                <select className="rsel mid"><option>일반</option></select>
                <div style={{display:'flex',gap:1}}>
                  <button className="rb sq" style={{fontSize:11}}>₩</button>
                  <button className="rb sq" style={{fontSize:11}}>%</button>
                  <button className="rb sq" style={{fontSize:11}}>,</button>
                  <button className="rb sq" style={{fontSize:10}}>.0→</button>
                  <button className="rb sq" style={{fontSize:10}}>←.0</button>
                </div>
              </div>
              <div className="rg-lbl">표시 형식</div>
            </div>

            {/* 스타일 */}
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

            {/* 셀 */}
            <div className="rg rg-deco rg-d6">
              <div className="rg-top col" style={{justifyContent:'center'}}>
                <button className="rb">삽입 ▾</button>
                <button className="rb">삭제 ▾</button>
                <button className="rb">서식 ▾</button>
              </div>
              <div className="rg-lbl">셀</div>
            </div>

            {/* 데이터 새로고침 + 다크/올블랙 */}
            <div className="rg">
              <div className="rg-top" style={{alignItems:'center',gap:3}}>
                <button
                  id="refreshBtn"
                  className="rb lg refresh"
                  onClick={onRefresh}
                >
                  <span className="ricon btn-icon" style={{fontSize:22}}>↻</span>
                  <span className="rlbl">새로고침</span>
                </button>
                <div style={{display:'flex',flexDirection:'column',gap:2,height:68,justifyContent:'center'}}>
                  <button
                    id="darkModeBtn"
                    className="rb"
                    style={{fontSize:10,padding:'2px 8px',height:20,gap:3}}
                    onClick={toggleDarkMode}
                  >
                    <span className="btn-icon" style={{fontSize:15,lineHeight:1}}>🌙</span>
                    <span className="btn-lbl"> 다크</span>
                  </button>
                  <button
                    id="allBlackBtn"
                    className="rb"
                    style={{fontSize:10,padding:'2px 8px',height:20,gap:3}}
                    onClick={toggleAllBlack}
                  >
                    <span className="btn-icon" style={{fontSize:15,lineHeight:1}}>🖌</span>
                    <span className="btn-lbl"> 올블랙</span>
                  </button>
                </div>
              </div>
              <div className="rg-lbl">데이터</div>
            </div>

          </div>
        </div>
      </div>

      {/* 수식 입력줄 + 시트 내용 */}
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
        <span>{statusText ?? '준비'}</span>
        <div className="sr">
          {resultCount > 0 && <span>{resultCount}개 단지 조회됨</span>}
        </div>
      </div>
    </div>
  )
}
