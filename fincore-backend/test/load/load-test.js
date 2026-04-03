// test/load/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time');
const requestsTotal = new Counter('requests_total');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '3m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 500 },  // Ramp up to 500 users
    { duration: '3m', target: 500 },  // Stay at 500 users
    { duration: '1m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<400', 'p(99)<1000'], // 95% under 400ms, 99% under 1s
    error_rate: ['rate<0.01'],                      // Less than 1% errors
    response_time: ['p(95)<400'],
  },
};

// Helper function to get auth token
function getAuthToken() {
  const loginRes = http.post(
    `${__ENV.BASE_URL || 'http://localhost:3000'}/v1/auth/login`,
    JSON.stringify({
      email: __ENV.TEST_EMAIL || 'loadtest@fincore.com',
      password: __ENV.TEST_PASSWORD || 'LoadTest123!',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (loginRes.status !== 200) {
    console.error(`Login failed: ${loginRes.status} ${loginRes.body}`);
    return null;
  }

  const body = JSON.parse(loginRes.body);
  return body.data?.accessToken;
}

export default function () {
  const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
  let token;

  // Get token (reuse across iterations)
  const loginAttempts = 3;
  for (let i = 0; i < loginAttempts; i++) {
    token = getAuthToken();
    if (token) break;
    sleep(1);
  }

  if (!token) {
    errorRate.add(1);
    return;
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'X-Organization-Id': __ENV.ORG_ID || 'test-org-id',
    'Content-Type': 'application/json',
  };

  // ─── Scenario 1: GET /health (public, no auth) ───────────────────────────
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
  });
  requestsTotal.add(1);
  responseTime.add(healthRes.timings.duration);
  errorRate.add(healthRes.status !== 200);

  sleep(0.5);

  // ─── Scenario 2: GET /v1/invoices (list invoices) ─────────────────────────
  const invoicesRes = http.get(`${BASE_URL}/v1/invoices`, { headers });
  check(invoicesRes, {
    'invoices status is 200': (r) => r.status === 200,
  });
  requestsTotal.add(1);
  responseTime.add(invoicesRes.timings.duration);
  errorRate.add(invoicesRes.status !== 200);

  sleep(0.5);

  // ─── Scenario 3: POST /v1/invoices (create invoice) ──────────────────────
  const createInvoiceRes = http.post(
    `${BASE_URL}/v1/invoices`,
    JSON.stringify({
      clientName: `Load Test Customer ${__VU}-${__ITER}`,
      clientEmail: `loadtest${__VU}@example.com`,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      currency: 'PKR',
      lineItems: [
        { description: 'Load Test Service', quantity: 1, unitPrice: 5000, taxRate: 0.17 },
      ],
    }),
    { headers }
  );
  check(createInvoiceRes, {
    'create invoice status is 201': (r) => r.status === 201,
  });
  requestsTotal.add(1);
  responseTime.add(createInvoiceRes.timings.duration);
  errorRate.add(createInvoiceRes.status !== 201);

  sleep(0.5);

  // ─── Scenario 4: GET /v1/journal-entries (GL entries) ─────────────────────
  const journalRes = http.get(`${BASE_URL}/v1/journal-entries?limit=10`, { headers });
  check(journalRes, {
    'journal entries status is 200': (r) => r.status === 200,
  });
  requestsTotal.add(1);
  responseTime.add(journalRes.timings.duration);
  errorRate.add(journalRes.status !== 200);

  sleep(0.5);

  // ─── Scenario 5: GET /v1/reports/balance-sheet (heavy report) ────────────
  const balanceSheetRes = http.get(`${BASE_URL}/v1/reports/balance-sheet`, { headers });
  check(balanceSheetRes, {
    'balance sheet status is 200': (r) => r.status === 200,
  });
  requestsTotal.add(1);
  responseTime.add(balanceSheetRes.timings.duration);
  errorRate.add(balanceSheetRes.status !== 200);

  sleep(1);

  // ─── Scenario 6: GET /v1/subscriptions (plan info) ────────────────────────
  const subscriptionRes = http.get(`${BASE_URL}/v1/subscriptions`, { headers });
  check(subscriptionRes, {
    'subscription status is 200 or 404': (r) => r.status === 200 || r.status === 404,
  });
  requestsTotal.add(1);
  responseTime.add(subscriptionRes.timings.duration);
  errorRate.add(subscriptionRes.status !== 200 && subscriptionRes.status !== 404);

  sleep(0.5);
}

// ─── Setup function (runs once before all VUs) ─────────────────────────────
export function setup() {
  const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

  // Create test user if needed
  const createUserRes = http.post(
    `${BASE_URL}/v1/auth/register`,
    JSON.stringify({
      email: __ENV.TEST_EMAIL || 'loadtest@fincore.com',
      password: __ENV.TEST_PASSWORD || 'LoadTest123!',
      firstName: 'Load',
      lastName: 'Tester',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (createUserRes.status === 201) {
    console.log('Test user created successfully');
  } else if (createUserRes.status === 409) {
    console.log('Test user already exists');
  } else {
    console.warn(`User creation status: ${createUserRes.status}`);
  }

  return { message: 'Setup complete' };
}

// ─── Teardown function (runs once after all VUs) ───────────────────────────
export function teardown(data) {
  console.log('Load test completed');
  console.log(`Total requests: ${requestsTotal.values.count || 0}`);
}
