// test/e2e/auth.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import { createTestApp, api } from '../helpers/app.helper';
import { cleanDb, getPrisma } from '../helpers/db.helper';
import { createTestUser } from '../helpers/auth.helper';

// ─── Response shape helpers ───────────────────────────────────────────────
interface ApiResponse<T = Record<string, unknown>> {
  data: T;
  message: string;
  timestamp: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface MfaSetup {
  secret: string;
  otpAuthUrl: string;
  qrCodeUrl: string;
}

interface UserProfile {
  email: string;
  passwordHash?: string;
}

function body<T>(res: { body: unknown }): ApiResponse<T> {
  return res.body as ApiResponse<T>;
}

// ─────────────────────────────────────────────────────────────────────────

describe('Auth (e2e)', () => {
  let app: INestApplication;

  const VALID_USER = {
    email: 'ubaid@fincore.test',
    password: 'StrongPass1!',
    firstName: 'Ubaid',
    lastName: 'Rehman',
  };

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    await cleanDb(app);
  });
  afterAll(async () => {
    await app.close();
  });

  // ─── POST /v1/auth/register ───────────────────────────────────────────────
  describe('POST /v1/auth/register', () => {
    it('201 — registers a new user and returns token pair', async () => {
      const res = await api(app).post('/v1/auth/register').send(VALID_USER).expect(201);
      const b = body<TokenPair>(res);

      expect(b.data.accessToken).toBeDefined();
      expect(b.data.refreshToken).toBeDefined();
      expect(b.timestamp).toBeDefined();
    });

    it('409 — duplicate email returns ConflictException', async () => {
      await api(app).post('/v1/auth/register').send(VALID_USER);
      const res = await api(app).post('/v1/auth/register').send(VALID_USER).expect(409);
      const b = body(res);

      expect(b.message).toMatch(/already exists/i);
    });

    it('400 — missing firstName returns validation error', () =>
      api(app)
        .post('/v1/auth/register')
        .send({ email: VALID_USER.email, password: VALID_USER.password, lastName: 'R' })
        .expect(400));

    it('400 — weak password (no uppercase) fails validation', () =>
      api(app)
        .post('/v1/auth/register')
        .send({ ...VALID_USER, password: 'weakpassword1' })
        .expect(400));

    it('400 — invalid email format', () =>
      api(app)
        .post('/v1/auth/register')
        .send({ ...VALID_USER, email: 'not-an-email' })
        .expect(400));

    it('400 — password shorter than 8 chars', () =>
      api(app)
        .post('/v1/auth/register')
        .send({ ...VALID_USER, password: 'Ab1!' })
        .expect(400));
  });

  // ─── POST /v1/auth/login ─────────────────────────────────────────────────
  describe('POST /v1/auth/login', () => {
    beforeEach(async () => {
      await api(app).post('/v1/auth/register').send(VALID_USER);
    });

    it('200 — valid credentials return token pair', async () => {
      const res = await api(app)
        .post('/v1/auth/login')
        .send({ email: VALID_USER.email, password: VALID_USER.password })
        .expect(200);
      const b = body<TokenPair>(res);

      expect(b.data.accessToken).toBeDefined();
      expect(b.data.refreshToken).toBeDefined();
    });

    it('401 — wrong password', () =>
      api(app)
        .post('/v1/auth/login')
        .send({ email: VALID_USER.email, password: 'WrongPass1!' })
        .expect(401));

    it('401 — unknown email', () =>
      api(app)
        .post('/v1/auth/login')
        .send({ email: 'ghost@fincore.test', password: 'anything' })
        .expect(401));

    it('error messages for wrong email and wrong password are identical (no enumeration)', async () => {
      const res1 = await api(app)
        .post('/v1/auth/login')
        .send({ email: 'ghost@fincore.test', password: 'anything' });

      const res2 = await api(app)
        .post('/v1/auth/login')
        .send({ email: VALID_USER.email, password: 'WrongPass1!' });

      expect(body(res1).message).toBe(body(res2).message);
    });
  });

