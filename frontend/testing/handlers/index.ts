import { authHandlers } from './auth.handlers'
import { invoicesHandlers } from './invoices.handlers'
import { expensesHandlers } from './expenses.handlers'

export const handlers = [
  ...authHandlers,
  ...invoicesHandlers,
  ...expensesHandlers,
]