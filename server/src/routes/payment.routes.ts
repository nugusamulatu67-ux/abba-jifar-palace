import { Router } from 'express'
import {
  getAdminPayment,
  getAdminPayments,
  getPayment,
  getReceptionPayments,
  getTicketVerification,
  postAdminPayment,
  postReceptionPayment,
} from '../controllers/payment.controller.ts'
import { authenticate, authorize } from '../middleware/authenticate.ts'

export const paymentRouter = Router()

paymentRouter.get('/tickets/:token/verify', (req, res, next) => {
  void getTicketVerification(req, res, next)
})

paymentRouter.get('/payments/:reference', authenticate, (req, res, next) => {
  void getPayment(req, res, next)
})

paymentRouter.get('/reception/payments', authenticate, authorize('receptionist'), (req, res, next) => {
  void getReceptionPayments(req, res, next)
})
paymentRouter.post('/reception/payments', authenticate, authorize('receptionist'), (req, res, next) => {
  void postReceptionPayment(req, res, next)
})

const admin = [authenticate, authorize('administrator')]

paymentRouter.get('/admin/payments', ...admin, (req, res, next) => {
  void getAdminPayments(req, res, next)
})
paymentRouter.get('/admin/payments/:reference', ...admin, (req, res, next) => {
  void getAdminPayment(req, res, next)
})
paymentRouter.post('/admin/payments', ...admin, (req, res, next) => {
  void postAdminPayment(req, res, next)
})
