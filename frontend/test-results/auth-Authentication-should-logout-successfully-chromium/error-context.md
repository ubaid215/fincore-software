# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication >> should logout successfully
- Location: e2e\auth.spec.ts:25:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.fill: Target page, context or browser has been closed
Call log:
  - waiting for locator('input[name="email"]')

```

```
Error: browserContext.close: Target page, context or browser has been closed
```