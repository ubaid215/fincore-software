/* eslint-disable @typescript-eslint/no-unsafe-argument */
// src/modules/auth/tests/auth.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { Reflector } from '@nestjs/core';

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  refreshTokens: jest.fn(),
  logout: jest.fn(),
  getProfile: jest.fn(),
  setupMfa: jest.fn(),
  enableMfa: jest.fn(),
  disableMfa: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  const TOKEN_PAIR = { accessToken: 'tok', refreshToken: 'ref' };
  const USER_PAYLOAD = { sub: 'user-001', email: 'ubaid@fincore.app' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }, Reflector],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  describe('register()', () => {
    it('delegates to AuthService.register and returns result', async () => {
      mockAuthService.register.mockResolvedValue(TOKEN_PAIR);
      const dto = { email: 'a@b.com', password: 'Pass1!', firstName: 'A', lastName: 'B' };

      const result = await controller.register(dto as any);
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(TOKEN_PAIR);
    });
  });

  describe('login()', () => {
    it('delegates to AuthService.login', async () => {
      mockAuthService.login.mockResolvedValue(TOKEN_PAIR);
      const dto = { email: 'a@b.com', password: 'pw' };

      const result = await controller.login(dto as any);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual(TOKEN_PAIR);
    });
  });

  describe('refresh()', () => {
    it('delegates to AuthService.refreshTokens', async () => {
      mockAuthService.refreshTokens.mockResolvedValue(TOKEN_PAIR);

      const result = await controller.refresh({ refreshToken: 'old-token' } as any);
      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith('old-token');
      expect(result).toEqual(TOKEN_PAIR);
    });
  });

  describe('logout()', () => {
    it('delegates to AuthService.logout', async () => {
      mockAuthService.logout.mockResolvedValue({ success: true });

      const result = await controller.logout({ refreshToken: 'tok' } as any);
      expect(result).toEqual({ success: true });
    });
  });

  describe('getProfile()', () => {
    it('passes userId from JWT payload to service', async () => {
      const profile = { id: 'user-001', email: 'ubaid@fincore.app', firstName: 'Ubaid' };
      mockAuthService.getProfile.mockResolvedValue(profile);

      const result = await controller.getProfile(USER_PAYLOAD);
      expect(mockAuthService.getProfile).toHaveBeenCalledWith('user-001');
      expect(result).toEqual(profile);
    });
  });

  describe('setupMfa()', () => {
    it('calls service with userId from JWT', async () => {
      const setup = { secret: 'SEC', otpAuthUrl: 'otpauth://', qrCodeUrl: 'https://qr' };
      mockAuthService.setupMfa.mockResolvedValue(setup);

      const result = await controller.setupMfa(USER_PAYLOAD);
      expect(mockAuthService.setupMfa).toHaveBeenCalledWith('user-001');
      expect(result).toEqual(setup);
    });
  });

  describe('enableMfa()', () => {
    it('calls service with userId and code', async () => {
      mockAuthService.enableMfa.mockResolvedValue({ enabled: true });

      const result = await controller.enableMfa(USER_PAYLOAD, { code: '123456' } as any);
      expect(mockAuthService.enableMfa).toHaveBeenCalledWith('user-001', '123456');
      expect(result).toEqual({ enabled: true });
    });
  });

  describe('disableMfa()', () => {
    it('calls service with userId and code', async () => {
      mockAuthService.disableMfa.mockResolvedValue({ disabled: true });

      const result = await controller.disableMfa(USER_PAYLOAD, { code: '654321' } as any);
      expect(mockAuthService.disableMfa).toHaveBeenCalledWith('user-001', '654321');
      expect(result).toEqual({ disabled: true });
    });
  });
});
