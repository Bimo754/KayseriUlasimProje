import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

export const authRouter = Router();

authRouter.post('/giris', (req: Request, res: Response): any => {
  const { kullanici_adi, sifre } = req.body || {};
  const user = AuthService.verifyCredentials(kullanici_adi, sifre);

  if (!user) {
    return res.status(401).json({ basarili: false, mesaj: 'Kullanıcı adı veya şifre hatalı!' });
  }

  (req.session as any).kullanici = {
    id: user.id,
    kullanici_adi: user.kullanici_adi,
    ad_soyad: user.ad_soyad,
    rol: user.rol
  };

  return res.json({
    basarili: true,
    mesaj: `Hoş geldiniz, ${user.ad_soyad}.`,
    kullanici: (req.session as any).kullanici
  });
});

authRouter.post('/cikis', (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.json({ basarili: true, mesaj: 'Oturum başarıyla kapatıldı.' });
  });
});

authRouter.get('/durum', (req: Request, res: Response) => {
  const user = (req.session as any)?.kullanici;
  if (user) {
    res.json({ giris_yapildi: true, kullanici: user });
  } else {
    res.json({ giris_yapildi: false, kullanici: null });
  }
});
