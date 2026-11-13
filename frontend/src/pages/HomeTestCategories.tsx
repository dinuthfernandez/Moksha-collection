import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getCategoryTree } from '../api/categories'
import PlaceholderImage from '../components/ui/PlaceholderImage'
import type { Category, CategoryType } from '../types'

const PAGE_SIZE = 3

export default function HomeTestCategories({ type, title }: { type: CategoryType; title: string }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [page, setPage] = useState(0)
  const [focused, setFocused] = useState(false)
  const pageCount = Math.ceil(categories.length / PAGE_SIZE)

  useEffect(() => {
    let active = true
    setStatus('loading')
    getCategoryTree(type)
      .then((data) => {
        if (!active) return
        setCategories(data)
        setPage(0)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        console.error(`Unable to load ${type} categories`, error)
        if (active) setStatus('error')
      })
    return () => { active = false }
  }, [type, attempt])

  useEffect(() => {
    if (focused || pageCount <= 1) return
    const timer = window.setTimeout(() => setPage((current) => (current + 1) % pageCount), 3500)
    return () => window.clearTimeout(timer)
  }, [page, pageCount, focused])

  const move = (offset: number) => setPage((current) => (current + offset + pageCount) % pageCount)

  return (
    <div
      className="test-category-carousel"
      aria-label={`${title} categories`}
      onPointerDown={() => setFocused(false)}
      onFocus={(event) => setFocused(event.target.matches(':focus-visible'))}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}
    >
      {status === 'loading' && <p className="test-category-message" role="status">Loading categories...</p>}
      {status === 'error' && (
        <div className="test-category-message" role="alert">
          <p>Could not load {title.toLowerCase()} categories.</p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
        </div>
      )}
      {status === 'ready' && categories.length === 0 && <p className="test-category-message">No categories available yet.</p>}
      {status === 'ready' && categories.length > 0 && (
        <>
          <div className="test-arrival-photos" key={page}>
            {categories.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((category) => (
              <Link className="test-arrival-photo" key={category.id} to={`/${type}/${category.slug}`}>
                <PlaceholderImage src={category.image_url} alt="" className="test-category-image" />
                <span>{category.name}</span>
              </Link>
            ))}
          </div>
          {pageCount > 1 && (
            <div className="test-category-controls">
              <button type="button" aria-label={`Previous ${title} categories`} onClick={() => move(-1)}><ChevronLeft size={18} /></button>
              <span>{page + 1} / {pageCount}</span>
              <button type="button" aria-label={`Next ${title} categories`} onClick={() => move(1)}><ChevronRight size={18} /></button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
