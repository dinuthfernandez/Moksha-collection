import { useEffect, useState } from 'react'
import { getAnnouncements } from '../../api/announcements'
import './AnnouncementBar.css'

const FALLBACK_MESSAGES = [
  'FREE SHIPPING OVER 20 BHD • SHOP NEW ARRIVALS',
  'EASY EXCHANGES • SECURE CHECKOUT • SHOP NOW',
  'DISCOVER MOKSHA COLLECTIONS • MANAMA, BAHRAIN',
]

export default function AnnouncementBar() {
  const [messages, setMessages] = useState<string[]>(FALLBACK_MESSAGES)
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    let mounted = true
    getAnnouncements()
      .then((data) => {
        if (mounted && data.length > 0) {
          setMessages(data.map((a) => a.message))
        }
      })
      .catch(() => {
        /* keep fallback messages if the API is unreachable */
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (messages.length < 2) return
    const rotate = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex((i) => (i + 1) % messages.length)
        setVisible(true)
      }, 350)
    }, 5000)
    return () => clearInterval(rotate)
  }, [messages])

  return (
    <div className="announcement-bar" role="status">
      <span className={`announcement-text ${visible ? 'is-visible' : ''}`}>{messages[index]}</span>
    </div>
  )
}
