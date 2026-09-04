import request from 'supertest';
import { createApp } from '../src/server';
import { AuthService } from '../src/services/auth.service';
import { Role } from '../src/constants';

describe('Kimlik Doğrulama & Yetki Testleri (Auth Tests)', () => {
  const app = createApp();

  test('Admin kullanıcısının doğru doğrulanması', () => {
    const user = AuthService.verifyCredentials('admin', 'admin123');
    expect(user).not.toBeNull();
    expect(user?.kullanici_adi).toBe('admin');
    expect(user?.rol).toBe(Role.ADMIN);
  });

  test('Saha operatörünün doğru doğrulanması', () => {
    const user = AuthService.verifyCredentials('saha', 'saha123');
    expect(user).not.toBeNull();
    expect(user?.kullanici_adi).toBe('saha');
    expect(user?.rol).toBe(Role.OPERATOR);
  });

  test('Hatalı şifre ile giriş engellenmeli', () => {
    const user = AuthService.verifyCredentials('admin', 'wrongpass');
    expect(user).toBeNull();
  });

  test('Varolmayan kullanıcı adı engellenmeli', () => {
    const user = AuthService.verifyCredentials('nonexistent_user_99', '123456');
    expect(user).toBeNull();
  });

  test('Giriş API uç noktası testi', async () => {
    const res = await request(app)
      .post('/api/auth/giris')
      .send({ kullanici_adi: 'admin', sifre: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body.basarili).toBe(true);
    expect(res.body.kullanici.rol).toBe(Role.ADMIN);
  });

  test('Hatalı API girişi 401 dönmeli', async () => {
    const res = await request(app)
      .post('/api/auth/giris')
      .send({ kullanici_adi: 'admin', sifre: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.basarili).toBe(false);
  });

  test('Çıkış API testi', async () => {
    const res = await request(app).post('/api/auth/cikis');
    expect(res.status).toBe(200);
    expect(res.body.basarili).toBe(true);
  });
});
