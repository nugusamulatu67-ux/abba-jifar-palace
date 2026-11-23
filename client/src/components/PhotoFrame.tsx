import { useState } from 'react'
import type { GallerySlot } from '../content/publicSite.ts'

export function PhotoFrame({
  item,
  onOpen,
  anchor = true,
}: {
  item: GallerySlot
  onOpen?: () => void
  anchor?: boolean
}) {
  const [broken, setBroken] = useState(false)
  const missing = item.src === null || broken

  const media = missing ? (
    <span className="frame-missing" role="img" aria-label={item.alt}>
      <span className="frame-mark" aria-hidden="true" />
      <span>Photograph not yet added</span>
    </span>
  ) : (
    <img
      src={item.src ?? undefined}
      alt={item.alt}
      width={800}
      height={600}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  )

  if (!onOpen) {
    return (
      <figure className="frame" id={anchor ? item.id : undefined}>
        {media}
        <figcaption>{item.caption}</figcaption>
      </figure>
    )
  }

  return (
    <figure className="frame" id={anchor ? item.id : undefined}>
      <button type="button" className="frame-open" onClick={onOpen}>
        {media}
        <span className="frame-open-label">Preview</span>
      </button>
      <figcaption>{item.caption}</figcaption>
    </figure>
  )
}
