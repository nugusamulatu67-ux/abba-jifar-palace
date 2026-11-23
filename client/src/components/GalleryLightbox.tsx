import { useEffect, useRef } from 'react'
import type { GallerySlot } from '../content/publicSite.ts'
import { PhotoFrame } from './PhotoFrame.tsx'

export function GalleryLightbox({
  items,
  index,
  onClose,
  onIndex,
}: {
  items: GallerySlot[]
  index: number | null
  onClose: () => void
  onIndex: (index: number) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const item = index === null ? null : items[index]

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }
    if (item && !dialog.open) {
      dialog.showModal()
    }
    if (!item && dialog.open) {
      dialog.close()
    }
  }, [item])

  function step(direction: -1 | 1) {
    if (index === null) {
      return
    }
    const next = (index + direction + items.length) % items.length
    onIndex(next)
  }

  return (
    <dialog
      ref={dialogRef}
      className="lightbox"
      aria-label="Photograph preview"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onClose()
        }
      }}
    >
      {item && (
        <div className="lightbox-body">
          <PhotoFrame item={item} anchor={false} />
          <div className="lightbox-actions">
            <button type="button" onClick={() => step(-1)}>
              Previous
            </button>
            <button type="button" onClick={() => step(1)}>
              Next
            </button>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
