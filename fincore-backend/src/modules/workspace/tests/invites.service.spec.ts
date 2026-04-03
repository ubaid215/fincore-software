// src/modules/workspace/tests/invites.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { InvitesService } from '../services/invites.service';
import { PrismaService } from '../../../database/prisma.service';

type MockPrisma = {
  subscription: { findUnique: jest.Mock };
  userOrganization: {
    count: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
  };
  user: { findUnique: jest.Mock };
  invite: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  $transaction: jest.Mock;
};

const mockPrisma: MockPrisma = {
  subscription: { findUnique: jest.fn() },
  userOrganization: {
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  user: { findUnique: jest.fn() },
  invite: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn((cb: (prisma: MockPrisma) => Promise<unknown>) => cb(mockPrisma)),
};

describe('InvitesService', () => {
  let service: InvitesService;

  const ORG_ID = 'org-001';
  const INVITER_ID = 'user-owner';
  const INVITEE_ID = 'user-new';
  const INVITE_DTO = { email: 'new@colleague.com', role: UserRole.ACCOUNTANT };

  const futureDate = new Date(Date.now() + 72 * 60 * 60 * 1000);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InvitesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<InvitesService>(InvitesService);
    jest.clearAllMocks();
  });

  describe('createInvite()', () => {
    const setupSeats = (maxSeats: number, currentCount: number, hasSub = true): void => {
      mockPrisma.subscription.findUnique.mockResolvedValue(hasSub ? { plan: { maxSeats } } : null);
      mockPrisma.userOrganization.count.mockResolvedValue(currentCount);
    };

    it('creates an invite when seats are available', async () => {
      setupSeats(10, 3);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.invite.findFirst.mockResolvedValue(null);
      mockPrisma.invite.create.mockImplementation(
        ({ data }: { data: { token: string; email: string; expiresAt: Date } }) =>
          Promise.resolve({
            id: 'inv-001',
            email: data.email,
            token: data.token, // ← echo back the token the service generated
            expiresAt: data.email,
          }),
      );

      const result = await service.createInvite(ORG_ID, INVITER_ID, INVITE_DTO);

      expect(result.invite).toBeDefined();
      expect(result.invite.token).toBeDefined();
      expect(result.inviteUrl).toContain(result.invite.token);
    });

    it('throws 402 BadRequestException when seat limit is reached', async () => {
      setupSeats(3, 3);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      let err: unknown;
      try {
        await service.createInvite(ORG_ID, INVITER_ID, INVITE_DTO);
      } catch (e) {
        err = e;
      }

      expect(err).toBeInstanceOf(BadRequestException);
      const response = (err as BadRequestException).getResponse() as Record<string, unknown>;
      expect(response['code']).toBe('SEAT_LIMIT_REACHED');
      expect(response['statusCode']).toBe(402);
    });

    it('uses maxSeats=3 grace limit when org has no subscription', async () => {
      setupSeats(0, 3, false);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.createInvite(ORG_ID, INVITER_ID, INVITE_DTO)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ConflictException when email is already a member', async () => {
      setupSeats(10, 2);
      mockPrisma.user.findUnique.mockResolvedValue({ id: INVITEE_ID });
      mockPrisma.userOrganization.findUnique.mockResolvedValue({ role: UserRole.VIEWER });

      await expect(service.createInvite(ORG_ID, INVITER_ID, INVITE_DTO)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException when a valid pending invite already exists', async () => {
      setupSeats(10, 2);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.invite.findFirst.mockResolvedValue({
        id: 'existing',
        email: INVITE_DTO.email,
        expiresAt: futureDate,
      });

      await expect(service.createInvite(ORG_ID, INVITER_ID, INVITE_DTO)).rejects.toThrow(
        ConflictException,
      );
    });

    it('allows re-invite when previous invite has expired', async () => {
      setupSeats(10, 2);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.invite.findFirst.mockResolvedValue({
        id: 'old',
        email: INVITE_DTO.email,
        expiresAt: new Date(Date.now() - 1000),
      });
      mockPrisma.invite.create.mockResolvedValue({
        id: 'new-inv',
        email: INVITE_DTO.email,
        token: 'new-token',
        expiresAt: futureDate,
      });

      const result = await service.createInvite(ORG_ID, INVITER_ID, INVITE_DTO);
      expect(result.invite).toBeDefined();
    });
  });

  describe('acceptInvite()', () => {
    const validInvite = {
      id: 'inv-001',
      organizationId: ORG_ID,
      role: UserRole.ACCOUNTANT,
      token: 'valid-token',
      acceptedAt: null,
      expiresAt: futureDate,
    };

    it('accepts a valid invite and joins the organization', async () => {
      mockPrisma.invite.findUnique.mockResolvedValue(validInvite);
      mockPrisma.subscription.findUnique.mockResolvedValue({ plan: { maxSeats: 10 } });
      mockPrisma.userOrganization.count.mockResolvedValue(2);
      mockPrisma.userOrganization.create.mockResolvedValue({});
      mockPrisma.invite.update.mockResolvedValue({});

      const result = await service.acceptInvite('valid-token', INVITEE_ID);

      expect(result.joined).toBe(true);
      expect(result.organizationId).toBe(ORG_ID);
      expect(result.role).toBe(UserRole.ACCOUNTANT);
      expect(mockPrisma.userOrganization.create).toHaveBeenCalledWith({
        data: { userId: INVITEE_ID, organizationId: ORG_ID, role: UserRole.ACCOUNTANT },
      });
    });

    it('throws NotFoundException for unknown token', async () => {
      mockPrisma.invite.findUnique.mockResolvedValue(null);
      await expect(service.acceptInvite('ghost-token', INVITEE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when invite already accepted', async () => {
      mockPrisma.invite.findUnique.mockResolvedValue({ ...validInvite, acceptedAt: new Date() });
      await expect(service.acceptInvite('valid-token', INVITEE_ID)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws BadRequestException when invite is expired', async () => {
      mockPrisma.invite.findUnique.mockResolvedValue({
        ...validInvite,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.acceptInvite('expired-token', INVITEE_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('re-checks seat availability at accept time', async () => {
      mockPrisma.invite.findUnique.mockResolvedValue(validInvite);
      mockPrisma.subscription.findUnique.mockResolvedValue({ plan: { maxSeats: 3 } });
      mockPrisma.userOrganization.count.mockResolvedValue(3);

      await expect(service.acceptInvite('valid-token', INVITEE_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('revokeInvite()', () => {
    it('deletes the invite successfully', async () => {
      mockPrisma.invite.findUnique.mockResolvedValue({ id: 'inv-001', organizationId: ORG_ID });
      mockPrisma.invite.delete.mockResolvedValue({});

      const result = await service.revokeInvite('inv-001', ORG_ID);
      expect(result).toEqual({ revoked: true });
    });

    it('throws NotFoundException when invite does not exist', async () => {
      mockPrisma.invite.findUnique.mockResolvedValue(null);
      await expect(service.revokeInvite('bad-id', ORG_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when invite belongs to a different org', async () => {
      mockPrisma.invite.findUnique.mockResolvedValue({
        id: 'inv-001',
        organizationId: 'other-org',
      });
      await expect(service.revokeInvite('inv-001', ORG_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
