import jwt, { JwtPayload } from 'jsonwebtoken';

export const generateToken = (payload: Record<string, unknown>, expiresIn?: string): string => {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: expiresIn || process.env.JWT_EXPIRE || '7d',
  } as jwt.SignOptions);
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
};

export const decodeToken = (token: string): JwtPayload | null => {
  return jwt.decode(token) as JwtPayload | null;
};
