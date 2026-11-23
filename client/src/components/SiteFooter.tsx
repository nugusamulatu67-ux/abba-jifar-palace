import { Link } from 'react-router-dom'

const links = [
  { to: '/about', label: 'About' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/visit', label: 'Visit information' },
  { to: '/announcements', label: 'Announcements' },
  { to: '/tours', label: 'Tours' },
]

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div>
          <p className="footer-name">Abba Jifar Palace</p>
          <p>Historical heritage site · Jimma, Ethiopia</p>
        </div>
        <nav aria-label="Footer">
          {links.map((link) => (
            <Link key={link.to} to={link.to}>
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="footer-note">
          A telephone number, email address, and street address are not in the project documents, so they are not shown here.
        </p>
      </div>
    </footer>
  )
}
