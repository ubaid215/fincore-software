# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication >> should login successfully with valid credentials
- Location: e2e\auth.spec.ts:9:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.fill: Target page, context or browser has been closed
Call log:
  - waiting for locator('input[name="email"]')

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | test.describe('Authentication', () => {
  4  |   test('should redirect to login when accessing protected route', async ({ page }) => {
  5  |     await page.goto('/dashboard/org-123')
  6  |     await expect(page).toHaveURL(/\/login/)
  7  |   })
  8  | 
  9  |   test('should login successfully with valid credentials', async ({ page }) => {
  10 |     await page.goto('/login')
> 11 |     await page.fill('input[name="email"]', 'john@acme.com')
     |                ^ Error: page.fill: Target page, context or browser has been closed
  12 |     await page.fill('input[name="password"]', 'password123')
  13 |     await page.click('button[type="submit"]')
  14 |     await expect(page).toHaveURL(/\/dashboard\/.+/)
  15 |   })
  16 | 
  17 |   test('should show error with invalid credentials', async ({ page }) => {
  18 |     await page.goto('/login')
  19 |     await page.fill('input[name="email"]', 'wrong@email.com')
  20 |     await page.fill('input[name="password"]', 'wrongpass')
  21 |     await page.click('button[type="submit"]')
  22 |     await expect(page.locator('text=Invalid email or password')).toBeVisible()
  23 |   })
  24 | 
  25 |   test('should logout successfully', async ({ page }) => {
  26 |     await page.goto('/login')
  27 |     await page.fill('input[name="email"]', 'john@acme.com')
  28 |     await page.fill('input[name="password"]', 'password123')
  29 |     await page.click('button[type="submit"]')
  30 |     
  31 |     await page.click('button[aria-label="User menu"]')
  32 |     await page.click('text=Logout')
  33 |     await expect(page).toHaveURL('/login')
  34 |   })
  35 | })
```