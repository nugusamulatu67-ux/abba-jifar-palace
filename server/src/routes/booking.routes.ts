import { Router } from 'express'
import {
  getAdminBooking,
  getAdminBookings,
  getMyBooking,
  getMyBookings,
  postCancelAdminBooking,
  postCancelMyBooking,
  postConfirmBooking,
  postMyBooking,
} from '../controllers/booking.controller.ts'
import { authenticate, authorize } from '../middleware/authenticate.ts'

export const bookingRouter = Router()

bookingRouter.get('/bookings', authenticate, (req, res, next) => {
  void getMyBookings(req, res, next)
})
bookingRouter.post('/bookings', authenticate, (req, res, next) => {
  void postMyBooking(req, res, next)
})
bookingRouter.get('/bookings/:reference', authenticate, (req, res, next) => {
  void getMyBooking(req, res, next)
})
bookingRouter.post('/bookings/:reference/cancel', authenticate, (req, res, next) => {
  void postCancelMyBooking(req, res, next)
})

const admin = [authenticate, authorize('administrator')]

bookingRouter.get('/admin/bookings', ...admin, (req, res, next) => {
  void getAdminBookings(req, res, next)
})
bookingRouter.get('/admin/bookings/:reference', ...admin, (req, res, next) => {
  void getAdminBooking(req, res, next)
})
bookingRouter.post('/admin/bookings/:reference/confirm', ...admin, (req, res, next) => {
  void postConfirmBooking(req, res, next)
})
bookingRouter.post('/admin/bookings/:reference/cancel', ...admin, (req, res, next) => {
  void postCancelAdminBooking(req, res, next)
})
