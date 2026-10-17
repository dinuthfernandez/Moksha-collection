import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const BRAND = 'Moksha Collections'
const SITE = 'https://www.mokshacollections.com'

const PAGES: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Indian Dresses, Sarees & Accessories Store in Bahrain | Moksha Collections',
    description:
      'Moksha Collections is an Indian clothing store in Manama, Bahrain. Shop kurtis, sarees, kaftans, frocks, set mundu, pavada, dupattas, bangles, earrings and more.',
  },
  '/clothing': {
    title: 'Indian Clothing in Bahrain - Kurti, Kaftan, Frock, Set Mundu | Moksha Collections',
    description: "Shop Indian women's and kids' clothing in Bahrain from Moksha Collections, Manama.",
  },
  '/saree': {
    title: 'Sarees & Set Sarees in Bahrain | Buy Indian Saree Online - Moksha Collections',
    description: 'Buy sarees and set sarees online in Bahrain from Moksha Collections, Manama.',
  },
  '/accessories': {
    title: 'Indian Accessories in Bahrain - Bangles, Earrings, Necklaces | Moksha Collections',
    description: 'Indian fashion accessories in Bahrain: bangles, earrings, studs, necklaces and bracelets.',
  },
  '/categories': {
    title: 'Shop by Category - Indian Clothing, Sarees & Accessories | Moksha Collections Bahrain',
    description: 'Browse every Moksha Collections category: clothing, sarees and accessories in Bahrain.',
  },
  '/size-charts': {
    title: 'Size Charts - Find Your Fit | Moksha Collections Bahrain',
    description: 'Size charts for kurtis, tops, frocks, kids wear and more at Moksha Collections, Bahrain.',
  },
  '/about-us': {
    title: 'About Us - Indian Fashion Boutique in Manama, Bahrain | Moksha Collections',
    description: 'Moksha Collections is a Manama-based Indian fashion boutique with a personal WhatsApp concierge.',
  },
  '/contact-us': {
    title: 'Contact Us - Moksha Collections, Manama, Bahrain',
    description: 'Visit Moksha Collections in Manama or message us on WhatsApp +973 3552 1619.',
  },
  '/policies': {
    title: 'Return, Exchange & Privacy Policies | Moksha Collections Bahrain',
    description: 'Return, exchange, refund and privacy policies for orders from Moksha Collections, Bahrain.',
  },
}

const NOINDEX = [
  '/cart', '/login', '/register', '/forgot-password', '/reset-password', '/account', '/addresses',
  '/wishlist', '/orders', '/checkout', '/delivery', '/search', '/mokshacollectionadminpanel', '/noonecanfindthisonlyfordinuth',
]

function setMeta(selector: string, attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}

export function applySeo(opts: { title: string; description?: string; path: string; noindex?: boolean }) {
  document.title = opts.title
  const url = `${SITE}${opts.path === '/' ? '/' : opts.path.replace(/\/$/, '')}`
  if (opts.description) {
    setMeta('meta[name="description"]', 'name', 'description', opts.description)
    setMeta('meta[property="og:description"]', 'property', 'og:description', opts.description)
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', opts.description)
  }
  setMeta('meta[property="og:title"]', 'property', 'og:title', opts.title)
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', opts.title)
  setMeta('meta[property="og:url"]', 'property', 'og:url', url)
  setMeta(
    'meta[name="robots"]',
    'name',
    'robots',
    opts.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1',
  )
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }
  canonical.href = url
}

/** Sets SEO tags for a dynamic page (category / product) once its data is known. */
export function useSeo(title: string | undefined, description?: string) {
  const { pathname } = useLocation()
  useEffect(() => {
    if (title) applySeo({ title, description, path: pathname })
  }, [title, description, pathname])
}

/** Keeps head tags correct on client-side navigation for static pages. Dynamic pages call useSeo. */
export default function RouteSeo() {
  const { pathname } = useLocation()
  useEffect(() => {
    const path = pathname.replace(/\/$/, '') || '/'
    if (NOINDEX.some((p) => path.startsWith(p))) {
      applySeo({ title: `${BRAND} - Bahrain`, path, noindex: true })
      return
    }
    const page = PAGES[path]
    if (page) applySeo({ ...page, path })
  }, [pathname])
  return null
}
