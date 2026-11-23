import { Link } from 'react-router-dom'
import { PageIntro } from '../components/PageIntro.tsx'
import { usePageTitle } from '../components/usePageTitle.ts'
import { tourThemes } from '../content/publicSite.ts'

export function ToursPage() {
  usePageTitle('Tours')

  return (
    <>
      <PageIntro
        eyebrow="Tours"
        title="Tour themes"
        lede="A placeholder until the tour module is built. You can read the themes. You cannot choose a date or book a seat yet."
      />
      <section className="band">
        <div className="wrap">
          <div className="card-grid">
            {tourThemes.map((tour) => (
              <article key={tour.name} className="info-card">
                <h2>{tour.name}</h2>
                <p>{tour.description}</p>
                <p className="source">Stored for development. Price and schedule are not shown here.</p>
              </article>
            ))}
          </div>
          <p className="section-intro">
            <Link to="/register">Create a tourist account</Link> if you want to be ready when booking opens.
          </p>
        </div>
      </section>
    </>
  )
}
