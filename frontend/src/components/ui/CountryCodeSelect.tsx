import { useEffect, useMemo, useRef, useState } from 'react'
import { COUNTRIES } from '../../data/countries'
import './CountryCodeSelect.css'

interface CountryCodeSelectProps {
  value: string
  onChange: (dialCode: string) => void
}

export default function CountryCodeSelect({ value, onChange }: CountryCodeSelectProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COUNTRIES
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dialCode.includes(q) || c.code.toLowerCase().includes(q),
    )
  }, [query])

  const select = (dialCode: string) => {
    onChange(dialCode)
    setQuery('')
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const match = filtered[highlighted]
      if (match) select(match.dialCode)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div className="country-code-select" ref={rootRef} style={{ minWidth: 0 }}>
      <input
        type="text"
        aria-label="Country code"
        className="country-code-input"
        value={open ? query : value}
        placeholder={value}
        onFocus={() => {
          setOpen(true)
          setQuery('')
          setHighlighted(0)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setHighlighted(0)
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="country-code-dropdown" role="listbox">
          {filtered.length === 0 && <li className="country-code-empty">No matches</li>}
          {filtered.map((c, i) => (
            <li
              key={c.code}
              role="option"
              aria-selected={c.dialCode === value}
              className={`country-code-option ${i === highlighted ? 'is-highlighted' : ''} ${c.dialCode === value ? 'is-selected' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                select(c.dialCode)
              }}
              onMouseEnter={() => setHighlighted(i)}
            >
              <span className="country-code-option-code">{c.dialCode}</span>
              <span className="country-code-option-name">{c.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
