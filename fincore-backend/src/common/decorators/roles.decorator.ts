// src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
/**
 * Restrict a route to users whose role meets or exceeds the specified level.
 * Uses ROLE_HIERARCHY for comparison — so @Roles(ADMIN) also allows OWNER.
 *
 * @example
 *   @Roles(UserRole.ADMIN)         // ADMIN and OWNER can access
 *   @Roles(UserRole.ACCOUNTANT)    // ACCOUNTANT, ADMIN, OWNER can access
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);