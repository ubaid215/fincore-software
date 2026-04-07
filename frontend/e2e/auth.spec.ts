import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should redirect to login when accessing protected route', async ({ page }) => {
    await page.goto('/dashboard/org-123')
    await expect(page).toHaveURL(/\/login/)
  })

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="email"]', 'john@acme.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/dashboard\/.+/)
  })

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="email"]', 'wrong@email.com')
    await page.fill('input[name="password"]', 'wrongpass')
    await page.click('button[type="submit"]')
    await expect(page.locator('text=Invalid email or password')).toBeVisible()
  })

  test('should logout successfully', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="email"]', 'john@acme.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    await page.click('button[aria-label="User menu"]')
    await page.click('text=Logout')
    await expect(page).toHaveURL('/login')
  })
})