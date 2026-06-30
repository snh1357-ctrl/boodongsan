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
  stockFilter?: 'all' | 'US' | 'KR'
  onStockFilterChange?: (f: 'all' | 'US' | 'KR') => void
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

export function ExcelShell({ activeTab, onTabChange, children, statusText, resultCount = 0, onRefresh, stockFilter, onStockFilterChange }: Props) {
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
              <button className="xl-qat-btn dim">↩</button>
              <button className="xl-qat-btn dim">↪</button>
            </div>
            <span className="xl-title-text">{activeTab === 'stock' ? 'ATH 트래커.xlsx — 주식' : '아파트 실거래가.xlsx — 부동산'}</span>
            <div className="xl-search">
              <span className="xl-search-ico">🔍</span>
              <input className="xl-search-inp" type="text" placeholder="검색 (Alt+Q)" readOnly />
            </div>
            <div className="xl-title-right">
              <div className="xl-avatar" title="계정">부</div>
              <button className="xl-cr-btn" title="알림" style={{padding:'0 6px'}}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5C7 1.5 4 3.5 4 7v3l-1.5 1.5h9L10 10V7C10 3.5 7 1.5 7 1.5Z" stroke="rgba(255,255,255,0.9)" strokeWidth="1.2" fill="none"/><line x1="7" y1="12.5" x2="7" y2="14" stroke="rgba(255,255,255,0.9)" strokeWidth="1.2"/></svg>
              </button>
              <button className="xl-cr-btn" id="commentsBtn" title="요청">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="9" rx="2" stroke="rgba(255,255,255,0.9)" strokeWidth="1.2"/><line x1="3" y1="4.5" x2="11" y2="4.5" stroke="rgba(255,255,255,0.9)" strokeWidth="1"/><line x1="3" y1="7" x2="8" y2="7" stroke="rgba(255,255,255,0.9)" strokeWidth="1"/><path d="M3 10 L5 13 L7 10" fill="rgba(255,255,255,0.9)"/></svg>
                <span>요청</span>
              </button>
              <button className="xl-cr-btn share-btn">공유</button>
              <button className="xl-cr-btn ribbon-tog" title="리본 표시 옵션" style={{padding:'0 6px'}}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="2.5" rx="0.5" fill="rgba(255,255,255,0.9)"/><rect x="1" y="5.75" width="12" height="2.5" rx="0.5" fill="rgba(255,255,255,0.9)"/><rect x="1" y="10.5" width="12" height="2.5" rx="0.5" fill="rgba(255,255,255,0.9)"/></svg>
              </button>
              <div className="xl-win">
                <button className="xl-win-btn">─</button>
                <button className="xl-win-btn">
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="1" y="3" width="7" height="7" rx="0.5" stroke="rgba(255,255,255,0.9)" strokeWidth="1.2"/><polyline points="3,3 3,1 10,1 10,8 8,8" stroke="rgba(255,255,255,0.9)" strokeWidth="1.2" fill="none"/></svg>
                </button>
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
                  <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                    <rect x="6" y="7" width="15" height="17" rx="1.5" fill="#fff" stroke="#888" strokeWidth="1.3"/>
                    <rect x="9" y="4" width="8" height="5" rx="1" fill="#e8e8e8" stroke="#888" strokeWidth="1.3"/>
                    <line x1="9" y1="13" x2="18" y2="13" stroke="#aaa" strokeWidth="1.1"/>
                    <line x1="9" y1="16" x2="18" y2="16" stroke="#aaa" strokeWidth="1.1"/>
                    <line x1="9" y1="19" x2="14" y2="19" stroke="#aaa" strokeWidth="1.1"/>
                  </svg>
                  <span className="rb-lbl">붙여넣기 ▾</span>
                </button>
                <div style={{display:'flex',flexDirection:'column',gap:3,justifyContent:'center'}}>
                  <button className="rb" style={{gap:5}}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="3.5" cy="10.5" r="2" stroke="#555" strokeWidth="1.2"/><circle cx="10.5" cy="10.5" r="2" stroke="#555" strokeWidth="1.2"/><line x1="3.5" y1="8.5" x2="7.5" y2="2" stroke="#555" strokeWidth="1.2"/><line x1="10.5" y1="8.5" x2="6.5" y2="2" stroke="#555" strokeWidth="1.2"/></svg>
                    잘라내기
                  </button>
                  <button className="rb" style={{gap:5}}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="4" width="8" height="9" rx="1" fill="#fff" stroke="#555" strokeWidth="1.2"/><rect x="5" y="1" width="8" height="9" rx="1" fill="#fff" stroke="#555" strokeWidth="1.2"/></svg>
                    복사 ▾
                  </button>
                  <button className="rb" style={{gap:5}}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="0.5" fill="#ffe066" stroke="#aaa" strokeWidth="0.8"/><line x1="3.5" y1="6" x2="3.5" y2="13" stroke="#555" strokeWidth="1.2"/><path d="M2 9 Q3.5 11 5 9" stroke="#555" strokeWidth="1" fill="none"/></svg>
                    서식 복사
                  </button>
                </div>
              </div>
              <div className="rg-lbl">클립보드</div>
            </div>

            {/* 글꼴 */}
            <div className="rg rg-deco rg-d2">
              <div className="rg-top col">
                <div style={{display:'flex',gap:2,alignItems:'center'}}>
                  <select className="rsel wide"><option>Calibri</option><option>맑은 고딕</option><option>Arial</option></select>
                  <div className="rg-sep"/>
                  <select className="rsel sm"><option>8</option><option>9</option><option>10</option><option>11</option><option selected>12</option><option>13</option><option>14</option><option>16</option><option>18</option></select>
                  <button className="rb" style={{padding:'0 3px',fontSize:10,height:22}}><b>A</b><sup style={{fontSize:8}}>+</sup></button>
                  <button className="rb" style={{padding:'0 3px',fontSize:10,height:22}}><b>A</b><sup style={{fontSize:8}}>−</sup></button>
                </div>
                <div style={{display:'flex',gap:1,alignItems:'center'}}>
                  <button className="rb bold sq" style={{fontSize:13}}>B</button>
                  <button className="rb ital sq" style={{fontSize:12,fontFamily:'Georgia,serif'}}>I</button>
                  <button className="rb undr sq" style={{borderBottom:'2px solid #333'}}>U</button>
                  <button className="rb sq" style={{textDecoration:'line-through',fontSize:11}}>S</button>
                  <div className="rg-sep"/>
                  <button className="rb" style={{padding:'0 4px',height:22}}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="1" width="11" height="11" stroke="#555" strokeWidth="1.2"/><line x1="1" y1="6.5" x2="12" y2="6.5" stroke="#555" strokeWidth="1.2"/><line x1="6.5" y1="1" x2="6.5" y2="12" stroke="#555" strokeWidth="1.2"/></svg>▾
                  </button>
                  <button className="rb" style={{padding:'0 4px',height:22,flexDirection:'column',gap:1}}>
                    <span style={{fontSize:11,lineHeight:1}}>A</span>
                    <span style={{height:3,width:12,background:'#ffd966',display:'block'}}/>
                    <span style={{fontSize:8}}>▾</span>
                  </button>
                  <button className="rb" style={{padding:'0 4px',height:22,flexDirection:'column',gap:1}}>
                    <span style={{fontSize:11,lineHeight:1,color:'#c00'}}>A</span>
                    <span style={{height:3,width:12,background:'#c00',display:'block'}}/>
                    <span style={{fontSize:8}}>▾</span>
                  </button>
                </div>
              </div>
              <div className="rg-lbl">글꼴</div>
            </div>

            {/* 맞춤 */}
            <div className="rg rg-deco rg-d3">
              <div className="rg-top col">
                <div style={{display:'flex',gap:1,alignItems:'center'}}>
                  <button className="rb sq" title="위쪽 맞춤"><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><line x1="1" y1="2" x2="12" y2="2" stroke="#555" strokeWidth="1.4"/><line x1="4" y1="4" x2="4" y2="12" stroke="#555" strokeWidth="1.2"/><line x1="9" y1="4" x2="9" y2="12" stroke="#555" strokeWidth="1.2"/><line x1="4" y1="8" x2="9" y2="8" stroke="#555" strokeWidth="1.2"/></svg></button>
                  <button className="rb sq" title="가운데 맞춤"><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><line x1="1" y1="6.5" x2="12" y2="6.5" stroke="#555" strokeWidth="1.4"/><line x1="4" y1="1" x2="4" y2="12" stroke="#555" strokeWidth="1.2"/><line x1="9" y1="1" x2="9" y2="12" stroke="#555" strokeWidth="1.2"/></svg></button>
                  <button className="rb sq" title="아래쪽 맞춤"><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><line x1="1" y1="11" x2="12" y2="11" stroke="#555" strokeWidth="1.4"/><line x1="4" y1="1" x2="4" y2="9" stroke="#555" strokeWidth="1.2"/><line x1="9" y1="1" x2="9" y2="9" stroke="#555" strokeWidth="1.2"/><line x1="4" y1="5" x2="9" y2="5" stroke="#555" strokeWidth="1.2"/></svg></button>
                  <div className="rg-sep"/>
                  <button className="rb sq" title="방향"><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><line x1="2" y1="11" x2="11" y2="2" stroke="#555" strokeWidth="1.3"/><polyline points="8,2 11,2 11,5" stroke="#555" strokeWidth="1.2" fill="none"/></svg></button>
                  <button className="rb" style={{fontSize:10.5}} title="자동 줄 바꿈">자동 줄 바꿈</button>
                </div>
                <div style={{display:'flex',gap:1,alignItems:'center'}}>
                  <button className="rb sq" title="왼쪽 맞춤"><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><line x1="1" y1="3" x2="9" y2="3" stroke="#555" strokeWidth="1.2"/><line x1="1" y1="6.5" x2="12" y2="6.5" stroke="#555" strokeWidth="1.2"/><line x1="1" y1="10" x2="7" y2="10" stroke="#555" strokeWidth="1.2"/></svg></button>
                  <button className="rb sq" title="가운데"><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><line x1="2" y1="3" x2="11" y2="3" stroke="#555" strokeWidth="1.2"/><line x1="1" y1="6.5" x2="12" y2="6.5" stroke="#555" strokeWidth="1.2"/><line x1="3" y1="10" x2="10" y2="10" stroke="#555" strokeWidth="1.2"/></svg></button>
                  <button className="rb sq" title="오른쪽 맞춤"><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><line x1="4" y1="3" x2="12" y2="3" stroke="#555" strokeWidth="1.2"/><line x1="1" y1="6.5" x2="12" y2="6.5" stroke="#555" strokeWidth="1.2"/><line x1="6" y1="10" x2="12" y2="10" stroke="#555" strokeWidth="1.2"/></svg></button>
                  <div className="rg-sep"/>
                  <button className="rb sq" title="들여쓰기 줄이기"><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><line x1="1" y1="3" x2="12" y2="3" stroke="#555" strokeWidth="1.2"/><line x1="5" y1="6.5" x2="12" y2="6.5" stroke="#555" strokeWidth="1.2"/><line x1="1" y1="10" x2="12" y2="10" stroke="#555" strokeWidth="1.2"/><polyline points="4,5 1,6.5 4,8" stroke="#555" strokeWidth="1.1" fill="none"/></svg></button>
                  <button className="rb sq" title="들여쓰기 늘리기"><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><line x1="1" y1="3" x2="12" y2="3" stroke="#555" strokeWidth="1.2"/><line x1="5" y1="6.5" x2="12" y2="6.5" stroke="#555" strokeWidth="1.2"/><line x1="1" y1="10" x2="12" y2="10" stroke="#555" strokeWidth="1.2"/><polyline points="1,5 4,6.5 1,8" stroke="#555" strokeWidth="1.1" fill="none"/></svg></button>
                  <button className="rb" style={{fontSize:10.5}}>병합하고 가운데 맞춤 ▾</button>
                </div>
              </div>
              <div className="rg-lbl">맞춤</div>
            </div>

            {/* 표시 형식 */}
            <div className="rg rg-deco rg-d4">
              <div className="rg-top col">
                <select className="rsel" style={{width:104}}><option>General</option><option>숫자</option><option>통화</option><option>날짜</option><option>백분율</option><option>텍스트</option></select>
                <div style={{display:'flex',gap:1,alignItems:'center',marginTop:1}}>
                  <button className="rb sq" title="회계 표시 형식">$ ▾</button>
                  <button className="rb sq" title="백분율 스타일">%</button>
                  <button className="rb sq" title="쉼표 스타일">,</button>
                  <div className="rg-sep"/>
                  <button className="rb sq" title="소수 자릿수 늘리기">.0→</button>
                  <button className="rb sq" title="소수 자릿수 줄이기">←.0</button>
                </div>
              </div>
              <div className="rg-lbl">표시 형식</div>
            </div>

            {/* 스타일 */}
            <div className="rg rg-deco rg-d5">
              <div className="rg-top col" style={{gap:3}}>
                <div className="sty-row">
                  <div className="sty-box sty-normal">표준</div>
                  <div className="sty-box sty-bad">나쁨</div>
                  <div className="sty-box sty-good">좋음</div>
                  <div className="sty-box sty-neutral">보통</div>
                  <div className="sty-box sty-calc">계산</div>
                  <button className="rb sq" style={{fontSize:10,width:18}}>▾</button>
                </div>
                <div style={{display:'flex',gap:2}}>
                  <button className="rb" style={{fontSize:10.5}}>조건부 서식 ▾</button>
                  <button className="rb" style={{fontSize:10.5}}>표 서식 ▾</button>
                  <button className="rb" style={{fontSize:10.5}}>셀 스타일 ▾</button>
                </div>
              </div>
              <div className="rg-lbl">스타일</div>
            </div>

            {/* 셀 */}
            <div className="rg rg-deco rg-d6">
              <div className="rg-top col" style={{gap:2,justifyContent:'center'}}>
                <button className="rb" style={{height:18,fontSize:10.5}}>삽입 ▾</button>
                <button className="rb" style={{height:18,fontSize:10.5}}>삭제 ▾</button>
                <button className="rb" style={{height:18,fontSize:10.5}}>서식 ▾</button>
              </div>
              <div className="rg-lbl">셀</div>
            </div>

            {/* 편집 */}
            <div className="rg rg-deco rg-d7">
              <div className="rg-top col" style={{gap:2,justifyContent:'center'}}>
                <div style={{display:'flex',gap:1}}>
                  <button className="rb" style={{fontSize:11}}>Σ 자동 합계 ▾</button>
                </div>
                <div style={{display:'flex',gap:1}}>
                  <button className="rb" style={{fontSize:10.5}}>채우기 ▾</button>
                  <button className="rb" style={{fontSize:10.5}}>지우기 ▾</button>
                </div>
                <div style={{display:'flex',gap:1}}>
                  <button className="rb" style={{fontSize:10.5}}>정렬 및 필터 ▾</button>
                  <button className="rb" style={{fontSize:10.5}}>찾기 및 선택 ▾</button>
                </div>
              </div>
              <div className="rg-lbl">편집</div>
            </div>

            {/* Data — 새로고침 + 다크/올블랙/언어 */}
            <div className="rg">
              <div className="rg-top" style={{alignItems:'center',gap:3}}>
                <button id="refreshBtn" className="rb lg refresh" onClick={onRefresh}>
                  <span className="ricon" style={{fontSize:22}}>↻</span>
                  <span className="rlbl">새로고침</span>
                </button>
                <div style={{display:'flex',flexDirection:'column',gap:2,height:68,justifyContent:'center'}}>
                  <button id="darkModeBtn" className="rb" style={{fontSize:10,padding:'2px 8px',height:20,gap:3}} onClick={toggleDarkMode}>
                    <span className="btn-icon" style={{fontSize:15,lineHeight:1}}>🌙</span>
                    <span className="btn-lbl"> 다크</span>
                  </button>
                  <button id="allBlackBtn" className="rb" style={{fontSize:10,padding:'2px 8px',height:20,gap:3}} onClick={toggleAllBlack}>
                    <span className="btn-icon" style={{fontSize:15,lineHeight:1}}>🖌</span>
                    <span className="btn-lbl"> 올블랙</span>
                  </button>
                  <button className="rb" style={{fontSize:10,padding:'2px 8px',height:20,gap:3}}>
                    <span className="btn-icon" style={{display:'inline-flex',alignItems:'center',verticalAlign:'middle'}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    </span>
                    <span> English</span>
                  </button>
                </div>
              </div>
              <div className="rg-lbl">Data</div>
            </div>

            {/* 필터 — 탭에 따라 다르게 */}
            <div className="rg">
              <div className="rg-top" style={{alignItems:'center',gap:3}}>
                <div style={{display:'flex',flexDirection:'column',gap:2,height:68,justifyContent:'center'}}>
                  {activeTab === 'stock' && onStockFilterChange ? (
                    <>
                      <button className={`rb${stockFilter === 'all' ? ' rb-active' : ''}`} style={{fontSize:10,padding:'2px 10px',height:20,gap:4}} onClick={() => onStockFilterChange('all')}>
                        <span className="mkt-badge all">ALL</span><span>전체</span>
                      </button>
                      <button className={`rb${stockFilter === 'US' ? ' rb-active' : ''}`} style={{fontSize:10,padding:'2px 10px',height:20,gap:4}} onClick={() => onStockFilterChange('US')}>
                        <span className="mkt-badge us">US</span><span>미국</span>
                      </button>
                      <button className={`rb${stockFilter === 'KR' ? ' rb-active' : ''}`} style={{fontSize:10,padding:'2px 10px',height:20,gap:4}} onClick={() => onStockFilterChange('KR')}>
                        <span className="mkt-badge kr">KR</span><span>한국</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="rb rb-active" style={{fontSize:10,padding:'2px 10px',height:20,gap:4}}>
                        <span className="mkt-badge all">ALL</span><span>전체</span>
                      </button>
                      <button className="rb" style={{fontSize:10,padding:'2px 10px',height:20,gap:4}}>
                        <span className="mkt-badge us">수도</span><span>수도권</span>
                      </button>
                      <button className="rb" style={{fontSize:10,padding:'2px 10px',height:20,gap:4}}>
                        <span className="mkt-badge kr">지방</span><span>지방</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="rg-lbl">필터</div>
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
          <div key={tab.id} className={`xl-tab${activeTab === tab.id ? ' on' : ''}`} onClick={() => onTabChange(tab.id)}>
            {tab.label}
          </div>
        ))}
      </div>

      {/* 상태바 */}
      <div className="xl-status">
        <span>{statusText ?? '준비'}</span>
        <div className="sr">
          {resultCount > 0 && <span>{activeTab === 'stock' ? `${resultCount} stocks` : `${resultCount}개 단지 조회됨`}</span>}
        </div>
      </div>
    </div>
  )
}
