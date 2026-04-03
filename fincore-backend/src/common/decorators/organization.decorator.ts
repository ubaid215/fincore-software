// src/common/decorators/organization.decorator.ts
import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';
import { Request } from 'express';

export const OrgId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const orgId = request.headers['x-organization-id'] as string | undefined;
  if (!orgId) {
    throw new BadRequestException('Missing required header: X-Organization-Id');
  }
  return orgId;
});
