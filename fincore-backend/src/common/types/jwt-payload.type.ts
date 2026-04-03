// src/common/types/jwt-payload.type.ts
export interface JwtPayload {
  sub: string; // userId
  email: string;
  iat?: number;
  exp?: number;
}
