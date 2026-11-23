import { useEffect } from 'react'

export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title === 'Home' ? 'Abba Jifar Palace' : `${title} · Abba Jifar Palace`
  }, [title])
}
