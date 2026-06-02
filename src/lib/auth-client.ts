import jwt from 'jsonwebtoken';

interface JWTPayload {
  id: string;
  username?: string;
  email?: string;
  role: string;
  shopId?: string;
  isSuperAdmin?: boolean;
  isOwner?: boolean;
  iat?: number;
  exp?: number;
}

// NOTE: We decode tokens on the client-side without verifying the signature because
// the shared symmetric JWT secret must remain private on the server. Rely on server
// endpoints for authoritative verification. Decoding is useful for quick checks
// (expiry, role) in the UI to avoid a full round-trip.
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}

export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}