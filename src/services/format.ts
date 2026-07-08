// --- Pure presentation helpers (no Vue / no persistence) ---

/** Compute initials for avatar (e.g. "Nguyễn Văn Hùng" -> "NVH"). */
export const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return ''
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  const first = parts[0][0] || ''
  const middle = parts[parts.length - 2]?.[0] || ''
  const last = parts[parts.length - 1]?.[0] || ''
  return (first + middle + last).toUpperCase()
}

const AVATAR_GRADIENTS = [
  'from-blue-600 to-indigo-750',
  'from-emerald-500 to-teal-600',
  'from-purple-600 to-pink-600',
  'from-amber-500 to-orange-605',
  'from-cyan-500 to-blue-600',
  'from-rose-500 to-pink-600',
]

/** Deterministic avatar gradient class derived from the name. */
export const getAvatarGradient = (name: string): string => {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const idx = Math.abs(hash) % AVATAR_GRADIENTS.length
  return AVATAR_GRADIENTS[idx]!
}

/** Format an ISO string as dd/mm/yyyy. */
export const formatDate = (isoString: string): string => {
  const d = new Date(isoString)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

/** Relative date for recent matches (e.g. "2 giờ trước", "Hôm qua"). */
export const formatRelativeDate = (isoString: string): string => {
  const d = new Date(isoString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - d.getTime())
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMins = Math.floor(diffTime / (1000 * 60))
      return diffMins <= 1 ? 'Vừa xong' : `${diffMins} phút trước`
    }
    return `${diffHours} giờ trước`
  }
  if (diffDays === 1) return 'Hôm qua'
  if (diffDays < 7) return `${diffDays} ngày trước`
  return formatDate(isoString)
}

/** Quarter label for a date string, e.g. "2026-Q3". */
export const getQuarter = (dateStr: string): string => {
  const d = new Date(dateStr)
  const q = Math.ceil((d.getMonth() + 1) / 3)
  return `${d.getFullYear()}-Q${q}`
}
