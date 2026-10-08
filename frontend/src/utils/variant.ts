export function formatVariant(item: { size?: string | null; color?: string | null }): string {
  return [item.size, item.color].filter(Boolean).join(' · ')
}

export function withVariant(name: string, item: { size?: string | null; color?: string | null }): string {
  const variant = formatVariant(item)
  return variant ? `${name} (${variant})` : name
}
