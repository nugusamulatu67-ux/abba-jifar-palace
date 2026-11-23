import { Router } from 'express'
import {
  getAdminAssignments,
  getAdminGuide,
  getAdminGuideAssignments,
  getAdminGuides,
  getGuideAssignment,
  getGuideAssignments,
  getGuideDashboard,
  patchAdminAssignment,
  postAdminAssignment,
} from '../controllers/guide.controller.ts'
import { authenticate, authorize } from '../middleware/authenticate.ts'

export const guideRouter = Router()

const admin = [authenticate, authorize('administrator')]
const guide = [authenticate, authorize('tour_guide')]

guideRouter.get('/admin/guides', ...admin, (req, res, next) => {
  void getAdminGuides(req, res, next)
})
guideRouter.get('/admin/guides/:id/assignments', ...admin, (req, res, next) => {
  void getAdminGuideAssignments(req, res, next)
})
guideRouter.get('/admin/guides/:id', ...admin, (req, res, next) => {
  void getAdminGuide(req, res, next)
})
guideRouter.get('/admin/assignments', ...admin, (req, res, next) => {
  void getAdminAssignments(req, res, next)
})
guideRouter.post('/admin/assignments', ...admin, (req, res, next) => {
  void postAdminAssignment(req, res, next)
})
guideRouter.patch('/admin/assignments/:id', ...admin, (req, res, next) => {
  void patchAdminAssignment(req, res, next)
})

guideRouter.get('/guide/dashboard', ...guide, (req, res, next) => {
  void getGuideDashboard(req, res, next)
})
guideRouter.get('/guide/assignments', ...guide, (req, res, next) => {
  void getGuideAssignments(req, res, next)
})
guideRouter.get('/guide/assignments/:id', ...guide, (req, res, next) => {
  void getGuideAssignment(req, res, next)
})
