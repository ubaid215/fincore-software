// src/modules/workspace/tests/invites.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OrganizationsService } from '../services/organizations.service';
import { PrismaService } from '../../../database/prisma.service';

type MockPrisma = {
  organization: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  userOrganization: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  subscription: {
    findFirst: jest.Mock;
  };
  invite: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    findMany: jest.Mock;
  };
  user: {
    findUnique: jest.Mock;
  };
  $transaction: jest.Mock;
};

const mockPrisma: MockPrisma = {
  organization: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  userOrganization: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  subscription: {
    findFirst: jest.fn(),
  },
  invite: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn((cb: (prisma: MockPrisma) => Promise<unknown>) => cb(mockPrisma)),
};

describe('OrganizationsService', () => {
  let service: OrganizationsService;

  const ORG = {
    id: 'org-001',
    name: 'FinCore Tech',
    slug: 'fincore-tech',
    email: 'admin@fincore.app',
  };
  const OWNER_ID = 'user-owner';
  const MEMBER_ID = 'user-member';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrganizationsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
    jest.clearAllMocks();
  });

  describe('create()', () => {
    const dto = { name: 'FinCore Tech', slug: 'fincore-tech', email: 'admin@fincore.app' };

    it('creates organization and assigns OWNER role to creator', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      mockPrisma.organization.create.mockResolvedValue(ORG);
      mockPrisma.userOrganization.create.mockResolvedValue({});

      const result = await service.create(OWNER_ID, dto);

      expect(result).toEqual(ORG);
      expect(mockPrisma.userOrganization.create).toHaveBeenCalledWith({
        data: { userId: OWNER_ID, organizationId: ORG.id, role: UserRole.OWNER },
      });
    });

    it('throws ConflictException when slug is already taken', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'other-org' });

      await expect(service.create(OWNER_ID, dto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.organization.create).not.toHaveBeenCalled();
    });

    it('sets default currency PKR and timezone UTC when not provided', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      mockPrisma.organization.create.mockResolvedValue(ORG);
      mockPrisma.userOrganization.create.mockResolvedValue({});

      await service.create(OWNER_ID, { name: 'X', slug: 'x', email: 'x@x.com' });

      expect(mockPrisma.organization.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({ currency: 'PKR', timezone: 'UTC', fiscalYearEnd: 12 }),
      });
    });
  });

  describe('findOne()', () => {
    it('returns org with members when found', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ ...ORG, members: [] });

      const result = await service.findOne(ORG.id);
      expect(result).toMatchObject(ORG);
    });

    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update()', () => {
    it('updates and returns the organization', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ ...ORG, members: [] });
      mockPrisma.organization.update.mockResolvedValue({ ...ORG, name: 'New Name' });

      const result = await service.update(ORG.id, { name: 'New Name' });
      expect(result.name).toBe('New Name');
    });

    it('throws NotFoundException if org does not exist', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      await expect(service.update('bad-id', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMemberRole()', () => {
    const requestorMembership = { role: UserRole.OWNER };
    const targetMembership = { role: UserRole.VIEWER };

    it('updates role successfully when requestor is OWNER', async () => {
      mockPrisma.userOrganization.findUnique
        .mockResolvedValueOnce(requestorMembership)
        .mockResolvedValueOnce(targetMembership);
      mockPrisma.userOrganization.update.mockResolvedValue({ role: UserRole.ACCOUNTANT });

      const result = await service.updateMemberRole(
        ORG.id,
        MEMBER_ID,
        UserRole.ACCOUNTANT,
        OWNER_ID,
      );
      expect(result.role).toBe(UserRole.ACCOUNTANT);
    });

    it('throws ForbiddenException when non-Owner tries to assign OWNER role', async () => {
      mockPrisma.userOrganization.findUnique.mockResolvedValue({ role: UserRole.ADMIN });

      await expect(
        service.updateMemberRole(ORG.id, MEMBER_ID, UserRole.OWNER, 'admin-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when target is not a member', async () => {
      mockPrisma.userOrganization.findUnique
        .mockResolvedValueOnce(requestorMembership)
        .mockResolvedValueOnce(null);

      await expect(
        service.updateMemberRole(ORG.id, 'stranger-id', UserRole.VIEWER, OWNER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeMember()', () => {
    it('removes a member successfully', async () => {
      mockPrisma.userOrganization.findUnique.mockResolvedValue({ role: UserRole.ACCOUNTANT });
      mockPrisma.userOrganization.delete.mockResolvedValue({});

      const result = await service.removeMember(ORG.id, MEMBER_ID, OWNER_ID);
      expect(result).toEqual({ removed: true });
    });

    it('throws ForbiddenException when removing self', async () => {
      await expect(service.removeMember(ORG.id, OWNER_ID, OWNER_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when trying to remove the Owner', async () => {
      mockPrisma.userOrganization.findUnique.mockResolvedValue({ role: UserRole.OWNER });

      await expect(service.removeMember(ORG.id, 'another-owner', OWNER_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when target is not in org', async () => {
      mockPrisma.userOrganization.findUnique.mockResolvedValue(null);

      await expect(service.removeMember(ORG.id, 'stranger', OWNER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
