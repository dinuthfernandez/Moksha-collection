import './EmptyState.css'

interface EmptyStateProps {
  title: string
  message?: string
}

export default function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state-mark">•</span>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
    </div>
  )
}
