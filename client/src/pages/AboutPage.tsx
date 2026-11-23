import { PageIntro } from '../components/PageIntro.tsx'
import { usePageTitle } from '../components/usePageTitle.ts'
import { VerifyNote } from '../components/VerifyNote.tsx'
import { aboutPlaceholders, verifiedFacts } from '../content/publicSite.ts'

export function AboutPage() {
  usePageTitle('About the palace')

  return (
    <>
      <PageIntro
        eyebrow="About the palace"
        title="Abba Jifar Palace"
        lede="An introduction based on the project documents. Passages that still need the palace’s wording are marked."
      />
      <section className="band">
        <div className="wrap narrow-copy">
          <h2>Introduction</h2>
          <p>
            Abba Jifar Palace is the heritage site this website serves. It stands in Jimma, Ethiopia. The site is for
            visitors who want to understand the palace and, later, book a tour through the palace’s own pages.
          </p>
          <dl className="fact-list">
            {verifiedFacts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>
                  {fact.value}
                  <span className="source">Source: {fact.source}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      {aboutPlaceholders.map((section) => (
        <section key={section.id} className="band band-paper" id={section.id}>
          <div className="wrap narrow-copy">
            <h2>{section.title}</h2>
            <VerifyNote purpose={section.purpose} />
          </div>
        </section>
      ))}
    </>
  )
}
