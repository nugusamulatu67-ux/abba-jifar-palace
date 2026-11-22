import { Router } from 'express'
import {
  getAdministratorAccess,
  getGuideAccess,
  getReceptionAccess,
  postStaffAccount,
} from '../controllers/access.controller.ts'
import { authenticate, authorize } from '../middleware/authenticate.ts'

export const accessRouter = Router()

accessRouter.get('/admin/access', authenticate, authorize('administrator'), getAdministratorAccess)
accessRouter.post('/admin/users', authenticate, authorize('administrator'), (req, res, next) => {
  void postStaffAccount(req, res, next)
})
accessRouter.get('/guide/access', authenticate, authorize('tour_guide'), getGuideAccess)
accessRouter.get('/reception/access', authenticate, authorize('receptionist'), getReceptionAccess)
