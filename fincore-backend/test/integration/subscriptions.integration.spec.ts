/**
 * Subscriptions integration tests — require Postgres. Set SKIP_INTEGRATION_TESTS=1 when no DB.
 */
const skipSubscriptionsIntegration = ['1', 'true'].includes(
  String(process.env.SKIP_INTEGRATION_TESTS).toLowerCase(),
);

(skipSubscriptionsIntegration ? describe.skip : describe)('Subscriptions integration', () => {
  it('placeholder — add subscription + billing flows with TEST_DATABASE_URL', () => {
    expect(true).toBe(true);
  });
});
