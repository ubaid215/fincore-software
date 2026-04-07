# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication >> should redirect to login when accessing protected route
- Location: e2e\auth.spec.ts:4:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/login/
Received string:  ""

Call log:
  - Expect "toHaveURL" with timeout 5000ms

```

```
Error: browserContext.close: Target page, context or browser has been closed
```