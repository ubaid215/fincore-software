// test/e2e/inventory.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { createTestApp, api } from '../helpers/app.helper';
import { cleanDb, getPrisma } from '../helpers/db.helper';
import { createTestUser, authHeaders } from '../helpers/auth.helper';

describe('Inventory (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await cleanDb(app);
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  async function createProduct(user: any, overrides = {}) {
    const { body } = await api(app)
      .post('/v1/inventory/products')
      .set(authHeaders(user))
      .send({
        code: 'TEST-001',
        name: 'Test Product',
        unit: 'pcs',
        sellingPrice: 1000,
        costPrice: 700,
        ...overrides,
      })
      .expect(201);
    return body.data;
  }

  // ─── POST /v1/inventory/products ──────────────────────────────────────────
  describe('POST /v1/inventory/products', () => {
    it('201 — creates a product', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const product = await createProduct(user);
      expect(product.code).toBe('TEST-001');
      expect(product.name).toBe('Test Product');
    });

    it('409 — duplicate product code', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      await createProduct(user);
      const { body } = await api(app)
        .post('/v1/inventory/products')
        .set(authHeaders(user))
        .send({
          code: 'TEST-001',
          name: 'Duplicate',
          unit: 'pcs',
          sellingPrice: 1000,
          costPrice: 700,
        })
        .expect(409);
      expect(body.message).toMatch(/already exists/i);
    });

    it('400 — missing required fields', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      await api(app)
        .post('/v1/inventory/products')
        .set(authHeaders(user))
        .send({ name: 'Missing code' })
        .expect(400);
    });

    it('403 — VIEWER cannot create products', async () => {
      const viewer = await createTestUser(app, { role: UserRole.VIEWER });
      await api(app)
        .post('/v1/inventory/products')
        .set(authHeaders(viewer))
        .send({
          code: 'TEST-001',
          name: 'Test',
          unit: 'pcs',
          sellingPrice: 1000,
          costPrice: 700,
        })
        .expect(403);
    });
  });

  // ─── POST /v1/inventory/products/:id/adjust-stock ─────────────────────────
  describe('POST /v1/inventory/products/:id/adjust-stock', () => {
    it('200 — increases stock (PURCHASE_IN)', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const product = await createProduct(user);

      await api(app)
        .post(`/v1/inventory/products/${product.id}/adjust-stock`)
        .set(authHeaders(user))
        .send({
          movementType: 'PURCHASE_IN',
          quantity: 50,
          notes: 'Initial stock',
        })
        .expect(201);

      const updated = await api(app)
        .get(`/v1/inventory/products/${product.id}`)
        .set(authHeaders(user));
      expect(updated.body.data.currentStock).toBe(50);
    });

    it('200 — decreases stock (SALE_OUT)', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const product = await createProduct(user);

      await api(app)
        .post(`/v1/inventory/products/${product.id}/adjust-stock`)
        .set(authHeaders(user))
        .send({ movementType: 'PURCHASE_IN', quantity: 50 });

      await api(app)
        .post(`/v1/inventory/products/${product.id}/adjust-stock`)
        .set(authHeaders(user))
        .send({ movementType: 'SALE_OUT', quantity: 10 });

      const updated = await api(app)
        .get(`/v1/inventory/products/${product.id}`)
        .set(authHeaders(user));
      expect(updated.body.data.currentStock).toBe(40);
    });

    it('400 — insufficient stock for SALE_OUT', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const product = await createProduct(user);

      const { body } = await api(app)
        .post(`/v1/inventory/products/${product.id}/adjust-stock`)
        .set(authHeaders(user))
        .send({ movementType: 'SALE_OUT', quantity: 10 })
        .expect(400);
      expect(body.message).toMatch(/insufficient/i);
    });
  });

  // ─── GET /v1/inventory/reports/summary ────────────────────────────────────
  describe('GET /v1/inventory/reports/summary', () => {
    it('200 — returns stock summary', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      await createProduct(user, { code: 'P001', name: 'Product 1' });
      await createProduct(user, { code: 'P002', name: 'Product 2' });

      const { body } = await api(app)
        .get('/v1/inventory/reports/summary')
        .set(authHeaders(user))
        .expect(200);

      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBe(2);
      expect(body.data[0]).toHaveProperty('reorderStatus');
    });
  });

  // ─── GET /v1/inventory/reports/reorder ────────────────────────────────────
  describe('GET /v1/inventory/reports/reorder', () => {
    it('200 — returns products needing reorder', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      await createProduct(user, {
        code: 'LOW-001',
        name: 'Low Stock Product',
        minStockLevel: 20,
      });

      const { body } = await api(app)
        .get('/v1/inventory/reports/reorder')
        .set(authHeaders(user))
        .expect(200);

      expect(Array.isArray(body.data)).toBe(true);
    });
  });
});
