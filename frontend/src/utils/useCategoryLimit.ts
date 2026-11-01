import { useEffect, useState } from 'react'

const LAPTOP_QUERY = '(min-width: 1024px)'

// Categories shown before "View more": 6 on mobile/tablet, 8 on laptop.
export function useCategoryLimit() {
  const [isLaptop, setIsLaptop] = useState(() => typeof window !== 'undefined' && window.matchMedia(LAPTOP_QUERY).matches)

  useEffect(() => {
    const media = window.matchMedia(LAPTOP_QUERY)
    const update = () => setIsLaptop(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return isLaptop ? 8 : 6
}
