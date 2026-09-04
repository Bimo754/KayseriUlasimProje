import { Request, Response, NextFunction } from 'express';
import { Role } from '../constants';

export function loginRequired(req: Request, res: Response, next: NextFunction): any {
  const user = (req.session as any)?.kullanici;
  if (!user) {
    return res.status(401).json({ basarili: false, mesaj: 'Lütfen önce giriş yapınız!' });
  }
  return next();
}

export function adminRequired(req: Request, res: Response, next: NextFunction): any {
  const user = (req.session as any)?.kullanici;
  if (!user || user.rol !== Role.ADMIN) {
    return res.status(403).json({ basarili: false, mesaj: 'Bu işlem için yönetici yetkisi gereklidir!' });
  }
  return next();
}
