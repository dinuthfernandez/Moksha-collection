// Builds a wa.me deep link with a pre-filled message.
const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '97335521619'

export function buildWhatsAppLink(message: string, number: string = WHATSAPP_NUMBER) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}
