import { test, expect } from '@playwright/test'

test.describe('Expenses', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="email"]', 'john@acme.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
  })

  test('should create a new expense', async ({ page }) => {
    await page.goto('/dashboard/org-456/expenses/new')
    
    await page.click('text=Select a category')
    await page.click('text=Travel')
    await page.fill('input[name="description"]', 'Flight to NYC')
    await page.fill('input[name="amount"]', '500')
    await page.fill('input[name="expenseDate"]', '2025-04-01')
    
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/dashboard\/.+\/expenses\/.+/)
  })

  test('should submit expense for approval', async ({ page }) => {
    // Create expense first
    await page.goto('/dashboard/org-456/expenses/new')
    await page.click('text=Select a category')
    await page.click('text=Travel')
    await page.fill('input[name="description"]', 'Flight to NYC')
    await page.fill('input[name="amount"]', '500')
    await page.fill('input[name="expenseDate"]', '2025-04-01')
    await page.click('button[type="submit"]')
    
    // Submit for approval
    await page.click('button:has-text("Submit for Approval")')
    await expect(page.locator('text=Submitted')).toBeVisible()
  })
})