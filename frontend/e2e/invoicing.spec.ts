import { test, expect } from '@playwright/test'

test.describe('Invoicing', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.fill('input[name="email"]', 'john@acme.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/dashboard\/.+/)
  })

  test('should create a new invoice', async ({ page }) => {
    await page.goto('/dashboard/org-456/invoices/new')
    
    // Fill customer
    await page.click('text=Select a customer')
    await page.click('text=Acme Corp')
    
    // Fill dates
    await page.fill('input[name="issueDate"]', '2025-04-01')
    await page.fill('input[name="dueDate"]', '2025-05-01')
    
    // Add line item
    await page.fill('input[name="lineItems.0.description"]', 'Consulting Services')
    await page.fill('input[name="lineItems.0.quantity"]', '10')
    await page.fill('input[name="lineItems.0.unitPrice"]', '100')
    
    // Submit
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/dashboard\/.+\/invoices\/.+/)
  })

  test('should view invoice list', async ({ page }) => {
    await page.goto('/dashboard/org-456/invoices')
    await expect(page.locator('table')).toBeVisible()
  })
})