import type { RoleName } from '../../../shared/src/index.ts'

export function homeForRole(role: RoleName): string {
  if (role === 'administrator') {
    return '/admin'
  }
  if (role === 'tour_guide') {
    return '/guide'
  }
  if (role === 'receptionist') {
    return '/reception'
  }
  return '/account'
}
