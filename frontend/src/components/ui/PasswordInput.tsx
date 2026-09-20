import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import './PasswordInput.css'

interface PasswordInputProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  required?: boolean
}

export default function PasswordInput({ value, onChange, placeholder, required }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="password-input">
      <input
        type={visible ? 'text' : 'password'}
        required={required}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  )
}
