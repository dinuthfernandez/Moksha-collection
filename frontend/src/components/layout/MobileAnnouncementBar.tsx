import { useState } from 'react'
import './MobileAnnouncementBar.css'

interface MobileAnnouncementBarProps {
  messages: string[]
}

export default function MobileAnnouncementBar({ messages }: MobileAnnouncementBarProps) {
  const [index, setIndex] = useState(0)

  if (messages.length === 0) return null

  const handleAnimationEnd = () => {
    setIndex((current) => (current + 1) % messages.length)
  }

  return (
    <span className="announcement-mobile">
      <span key={`${index}-${messages[index]}`} className="announcement-mobile-text" onAnimationEnd={handleAnimationEnd}>
        {messages[index]}
      </span>
    </span>
  )
}
