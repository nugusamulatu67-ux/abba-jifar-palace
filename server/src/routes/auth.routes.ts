import { Router } from 'express'
import { getMe, postLogin, postLogout, postRegister } from '../controllers/auth.controller.ts'
import { authenticate } from '../middleware/authenticate.ts'

export const authRouter = Router()

authRouter.post('/register', (req, res, next) => {
  void postRegister(req, res, next)
})

authRouter.post('/login', (req, res, next) => {
  void postLogin(req, res, next)
})

authRouter.post('/logout', authenticate, (req, res, next) => {
  void postLogout(req, res, next)
})

authRouter.get('/me', authenticate, (req, res, next) => {
  void getMe(req, res, next)
})
