// src/App.tsx
import { useState } from 'react'
import bjdongData from './data/bjdong.json'
import type { BjdongEntry } from './types'
import { ExcelShell } from './components/ExcelShell'
import { SearchBar } from './components/SearchBar'
import { AptTable } from './components/AptTable'
import { RegionSearch } from './components/RegionSearch'
import { useAptSearch } from './hooks/useAptSearch'

const bjdong = bjdongData as BjdongEntry[]

export default function App() {
  const [activeTab, setActiveTab] = useState('home')
  const { results, loading, error, search, removeResult } = useAptSearch()

  return (
    <ExcelShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      resultCount={results.length}
      statusText={
        loading ? '데이터 조회중… (전체 기간 최초 조회는 20~40초 소요)' :
        error ? `오류: ${error}` :
        undefined
      }
    >
      {activeTab === 'home' && (
        <>
          <SearchBar bjdong={bjdong} onSearch={(dongCode, aptName) => search({ dongCode, aptName })} loading={loading} />
          <AptTable results={results} onRemove={removeResult} />
        </>
      )}
      {activeTab === 'region' && (
        <>
          <RegionSearch bjdong={bjdong} onSearch={(code, name) => { search({ dongCode: code, aptName: name }); setActiveTab('home') }} loading={loading} />
        </>
      )}
    </ExcelShell>
  )
}
