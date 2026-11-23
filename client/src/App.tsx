import type { ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout.tsx'
import { ProtectedRoute } from './components/ProtectedRoute.tsx'
import { AboutPage } from './pages/AboutPage.tsx'
import { AnnouncementsPage } from './pages/AnnouncementsPage.tsx'
import { AreaPage } from './pages/AreaPage.tsx'
import { BookingPage } from './pages/BookingPage.tsx'
import { BookingDetailPage, MyBookingsPage } from './pages/BookingPages.tsx'
import { GalleryPage } from './pages/GalleryPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { ProfilePage } from './pages/ProfilePage.tsx'
import { ReceptionPaymentPage } from './pages/ReceptionPaymentPage.tsx'
import { RegisterPage } from './pages/RegisterPage.tsx'
import { TicketVerifyPage } from './pages/TicketVerifyPage.tsx'
import { TourDetailPage } from './pages/TourDetailPage.tsx'
import { ToursPage } from './pages/ToursPage.tsx'
import { VisitPage } from './pages/VisitPage.tsx'
import { AdminHubPage } from './pages/admin/AdminHubPage.tsx'
import { AdminBookingDetailPage, AdminBookingListPage } from './pages/admin/BookingAdminPages.tsx'
import { AdminPaymentDetailPage, AdminPaymentListPage } from './pages/admin/PaymentAdminPages.tsx'
import { PackageFormPage, PackageListPage } from './pages/admin/PackagePages.tsx'
import { ScheduleFormPage, ScheduleListPage } from './pages/admin/SchedulePages.tsx'

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
        <Route path="/tours/:id" element={<TourDetailPage />} />
        <Route
          path="/tours/:id/book"
          element={
            <ProtectedRoute>
              <Narrow>
                <BookingPage />
              </Narrow>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tickets/verify/:token"
          element={
            <Narrow>
              <TicketVerifyPage />
            </Narrow>
          }
        />
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
          path="/account/bookings"
          element={
            <ProtectedRoute>
              <div className="wrap admin-page">
                <MyBookingsPage />
              </div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/bookings/:reference"
          element={
            <ProtectedRoute>
              <div className="wrap admin-page">
                <BookingDetailPage />
              </div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminHubPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/bookings"
          element={
            <ProtectedRoute>
              <AdminBookingListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/bookings/:reference"
          element={
            <ProtectedRoute>
              <AdminBookingDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/payments"
          element={
            <ProtectedRoute>
              <AdminPaymentListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/payments/:reference"
          element={
            <ProtectedRoute>
              <AdminPaymentDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tours"
          element={
            <ProtectedRoute>
              <PackageListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tours/new"
          element={
            <ProtectedRoute>
              <PackageFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tours/:id"
          element={
            <ProtectedRoute>
              <PackageFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/schedules"
          element={
            <ProtectedRoute>
              <ScheduleListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/schedules/new"
          element={
            <ProtectedRoute>
              <ScheduleFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/schedules/:id"
          element={
            <ProtectedRoute>
              <ScheduleFormPage />
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
                <ReceptionPaymentPage />
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
