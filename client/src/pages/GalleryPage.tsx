import { useState } from 'react'
import { GalleryLightbox } from '../components/GalleryLightbox.tsx'
import { PageIntro } from '../components/PageIntro.tsx'
import { PhotoFrame } from '../components/PhotoFrame.tsx'
import { usePageTitle } from '../components/usePageTitle.ts'
import { gallerySlots } from '../content/publicSite.ts'

export function GalleryPage() {
  usePageTitle('Gallery')
  const [index, setIndex] = useState<number | null>(null)

  return (
    <>
      <PageIntro
        eyebrow="Gallery"
        title="Palace photographs"
        lede="Frames are ready for authentic photographs of Abba Jifar Palace. None have been added to the project yet, so the frames stay empty rather than showing another place."
      />
      <section className="band">
        <div className="wrap">
          <div className="frame-grid">
            {gallerySlots.map((item, itemIndex) => (
              <PhotoFrame key={item.id} item={item} onOpen={() => setIndex(itemIndex)} />
            ))}
          </div>
        </div>
      </section>
      <GalleryLightbox
        items={gallerySlots}
        index={index}
        onClose={() => setIndex(null)}
        onIndex={setIndex}
      />
    </>
  )
}
