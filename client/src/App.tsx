import type { ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout.tsx'
import { ProtectedRoute } from './components/ProtectedRoute.tsx'
import { AboutPage } from './pages/AboutPage.tsx'
import { AnnouncementsPage } from './pages/AnnouncementsPage.tsx'
import { AreaPage } from './pages/AreaPage.tsx'
import { GalleryPage } from './pages/GalleryPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { ProfilePage } from './pages/ProfilePage.tsx'
import { RegisterPage } from './pages/RegisterPage.tsx'
import { ToursPage } from './pages/ToursPage.tsx'
import { VisitPage } from './pages/VisitPage.tsx'

function Narrow({ children }: { children: ReactNode }) {
  return <div className="narrow">{children}</div>
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/visit" element={<VisitPage />} />
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/tours" element={<ToursPage />} />
        <Route
          path="/login"
          element={
            <Narrow>
              <LoginPage />
            </Narrow>
          }
        />
        <Route
          path="/register"
          element={
            <Narrow>
              <RegisterPage />
            </Narrow>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <Narrow>
                <ProfilePage />
              </Narrow>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Narrow>
                <AreaPage
                  eyebrow="Staff"
                  title="Administration"
                  intro="This area is reserved for the administrator. Tour, booking, and staff tools will be added in later phases."
                  endpoint="/api/admin/access"
                />
              </Narrow>
            </ProtectedRoute>
          }
        />
        <Route
          path="/guide"
          element={
            <ProtectedRoute>
              <Narrow>
                <AreaPage
                  eyebrow="Staff"
                  title="Assigned tours"
                  intro="Guides will see their assigned tours and the visitors on those tours in a later phase."
                  endpoint="/api/guide/access"
                />
              </Narrow>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reception"
          element={
            <ProtectedRoute>
              <Narrow>
                <AreaPage
                  eyebrow="Staff"
                  title="Reception"
                  intro="Reception will use this area to verify bookings and check visitors in."
                  endpoint="/api/reception/access"
                />
              </Narrow>
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={
            <Narrow>
              <h1>Page not found</h1>
              <p>That page is not part of the palace website.</p>
            </Narrow>
          }
        />
      </Routes>
    </Layout>
  )
}
