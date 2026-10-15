import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Clock, X, Tag, ShoppingBag } from 'lucide-react'
import { getSearchSuggestions, type SearchSuggestion } from '../../api/categories'
import './SearchBox.css'

const RECENT_KEY = 'moksha_recent_searches'
const MAX_RECENT = 8

function loadRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string').slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

function saveRecent(term: string) {
  const next = [term, ...loadRecent().filter((v) => v.toLowerCase() !== term.toLowerCase())].slice(0, MAX_RECENT)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable */
  }
}

interface Row {
  key: string
  kind: 'recent' | 'suggestion' | 'query'
  label: string
  url?: string
  suggestion?: SearchSuggestion
}

export default function SearchBox({ initialValue = '' }: { initialValue?: string }) {
  const navigate = useNavigate()
  const [value, setValue] = useState(initialValue)
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [recent, setRecent] = useState<string[]>(loadRecent)
  const [active, setActive] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => setValue(initialValue), [initialValue])

  useEffect(() => {
    const term = value.trim()
    if (term.length < 2) {
      setSuggestions([])
      return
    }
    let live = true
    const timer = window.setTimeout(() => {
      getSearchSuggestions(term)
        .then((res) => live && setSuggestions(res.suggestions || []))
        .catch(() => live && setSuggestions([]))
    }, 200)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [value])

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const term = value.trim()
  const rows: Row[] = term.length < 2
    ? recent.map((r) => ({ key: `r-${r}`, kind: 'recent' as const, label: r }))
    : [
        ...(term ? [{ key: 'q', kind: 'query' as const, label: term }] : []),
        ...suggestions.map((s, i) => ({ key: `s-${i}`, kind: 'suggestion' as const, label: s.label, url: s.url, suggestion: s })),
      ]

  const runSearch = (text: string) => {
    const q = text.trim()
    if (!q) return
    saveRecent(q)
    setRecent(loadRecent())
    setValue(q)
    setOpen(false)
    setActive(-1)
    navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  const choose = (row: Row) => {
    if (row.kind === 'suggestion' && row.url) {
      saveRecent(row.label)
      setRecent(loadRecent())
      setOpen(false)
      navigate(row.url)
    } else {
      runSearch(row.label)
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (active >= 0 && rows[active]) choose(rows[active])
    else runSearch(value)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((i) => (rows.length ? (i + 1) % rows.length : -1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => (rows.length ? (i <= 0 ? rows.length - 1 : i - 1) : -1))
    } else if (event.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    }
  }

  const clearRecent = () => {
    try {
      localStorage.removeItem(RECENT_KEY)
    } catch {
      /* ignore */
    }
    setRecent([])
  }

  const showList = open && rows.length > 0

  return (
    <div className="searchbox" ref={wrapRef}>
      <form className="searchbox-form" onSubmit={onSubmit} role="search">
        <Search size={18} aria-hidden="true" className="searchbox-icon" />
        <input
          type="search"
          value={value}
          autoComplete="off"
          placeholder="Search sarees, kurtis, jewellery or product code"
          aria-label="Search products"
          aria-expanded={showList}
          onChange={(e) => {
            setValue(e.target.value)
            setActive(-1)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {value && (
          <button type="button" className="searchbox-clear" aria-label="Clear search" onClick={() => { setValue(''); setOpen(true) }}>
            <X size={16} />
          </button>
        )}
        <button type="submit" className="btn btn-primary searchbox-submit">Search</button>
      </form>

      {showList && (
        <ul className="searchbox-list" role="listbox">
          {term.length < 2 && (
            <li className="searchbox-heading">
              <span>Recent searches</span>
              <button type="button" onClick={clearRecent}>Clear</button>
            </li>
          )}
          {rows.map((row, i) => (
            <li key={row.key} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={`searchbox-item ${i === active ? 'is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(row)}
              >
                {row.kind === 'recent' && <Clock size={16} aria-hidden="true" />}
                {row.kind === 'query' && <Search size={16} aria-hidden="true" />}
                {row.kind === 'suggestion' && (row.suggestion?.type === 'category' ? <Tag size={16} aria-hidden="true" /> : <ShoppingBag size={16} aria-hidden="true" />)}
                <span className="searchbox-label">
                  {row.kind === 'query' ? <>Search for <strong>“{row.label}”</strong></> : row.label}
                </span>
                {row.kind === 'suggestion' && (
                  <span className="searchbox-meta">
                    {row.suggestion?.type === 'category' ? 'Category' : row.suggestion?.price != null ? `BHD ${Number(row.suggestion.price).toFixed(3)}` : ''}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
