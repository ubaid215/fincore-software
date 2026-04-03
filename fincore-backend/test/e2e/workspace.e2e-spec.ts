// test/e2e/workspace.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { createTestApp, api } from '../helpers/app.helper';
import { cleanDb, getPrisma } from '../helpers/db.helper';
import { createTestUser, authHeaders } from '../helpers/auth.helper';

// ─── Response shape helpers ───────────────────────────────────────────────
interface ApiResponse<T = Record<string, unknown>> {
  data: T;
  message: string;
  timestamp: string;
}

interface OrgData {
  id: string;
  slug: string;
  currency: string;
  name: string;
  members: unknown[];
}

interface InviteData {
  invite: { id: string; token: string };
  inviteUrl: string;
}

interface InviteListItem {
  id: string;
  email: string;
}

function body<T>(res: { body: unknown }): ApiResponse<T> {
  return res.body as ApiResponse<T>;
}
// ─────────────────────────────────────────────────────────────────────────

describe('Workspace (e2e)', () => {
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

  // ─── POST /v1/organizations ───────────────────────────────────────────────
  describe('POST /v1/organizations', () => {
    it('201 — creates org and caller becomes OWNER', async () => {
      const owner = await createTestUser(app);

      const res = await api(app)
        .post('/v1/organizations')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ name: 'My Company', slug: 'my-company', email: 'admin@myco.com' })
        .expect(201);

      const b = body<OrgData>(res);
      expect(b.data.slug).toBe('my-company');
      expect(b.data.currency).toBe('PKR');

      const prisma = getPrisma(app);
      const membership = await prisma.userOrganization.findUnique({
        where: { userId_organizationId: { userId: owner.userId, organizationId: b.data.id } },
      });
      expect(membership?.role).toBe(UserRole.OWNER);
    });

    it('409 — duplicate slug', async () => {
      const owner = await createTestUser(app);
      const dto = { name: 'Co', slug: 'same-slug', email: 'a@co.com' };

      await api(app)
        .post('/v1/organizations')
        .set('Authorization', `Bearer ${owner.token}`)
        .send(dto);

      const res = await api(app)
        .post('/v1/organizations')
        .set('Authorization', `Bearer ${owner.token}`)
        .send(dto)
        .expect(409);

      expect(body(res).message).toMatch(/already taken/i);
    });

    it('400 — slug with uppercase letters fails validation', async () => {
      const owner = await createTestUser(app);
      await api(app)
        .post('/v1/organizations')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ name: 'Co', slug: 'Invalid-Slug', email: 'a@co.com' })
        .expect(400);
    });

    it('400 — slug with spaces fails validation', async () => {
      const owner = await createTestUser(app);
      await api(app)
        .post('/v1/organizations')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ name: 'Co', slug: 'my company', email: 'a@co.com' })
        .expect(400);
    });

    it('401 — unauthenticated request', () =>
      api(app)
        .post('/v1/organizations')
        .send({ name: 'Co', slug: 'co', email: 'a@co.com' })
        .expect(401));
  });

  // ─── GET /v1/organizations/my ─────────────────────────────────────────────
  describe('GET /v1/organizations/my', () => {
    it('200 — returns all orgs the user belongs to', async () => {
      const user = await createTestUser(app);

      const res = await api(app)
        .get('/v1/organizations/my')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      const b = body<{ organization: unknown }[]>(res);
      expect(Array.isArray(b.data)).toBe(true);
      expect(b.data.length).toBeGreaterThanOrEqual(1);
      expect(b.data[0].organization).toBeDefined();
    });
  });

  // ─── GET /v1/organizations/:id ────────────────────────────────────────────
  describe('GET /v1/organizations/:id', () => {
    it('200 — returns org details with members', async () => {
      const owner = await createTestUser(app);

      const res = await api(app)
        .get(`/v1/organizations/${owner.orgId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);

      const b = body<OrgData>(res);
      expect(b.data.id).toBe(owner.orgId);
      expect(Array.isArray(b.data.members)).toBe(true);
    });

    it('404 — unknown org id', async () => {
      const owner = await createTestUser(app);
      await api(app)
        .get('/v1/organizations/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(404);
    });
  });

  // ─── POST /v1/invites ─────────────────────────────────────────────────────
  describe('POST /v1/invites', () => {
    it('201 — creates invite with token and inviteUrl', async () => {
      const owner = await createTestUser(app);

      const res = await api(app)
        .post('/v1/invites')
        .set(authHeaders(owner))
        .send({ email: 'colleague@company.com', role: UserRole.ACCOUNTANT })
        .expect(201);

      const b = body<InviteData>(res);
      expect(b.data.invite.token).toBeDefined();
      expect(b.data.inviteUrl).toContain(b.data.invite.token);
    });

    it('402 — seat limit reached when org is at max seats', async () => {
      const owner = await createTestUser(app);
      const prisma = getPrisma(app);

      const plan = await prisma.plan.create({
        data: {
          name: 'TINY',
          displayName: 'Tiny',
          priceMonthly: 100,
          currency: 'PKR',
          maxSeats: 1,
          features: [],
        },
      });
      await prisma.subscription.create({
        data: {
          organizationId: owner.orgId,
          planId: plan.id,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
        },
      });

      const res = await api(app)
        .post('/v1/invites')
        .set(authHeaders(owner))
        .send({ email: 'overflow@company.com', role: UserRole.VIEWER })
        .expect(400);

      expect(body(res).message).toMatch(/seat limit/i);
    });

    it('403 — VIEWER role cannot send invites', async () => {
      const viewer = await createTestUser(app, { role: UserRole.VIEWER });

      await api(app)
        .post('/v1/invites')
        .set(authHeaders(viewer))
        .send({ email: 'x@x.com', role: UserRole.VIEWER })
        .expect(403);
    });

    it('409 — duplicate invite for same email', async () => {
      const owner = await createTestUser(app);
      const dto = { email: 'colleague@company.com', role: UserRole.ACCOUNTANT };

      await api(app).post('/v1/invites').set(authHeaders(owner)).send(dto).expect(201);

      const res = await api(app).post('/v1/invites').set(authHeaders(owner)).send(dto).expect(409);

      expect(body(res).message).toMatch(/pending invite/i);
    });

    it('401 — unauthenticated', () =>
      api(app).post('/v1/invites').send({ email: 'x@x.com', role: UserRole.VIEWER }).expect(401));
  });

  // ─── GET /v1/invites ──────────────────────────────────────────────────────
  describe('GET /v1/invites', () => {
    it('200 — lists pending invites', async () => {
      const owner = await createTestUser(app);
      await api(app)
        .post('/v1/invites')
        .set(authHeaders(owner))
        .send({ email: 'pending@company.com', role: UserRole.VIEWER });

      const res = await api(app).get('/v1/invites').set(authHeaders(owner)).expect(200);
      const b = body<InviteListItem[]>(res);

      expect(Array.isArray(b.data)).toBe(true);
      expect(b.data.length).toBe(1);
      expect(b.data[0].email).toBe('pending@company.com');
    });
  });

  // ─── DELETE /v1/invites/:id ───────────────────────────────────────────────
  describe('DELETE /v1/invites/:id', () => {
    it('200 — revokes a pending invite', async () => {
      const owner = await createTestUser(app);

      const createRes = await api(app)
        .post('/v1/invites')
        .set(authHeaders(owner))
        .send({ email: 'revoke@company.com', role: UserRole.VIEWER });

      const inviteId: string = body<InviteData>(createRes).data.invite.id;

      await api(app).delete(`/v1/invites/${inviteId}`).set(authHeaders(owner)).expect(200);

      const listRes = await api(app).get('/v1/invites').set(authHeaders(owner));
      const listData: InviteListItem[] = body<InviteListItem[]>(listRes).data;

      expect(listData.find((i: InviteListItem) => i.id === inviteId)).toBeUndefined();
    });

    it('404 — unknown invite id', async () => {
      const owner = await createTestUser(app);
      await api(app)
        .delete('/v1/invites/00000000-0000-0000-0000-000000000000')
        .set(authHeaders(owner))
        .expect(404);
    });
  });

  // ─── RBAC enforcement ─────────────────────────────────────────────────────
  describe('Role enforcement', () => {
    it('ACCOUNTANT cannot update organization settings', async () => {
      const accountant = await createTestUser(app, { role: UserRole.ACCOUNTANT });

      await api(app)
        .patch(`/v1/organizations/${accountant.orgId}`)
        .set(authHeaders(accountant))
        .send({ name: 'Hacked Name' })
        .expect(403);
    });

    it('ADMIN can update organization settings', async () => {
      const admin = await createTestUser(app, { role: UserRole.ADMIN });

      const res = await api(app)
        .patch(`/v1/organizations/${admin.orgId}`)
        .set(authHeaders(admin))
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(body<OrgData>(res).data.name).toBe('Updated Name');
    });
  });
});