  // ─── POST /v1/auth/refresh ────────────────────────────────────────────────
  describe('POST /v1/auth/refresh', () => {
    it('200 — valid refresh token returns new token pair', async () => {
      const reg = await api(app).post('/v1/auth/register').send(VALID_USER);
      const refreshToken: string = body<TokenPair>(reg).data.refreshToken;

      const res = await api(app).post('/v1/auth/refresh').send({ refreshToken }).expect(200);
      const b = body<TokenPair>(res);

      expect(b.data.accessToken).toBeDefined();
      expect(b.data.refreshToken).toBeDefined();
      expect(b.data.refreshToken).not.toBe(refreshToken);
    });

    it('401 — expired/invalid refresh token', () =>
      api(app).post('/v1/auth/refresh').send({ refreshToken: 'not-a-real-token' }).expect(401));

    it('401 — using same refresh token twice (rotation invalidates it)', async () => {
      const reg = await api(app).post('/v1/auth/register').send(VALID_USER);
      const refreshToken: string = body<TokenPair>(reg).data.refreshToken;

      await api(app).post('/v1/auth/refresh').send({ refreshToken }).expect(200);
      await api(app).post('/v1/auth/refresh').send({ refreshToken }).expect(401);
    });
  });

  // ─── POST /v1/auth/logout ────────────────────────────────────────────────
  describe('POST /v1/auth/logout', () => {
    it('200 — invalidates the refresh token', async () => {
      const reg = await api(app).post('/v1/auth/register').send(VALID_USER);
      const refreshToken: string = body<TokenPair>(reg).data.refreshToken;

      await api(app).post('/v1/auth/logout').send({ refreshToken }).expect(200);
      await api(app).post('/v1/auth/refresh').send({ refreshToken }).expect(401);
    });

    it('200 — idempotent: logging out with non-existent token still succeeds', () =>
      api(app).post('/v1/auth/logout').send({ refreshToken: 'not-real' }).expect(200));
  });

  // ─── GET /v1/auth/me ─────────────────────────────────────────────────────
  describe('GET /v1/auth/me', () => {
    it('200 — returns current user profile', async () => {
      const creds = await createTestUser(app);

      const res = await api(app)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${creds.token}`)
        .expect(200);
      const b = body<UserProfile>(res);

      expect(b.data.email).toBe(creds.email);
      expect(b.data.passwordHash).toBeUndefined();
    });

    it('401 — missing token', () => api(app).get('/v1/auth/me').expect(401));

    it('401 — malformed Bearer token', () =>
      api(app).get('/v1/auth/me').set('Authorization', 'Bearer not.a.jwt').expect(401));
  });

  // ─── MFA flow ────────────────────────────────────────────────────────────
  describe('MFA flow', () => {
    it('setupMfa → enableMfa → login with MFA code', async () => {
      const creds = await createTestUser(app);
      const authH = { Authorization: `Bearer ${creds.token}` };

      const setupRes = await api(app).post('/v1/auth/mfa/setup').set(authH).expect(201);
      const setup = body<MfaSetup>(setupRes);

      expect(setup.data.secret).toBeDefined();
      expect(setup.data.otpAuthUrl).toContain('otpauth://totp/');

      const badCode = await api(app)
        .post('/v1/auth/mfa/enable')
        .set(authH)
        .send({ code: '000000' })
        .expect(401);

      expect(body(badCode).message).toMatch(/invalid/i);
    });

    it('401 — setupMfa without auth token', () => api(app).post('/v1/auth/mfa/setup').expect(401));
  });

  // ─── Token persistence in DB ──────────────────────────────────────────────
  describe('Refresh token persistence', () => {
    it('refresh token is stored in DB after register', async () => {
      const res = await api(app).post('/v1/auth/register').send(VALID_USER);
      const refreshToken: string = body<TokenPair>(res).data.refreshToken;
      const prisma = getPrisma(app);

      const stored = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
      });

      expect(stored).not.toBeNull();
      expect(stored!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('refresh token is deleted from DB after logout', async () => {
      const res = await api(app).post('/v1/auth/register').send(VALID_USER);
      const rt: string = body<TokenPair>(res).data.refreshToken;

      await api(app).post('/v1/auth/logout').send({ refreshToken: rt });

      const prisma = getPrisma(app);
      const stored = await prisma.refreshToken.findUnique({ where: { token: rt } });
      expect(stored).toBeNull();
    });
  });
});
