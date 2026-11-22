import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout.tsx'
import { ProtectedRoute } from './components/ProtectedRoute.tsx'
import { AreaPage } from './pages/AreaPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { ProfilePage } from './pages/ProfilePage.tsx'
import { RegisterPage } from './pages/RegisterPage.tsx'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AreaPage
                eyebrow="Staff"
                title="Administration"
                intro="This area is reserved for the administrator. Tour, booking, and staff tools will be added in later phases."
                endpoint="/api/admin/access"
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/guide"
          element={
            <ProtectedRoute>
              <AreaPage
                eyebrow="Staff"
                title="Assigned tours"
                intro="Guides will see their assigned tours and the visitors on those tours in a later phase."
                endpoint="/api/guide/access"
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reception"
          element={
            <ProtectedRoute>
              <AreaPage
                eyebrow="Staff"
                title="Reception"
                intro="Reception will use this area to verify bookings and check visitors in."
                endpoint="/api/reception/access"
              />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<h1>Page not found</h1>} />
      </Routes>
    </Layout>
  )
}
