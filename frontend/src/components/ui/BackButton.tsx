import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import './BackButton.css'

interface BackButtonProps {
  fallbackTo: string
  fixedBelowHeader?: boolean
}

export default function BackButton({ fallbackTo, fixedBelowHeader = false }: BackButtonProps) {
  const navigate = useNavigate()

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate(fallbackTo)
  }

  return (
    <div className={`universal-back-wrap ${fixedBelowHeader ? 'is-fixed-below-header' : ''}`}>
      <button type="button" className="universal-back-button" onClick={goBack}>
        <ArrowLeft size={17} aria-hidden="true" />
        <span>Back</span>
      </button>
    </div>
  )
}
