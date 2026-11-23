import { Link } from 'react-router-dom'
import { PageIntro } from '../components/PageIntro.tsx'
import { usePageTitle } from '../components/usePageTitle.ts'
import { visitKnown, visitUnverified } from '../content/publicSite.ts'

export function VisitPage() {
  usePageTitle('Visit information')

  return (
    <>
      <PageIntro
        eyebrow="Visit information"
        title="Planning a visit"
        lede="Only details that appear in the project documents are stated as fact. Hours, prices, and contact details are listed as not yet verified."
      />
      <section className="band">
        <div className="wrap split">
          <div>
            <h2>What is known</h2>
            <ul className="plain-list">
              {visitKnown.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>
              <Link to="/tours">Read the tour themes</Link>
            </p>
          </div>
          <div>
            <h2>Not yet verified</h2>
            <p>These items are omitted on purpose until the palace supplies them.</p>
            <ul className="plain-list">
              {visitUnverified.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <section className="band band-paper">
        <div className="wrap narrow-copy">
          <h2>Visitor guidelines</h2>
          <p>
            Palace rules for dress, photography, and group size are not in the project documents. They will be added
            here after they are confirmed. Until then, this page does not invent them.
          </p>
          <h2>Location</h2>
          <p>Jimma, Ethiopia. A street address has not been provided.</p>
          <h2>Contact</h2>
          <p>No telephone number or email address is recorded in the project documents.</p>
        </div>
      </section>
    </>
  )
}
