import { Router } from 'express'
import {
  getAdminCheckInSummary,
  getAdminCheckIns,
  getCheckInPreview,
  getReceptionCheckIns,
  postCheckIn,
} from '../controllers/checkin.controller.ts'
import { authenticate, authorize } from '../middleware/authenticate.ts'

export const checkInRouter = Router()

const reception = [authenticate, authorize('receptionist')]
const admin = [authenticate, authorize('administrator')]

checkInRouter.get('/reception/check-ins/preview', ...reception, (req, res, next) => {
  void getCheckInPreview(req, res, next)
})
checkInRouter.post('/reception/check-ins', ...reception, (req, res, next) => {
  void postCheckIn(req, res, next)
})
checkInRouter.get('/reception/check-ins', ...reception, (req, res, next) => {
  void getReceptionCheckIns(req, res, next)
})

checkInRouter.get('/admin/check-ins/summary', ...admin, (req, res, next) => {
  void getAdminCheckInSummary(req, res, next)
})
checkInRouter.get('/admin/check-ins', ...admin, (req, res, next) => {
  void getAdminCheckIns(req, res, next)
})
