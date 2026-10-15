type VariantLike = { size?: string | null; kids_size?: string | null; color?: string | null }

// Kids items carry an age range (e.g. "2-3") in kids_size; show it instead of the bare "Kids".
export function formatSize(item: VariantLike): string | null {
  return item.kids_size ? `Kids ${item.kids_size} Yrs` : item.size ?? null
}

export function formatVariant(item: VariantLike): string {
  return [formatSize(item), item.color].filter(Boolean).join(' · ')
}

export function withVariant(name: string, item: VariantLike): string {
  const variant = formatVariant(item)
  return variant ? `${name} (${variant})` : name
}
