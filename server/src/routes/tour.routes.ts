import { Router } from 'express'
import {
  getAdminPackage,
  getAdminPackages,
  getAdminSchedule,
  getAdminSchedules,
  getPublicPackage,
  getPublicPackages,
  getPublicSchedule,
  getPublicSchedules,
  patchAdminPackage,
  patchAdminSchedule,
  postAdminPackage,
  postAdminPackageStatus,
  postAdminSchedule,
  postCancelSchedule,
} from '../controllers/tour.controller.ts'
import { authenticate, authorize } from '../middleware/authenticate.ts'

export const tourRouter = Router()

tourRouter.get('/tours', (req, res, next) => {
  void getPublicPackages(req, res, next)
})
tourRouter.get('/tours/:id', (req, res, next) => {
  void getPublicPackage(req, res, next)
})
tourRouter.get('/schedules', (req, res, next) => {
  void getPublicSchedules(req, res, next)
})
tourRouter.get('/schedules/:id', (req, res, next) => {
  void getPublicSchedule(req, res, next)
})

const admin = [authenticate, authorize('administrator')]

tourRouter.get('/admin/tours', ...admin, (req, res, next) => {
  void getAdminPackages(req, res, next)
})
tourRouter.post('/admin/tours', ...admin, (req, res, next) => {
  void postAdminPackage(req, res, next)
})
tourRouter.get('/admin/tours/:id', ...admin, (req, res, next) => {
  void getAdminPackage(req, res, next)
})
tourRouter.patch('/admin/tours/:id', ...admin, (req, res, next) => {
  void patchAdminPackage(req, res, next)
})
tourRouter.post('/admin/tours/:id/status', ...admin, (req, res, next) => {
  void postAdminPackageStatus(req, res, next)
})
tourRouter.get('/admin/schedules', ...admin, (req, res, next) => {
  void getAdminSchedules(req, res, next)
})
tourRouter.post('/admin/schedules', ...admin, (req, res, next) => {
  void postAdminSchedule(req, res, next)
})
tourRouter.get('/admin/schedules/:id', ...admin, (req, res, next) => {
  void getAdminSchedule(req, res, next)
})
tourRouter.patch('/admin/schedules/:id', ...admin, (req, res, next) => {
  void patchAdminSchedule(req, res, next)
})
tourRouter.post('/admin/schedules/:id/cancel', ...admin, (req, res, next) => {
  void postCancelSchedule(req, res, next)
})
