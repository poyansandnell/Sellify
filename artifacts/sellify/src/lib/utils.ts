import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string | undefined | null, currency: string = "SEK", locale: string = "sv-SE") {
  if (amount === undefined || amount === null) return '';
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 0,
  }).format(Number(amount))
}

export function formatRelativeTime(dateString: string | undefined | null, locale: string = "sv-SE") {
  if (!dateString) return '';
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  
  if (diffInSeconds < 60) return rtf.format(-diffInSeconds, "second")
  
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return rtf.format(-diffInMinutes, "minute")
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return rtf.format(-diffInHours, "hour")
  
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 30) return rtf.format(-diffInDays, "day")
  
  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) return rtf.format(-diffInMonths, "month")
  
  const diffInYears = Math.floor(diffInDays / 365)
  return rtf.format(-diffInYears, "year")
}

export function joinApi(path: string | undefined | null) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('/objects/')) {
    return `${import.meta.env.BASE_URL}api/storage${path}`;
  }
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}
