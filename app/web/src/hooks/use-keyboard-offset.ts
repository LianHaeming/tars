import { useEffect, useState } from 'react'

export function useKeyboardOffset() {
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const place = () => setOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    vv.addEventListener('resize', place)
    vv.addEventListener('scroll', place)
    return () => { vv.removeEventListener('resize', place); vv.removeEventListener('scroll', place) }
  }, [])
  return offset
}
