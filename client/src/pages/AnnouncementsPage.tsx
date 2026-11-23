import { PageIntro } from '../components/PageIntro.tsx'
import { usePageTitle } from '../components/usePageTitle.ts'
import { sampleAnnouncements } from '../content/publicSite.ts'

export function AnnouncementsPage() {
  usePageTitle('Announcements')

  return (
    <>
      <PageIntro
        eyebrow="Announcements"
        title="Notices"
        lede="A simple first version. The cards below are development samples, kept separate from anything the palace would publish."
      />
      <section className="band">
        <div className="wrap">
          <aside className="sample-banner" role="note">
            <p className="verify-label">Development sample</p>
            <p>
              These notices are written for this phase so the page can be reviewed. They are not loaded from the
              announcements table and they are not production content.
            </p>
          </aside>
          <div className="notice-list">
            {sampleAnnouncements.map((notice) => (
              <article key={notice.id} className="info-card">
                <p className="verify-label">{notice.dateLabel}</p>
                <h2>{notice.title}</h2>
                <p>{notice.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
