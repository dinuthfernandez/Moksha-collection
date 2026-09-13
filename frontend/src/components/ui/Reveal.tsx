import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  as?: ElementType
  className?: string
  delay?: number
}

// Fades/slides sections up into place the first time they enter the viewport.
export default function Reveal({ children, as: Tag = 'div', className = '', delay = 0 }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
    >
      {children}
    </Tag>
  )
}
