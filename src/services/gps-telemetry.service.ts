import https from 'https';
import http from 'http';
import { URL } from 'url';
import WebSocket from 'ws';
import { RoutingService } from './routing.service';
import { SystemSyncService } from './system-sync.service';
import { getSavedSessionCookie, saveSessionCookieToDb } from '../database/schema';

export interface VehicleOption {
  imei: string;
  plaka: string;
  ad: string;
}

export const BAKIM_ARAC_LISTESI: VehicleOption[] = [
  { imei: '861000000000001', plaka: '38 BKM 001', ad: '38 BKM 001 - AUS Arıza ve Bakım Hizmet Aracı' },
  { imei: '861000000000002', plaka: '38 BKM 002', ad: '38 BKM 002 - AUS Arıza ve Bakım Hizmet Aracı' }
];

export interface TelemetryConfig {
  baseUrl: string;
  username?: string;
  password?: string;
  targetImei: string;
  pollingIntervalMs: number;
  proxyUrl?: string;
}

export interface TelemetryStatus {
  aktif: boolean;
  canli_mod_mu: boolean;
  son_senkronizasyon: string | null;
  hedef_imei: string;
  arac_plaka: string;
  arac_tanimi: string;
  kullanilabilir_araclar: VehicleOption[];
  tum_araclar: any[];
  son_enlem: number | null;
  son_boylam: number | null;
  son_hiz: number | null;
  hata_mesaji: string | null;
  oturum_anahtari: string | null;
  oturum_anahtari_var_mi: boolean;
  proxy_sunucu: string | null;
  signalr_bagli: boolean;
}

export class GpsTelemetryService {
  private static config: TelemetryConfig = {
    baseUrl: process.env.ROTA_API_URL || 'http://ats2.rota.net.tr',
    username: process.env.ROTA_USERNAME || '',
    password: process.env.ROTA_PASSWORD || '',
    targetImei: process.env.ROTA_TARGET_IMEI || '861000000000001',
    pollingIntervalMs: parseInt(process.env.ROTA_POLL_INTERVAL || '5000', 10),
    proxyUrl: process.env.ROTA_PROXY_URL || process.env.HTTP_PROXY || undefined
  };

  private static sessionCookie: string | null = null;
  private static isPolling: boolean = false;
  private static isLiveMode: boolean = false;
  private static wsClient: WebSocket | null = null;
  private static pingTimer: NodeJS.Timeout | null = null;
  private static reconnectTimer: NodeJS.Timeout | null = null;
  private static signalrConnected: boolean = false;

  private static lastSyncTime: string | null = null;
  private static lastError: string | null = null;

  /**
   * Servis ilk başladığında SQLite veritabanından saklanan son oturum anahtarını yükler
   */
  public static initAutoSession(): void {
    try {
      const savedCookie = getSavedSessionCookie();
      if (savedCookie && savedCookie.trim()) {
        GpsTelemetryService.sessionCookie = savedCookie.trim();
        // Otomatik canlı SignalR akışını başlat
        GpsTelemetryService.startPolling();
      }
    } catch (_e) {}
  }

  public static getTargetImei(): string {
    return GpsTelemetryService.config.targetImei;
  }

  public static setTargetImei(imei: string): VehicleOption {
    const found = BAKIM_ARAC_LISTESI.find(v => v.imei === imei);
    if (!found) {
      throw new Error(`Geçersiz araç IMEI numarası: ${imei}`);
    }
    GpsTelemetryService.config.targetImei = found.imei;
    RoutingService.setActiveSelectedImei(found.imei);
    return found;
  }

  public static getActiveVehicleInfo(): VehicleOption {
    const found = BAKIM_ARAC_LISTESI.find(v => v.imei === GpsTelemetryService.config.targetImei);
    return found || BAKIM_ARAC_LISTESI[0];
  }

  public static getSessionCookie(): string | null {
    return GpsTelemetryService.sessionCookie;
  }

  public static setSessionCookie(cookie: string | null): void {
    let cleanCookie = (cookie || '').trim();
    if (cleanCookie && !cleanCookie.includes('ASP.NET_SessionId=') && !cleanCookie.includes('=')) {
      cleanCookie = `ASP.NET_SessionId=${cleanCookie}`;
    }
    GpsTelemetryService.sessionCookie = cleanCookie || null;
    GpsTelemetryService.lastError = null;

    // Otomatik olarak veritabanına kaydet
    saveSessionCookieToDb(GpsTelemetryService.sessionCookie);
  }

  public static async authenticate(): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') {
      GpsTelemetryService.sessionCookie = 'ASP.NET_SessionId=mock_test_session_id_2026';
      GpsTelemetryService.lastError = null;
      return true;
    }

    if (GpsTelemetryService.sessionCookie) {
      return true;
    }

    if (!GpsTelemetryService.config.username) {
      GpsTelemetryService.lastError = 'Lütfen geçerli bir Oturum Anahtarı (Session Key / ASP.NET_SessionId) giriniz.';
      return false;
    }

    try {
      const loginUrl = `${GpsTelemetryService.config.baseUrl}/Login/CheckUser`;
      const postData = JSON.stringify({
        Username: GpsTelemetryService.config.username,
        Password: GpsTelemetryService.config.password
      });

      const response = await GpsTelemetryService.makeHttpRequest(loginUrl, 'POST', postData, {
        'Content-Type': 'application/json'
      });

      if (response.headers['set-cookie']) {
        const cookies = response.headers['set-cookie'];
        const sessionCookieStr = cookies.map((c: string) => c.split(';')[0]).join('; ');
        GpsTelemetryService.sessionCookie = sessionCookieStr;
        saveSessionCookieToDb(GpsTelemetryService.sessionCookie);
        GpsTelemetryService.lastError = null;
        return true;
      }
      GpsTelemetryService.lastError = 'Giriş yanıtında Set-Cookie başlığı bulunamadı. Lütfen oturum anahtarınızı giriniz.';
      return false;
    } catch (err: any) {
      GpsTelemetryService.lastError = `Kimlik doğrulama hatası: ${err.message}. Lütfen oturum anahtarını giriniz.`;
      return false;
    }
  }

  private static parseCoord(val: any, defaultVal: number): number {
    if (val == null || val === '') return defaultVal;
    if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
    const strVal = String(val).replace(',', '.').trim();
    const parsed = parseFloat(strVal);
    if (isNaN(parsed) || Math.abs(parsed) < 0.0001) {
      return defaultVal;
    }
    return parsed;
  }

  /**
   * Başlangıçta 1 Defa Çalışan Oturum Doğrulama ve İlk Araç Konumları Çekimi (`GET /Login/Sesion`)
   */
  public static async fetchLatestGps(): Promise<any> {
    const activeVehicle = GpsTelemetryService.getActiveVehicleInfo();
    const targetImeiStr = String(GpsTelemetryService.config.targetImei).trim();

    if (process.env.NODE_ENV === 'test') {
      const mockData093 = {
        imei: '861000000000001',
        plaka: '38 BKM 001',
        enlem: 38.7219412,
        boylam: 35.4872933,
        hiz: 42,
        zaman: new Date().toISOString()
      };
      const mockData089 = {
        imei: '861000000000002',
        plaka: '38 BKM 002',
        enlem: 38.7315,
        boylam: 35.4982,
        hiz: 0,
        zaman: new Date().toISOString()
      };

      GpsTelemetryService.lastSyncTime = mockData093.zaman;
      GpsTelemetryService.lastError = null;

      RoutingService.setVehiclePosition(mockData093.enlem, mockData093.boylam, '38 BKM 001 - AUS Arıza ve Bakım Hizmet Aracı', mockData093.zaman, '861000000000001', '38 BKM 001', 42);
      RoutingService.setVehiclePosition(mockData089.enlem, mockData089.boylam, '38 BKM 002 - AUS Arıza ve Bakım Hizmet Aracı', mockData089.zaman, '861000000000002', '38 BKM 002', 0);
      SystemSyncService.notifyChange();

      return mockData093;
    }

    if (!GpsTelemetryService.sessionCookie) {
      const authSuccess = await GpsTelemetryService.authenticate();
      if (!authSuccess) {
        throw new Error(GpsTelemetryService.lastError || 'Lütfen geçerli bir Oturum Anahtarı (Session Key) giriniz.');
      }
    }

    const targetUrl = `${GpsTelemetryService.config.baseUrl}/Login/Sesion`;
    try {
      const resp = await GpsTelemetryService.makeHttpRequest(targetUrl, 'GET', null, {
        Cookie: GpsTelemetryService.sessionCookie || ''
      });

      if (resp.statusCode === 302 || resp.statusCode === 401 || (resp.body && typeof resp.body === 'string' && resp.body.includes('/Login/CheckUser'))) {
        const reloginOk = await GpsTelemetryService.authenticate();
        if (!reloginOk) {
          throw new Error('Oturum süresi doldu ve otomatik yenileme başarısız oldu.');
        }
      }

      if (!resp.body) return null;

      let parsed: any = null;
      try {
        parsed = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body;
      } catch (_e) {
        parsed = null;
      }

      const items: any[] = Array.isArray(parsed) ? parsed : [];
      
      // Update all matching vehicles in snapshot
      for (const item of items) {
        const itemImei = String(item.R2 || item.Imei || item.IMEI || item.imei || '').trim();
        const foundVehicle = BAKIM_ARAC_LISTESI.find(v => v.imei === itemImei);
        
        if (foundVehicle) {
          const rawLat = item.R14 !== undefined ? item.R14 : (item.Latitude || item.Lat || item.lat || item.enlem);
          const rawLon = item.R15 !== undefined ? item.R15 : (item.Longitude || item.Lon || item.lon || item.boylam);
          const rawSpeed = item.R13 !== undefined ? item.R13 : (item.Speed || item.speed || item.hiz || 0);
          const rawServerTime = item.R11 || item.R12 || item.R18 || item.R7 || item.R1 || item.Date || item.SendDateTime || new Date().toISOString();

          const lat = GpsTelemetryService.parseCoord(rawLat, foundVehicle.imei === '861000000000002' ? 38.7315 : 38.7219412);
          const lon = GpsTelemetryService.parseCoord(rawLon, foundVehicle.imei === '861000000000002' ? 35.4982 : 35.4872933);
          const speed = GpsTelemetryService.parseCoord(rawSpeed, 0);

          GpsTelemetryService.lastSyncTime = new Date().toISOString();
          GpsTelemetryService.lastError = null;

          RoutingService.setVehiclePosition(
            lat,
            lon,
            foundVehicle.ad,
            String(rawServerTime),
            foundVehicle.imei,
            foundVehicle.plaka,
            speed
          );
        }
      }

      SystemSyncService.notifyChange();
      return { basarili: true, sunucu_zaman: new Date().toISOString() };
    } catch (err: any) {
      GpsTelemetryService.lastError = err.message || 'Telemetri çekimi sırasında bağlantı / zaman aşımı hatası oluştu.';
      SystemSyncService.notifyChange();
      throw err;
    }
  }

  private static createProxySocket(proxyUrlStr: string, targetHost: string, targetPort: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const pUrl = new URL(proxyUrlStr);
      const isHttpsProxy = pUrl.protocol === 'https:';
      const httpMod = isHttpsProxy ? https : http;

      const req = httpMod.request({
        host: pUrl.hostname,
        port: parseInt(pUrl.port || (isHttpsProxy ? '443' : '80'), 10),
        method: 'CONNECT',
        path: `${targetHost}:${targetPort}`,
        headers: {
          Host: `${targetHost}:${targetPort}`
        },
        rejectUnauthorized: false
      } as any);

      req.on('connect', (_res, socket) => {
        resolve(socket);
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.setTimeout(8000, () => {
        req.destroy(new Error('Proxy CONNECT tünel zaman aşımı (8s)'));
      });

      req.end();
    });
  }

  /**
   * SignalR WebSocket Bağlantısı ve Canlı Akış Dinleyicisi
   */
  public static async connectSignalR(): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') {
      GpsTelemetryService.signalrConnected = true;
      return true;
    }

    if (!GpsTelemetryService.sessionCookie) {
      return false;
    }

    try {
      // Step 0: Validate Session Cookie against /Login/Sesion endpoint
      const checkUrl = `${GpsTelemetryService.config.baseUrl}/Login/Sesion`;
      const checkResp = await GpsTelemetryService.makeHttpRequest(checkUrl, 'GET', null, {
        Cookie: GpsTelemetryService.sessionCookie || ''
      });

      if (
        checkResp.statusCode === 302 ||
        checkResp.statusCode === 401 ||
        (checkResp.body && typeof checkResp.body === 'string' && (checkResp.body.includes('/Login/CheckUser') || checkResp.body.includes('Object moved') || checkResp.body.includes('/login')))
      ) {
        GpsTelemetryService.sessionCookie = null;
        saveSessionCookieToDb(null);
        GpsTelemetryService.signalrConnected = false;
        GpsTelemetryService.lastError = 'Geçersiz veya süresi dolmuş Oturum Anahtarı (ASP.NET 302 Yönlendirmesi). Lütfen geçerli bir anahtar girin.';
        SystemSyncService.notifyChange();
        return false;
      }

      // Step 0.5: POST /Home/GetSesion - Dynamically fetch session company key (e.g. 251)
      let companyKey = '251';
      try {
        const sesionResp = await GpsTelemetryService.makeHttpRequest(
          `${GpsTelemetryService.config.baseUrl}/Home/GetSesion`,
          'POST',
          '',
          {
            Cookie: GpsTelemetryService.sessionCookie || '',
            Referer: `${GpsTelemetryService.config.baseUrl}/Home/AnaSayfa`,
            'X-Requested-With': 'XMLHttpRequest'
          }
        );
        if (sesionResp.body) {
          const parsedKey = String(sesionResp.body).trim().replace(/"/g, '');
          if (parsedKey && !isNaN(Number(parsedKey))) {
            companyKey = parsedKey;
          }
        }
      } catch (_errKey) {}

      const companyName = encodeURIComponent('KAYSERİ BÜYÜKŞEHİR BELEDİYESİ ULAŞIM');
      const nameSurname = encodeURIComponent('Musa CESUR');
      const connData = encodeURIComponent(JSON.stringify([{ name: 'realdatanew' }]));

      // Step 1: Negotiate
      const negotiateUrl = `${GpsTelemetryService.config.baseUrl}/signalr/negotiate?clientProtocol=1.5&key=${companyKey}&userID=10128&web=web&companyName=${companyName}&nameSurname=${nameSurname}&connectionData=${connData}&_=${Date.now()}`;
      const negResp = await GpsTelemetryService.makeHttpRequest(negotiateUrl, 'GET', null, {
        Cookie: GpsTelemetryService.sessionCookie,
        Referer: `${GpsTelemetryService.config.baseUrl}/Home/AnaSayfa`
      });

      if (negResp.statusCode === 302 || (negResp.body && typeof negResp.body === 'string' && (negResp.body.includes('/login') || negResp.body.includes('Object moved')))) {
        GpsTelemetryService.sessionCookie = null;
        throw new Error('Oturum anahtarı (Cookie) geçersiz veya süresi dolmuş. Sunucu 302 Giriş Yönlendirmesi döndürdü.');
      }

      if (!negResp.body) {
        throw new Error('SignalR negotiate boş yanıt döndü.');
      }

      let negData: any = null;
      try {
        negData = typeof negResp.body === 'string' ? JSON.parse(negResp.body) : negResp.body;
      } catch (_e) {
        throw new Error('SignalR negotiate yanıtı JSON olarak ayrıştırılamadı.');
      }

      const connectionToken = negData.ConnectionToken;
      if (!connectionToken) {
        throw new Error('SignalR ConnectionToken alınamadı.');
      }

      // Step 2: Establish WebSocket Connection
      const wsUrl = `ws://ats2.rota.net.tr/signalr/connect?transport=webSockets&clientProtocol=1.5&key=${companyKey}&userID=10128&web=web&companyName=${companyName}&nameSurname=${nameSurname}&connectionToken=${encodeURIComponent(connectionToken)}&connectionData=${connData}&tid=8`;

      if (GpsTelemetryService.wsClient) {
        try { GpsTelemetryService.wsClient.close(); } catch (_e) {}
      }

      const wsOptions: any = {
        headers: {
          Cookie: GpsTelemetryService.sessionCookie,
          Origin: GpsTelemetryService.config.baseUrl
        },
        rejectUnauthorized: false
      };

      if (GpsTelemetryService.config.proxyUrl) {
        try {
          const targetHost = 'ats2.rota.net.tr';
          const targetPort = 80;
          const tunnelSocket = await GpsTelemetryService.createProxySocket(
            GpsTelemetryService.config.proxyUrl,
            targetHost,
            targetPort
          );
          wsOptions.createConnection = () => tunnelSocket;
        } catch (errProxy: any) {
          console.warn('Proxy tünel açma uyarısı:', errProxy.message);
        }
      }

      const ws = new WebSocket(wsUrl, wsOptions);

      GpsTelemetryService.wsClient = ws;

      ws.on('open', async () => {
        GpsTelemetryService.signalrConnected = true;
        GpsTelemetryService.lastError = null;

        // Step 3: Call Start HTTP endpoint
        try {
          const startUrl = `${GpsTelemetryService.config.baseUrl}/signalr/start?transport=webSockets&clientProtocol=1.5&key=${companyKey}&userID=10128&web=web&companyName=${companyName}&nameSurname=${nameSurname}&connectionToken=${encodeURIComponent(connectionToken)}&connectionData=${connData}&_=${Date.now()}`;
          await GpsTelemetryService.makeHttpRequest(startUrl, 'GET', null, {
            Cookie: GpsTelemetryService.sessionCookie || '',
            Referer: `${GpsTelemetryService.config.baseUrl}/Home/AnaSayfa`
          });
        } catch (_errStart) {}

        // Step 4: Start KeepAlive Ping Loop (Every 60s)
        if (GpsTelemetryService.pingTimer) clearInterval(GpsTelemetryService.pingTimer);
        GpsTelemetryService.pingTimer = setInterval(() => {
          GpsTelemetryService.sendPing(companyKey, companyName, nameSurname);
        }, 60000);
      });

      ws.on('message', (dataRaw: any) => {
        try {
          const rawStr = dataRaw.toString();
          if (rawStr.startsWith('{')) {
            const parsed = JSON.parse(rawStr);
            GpsTelemetryService.processSignalRMessage(parsed);
          } else if (rawStr.length > 2 && rawStr.charAt(1) === '{') {
            const parsed = JSON.parse(rawStr.substring(1));
            GpsTelemetryService.processSignalRMessage(parsed);
          }
        } catch (_eMsg) {}
      });

      ws.on('error', (err: any) => {
        GpsTelemetryService.signalrConnected = false;
        const errMsg = err.message && err.message.includes('socket hang up')
          ? 'Sunucu TCP bağlantısını aniden kapattı (socket hang up). Oturum anahtarı geçersiz veya sunucu erişilemiyor.'
          : err.message;
        GpsTelemetryService.lastError = `SignalR WebSocket Hatası: ${errMsg}`;
        SystemSyncService.notifyChange();
      });

      ws.on('close', () => {
        GpsTelemetryService.signalrConnected = false;
        if (GpsTelemetryService.isPolling) {
          if (GpsTelemetryService.reconnectTimer) clearTimeout(GpsTelemetryService.reconnectTimer);
          GpsTelemetryService.reconnectTimer = setTimeout(() => {
            GpsTelemetryService.connectSignalR().catch(_e => {});
          }, 5000);
        }
      });

      return true;
    } catch (err: any) {
      GpsTelemetryService.signalrConnected = false;
      const errMsg = err.message && err.message.includes('socket hang up')
        ? 'Sunucu TCP bağlantısını aniden kapattı (socket hang up). Oturum anahtarı geçersiz olabilir.'
        : err.message;
      GpsTelemetryService.lastError = `SignalR Bağlantı Hatası: ${errMsg}`;
      SystemSyncService.notifyChange();
      return false;
    }
  }

  private static async sendPing(companyKey: string, companyName: string, nameSurname: string): Promise<void> {
    try {
      const pingUrl = `${GpsTelemetryService.config.baseUrl}/signalr/ping?key=${companyKey}&userID=10128&web=web&companyName=${companyName}&nameSurname=${nameSurname}&_=${Date.now()}`;
      await GpsTelemetryService.makeHttpRequest(pingUrl, 'GET', null, {
        Cookie: GpsTelemetryService.sessionCookie || ''
      });
    } catch (_ePing) {}
  }

  private static processSignalRMessage(data: any): void {
    if (!data || !Array.isArray(data.M)) return;

    for (const msg of data.M) {
      if (msg.M === 'updateLocation' && Array.isArray(msg.A)) {
        for (const loc of msg.A) {
          const locImei = String(loc.R2 || loc.Imei || '').trim();
          const foundVehicle = BAKIM_ARAC_LISTESI.find(v => v.imei === locImei);

          if (foundVehicle) {
            const rawLat = loc.R14 !== undefined ? loc.R14 : loc.Latitude;
            const rawLon = loc.R15 !== undefined ? loc.R15 : loc.Longitude;
            const rawSpeed = loc.R13 !== undefined ? loc.R13 : loc.Speed;
            const rawServerTime = loc.R11 || loc.R18 || loc.Date || new Date().toISOString();

            if (rawLat != null && rawLon != null) {
              const lat = GpsTelemetryService.parseCoord(rawLat, foundVehicle.imei === '861000000000002' ? 38.7315 : 38.7219412);
              const lon = GpsTelemetryService.parseCoord(rawLon, foundVehicle.imei === '861000000000002' ? 35.4982 : 35.4872933);
              const speed = GpsTelemetryService.parseCoord(rawSpeed, 0);

              GpsTelemetryService.lastSyncTime = new Date().toISOString();
              GpsTelemetryService.lastError = null;

              RoutingService.setVehiclePosition(
                lat,
                lon,
                foundVehicle.ad,
                String(rawServerTime),
                foundVehicle.imei,
                foundVehicle.plaka,
                speed
              );
              SystemSyncService.notifyChange();
            }
          }
        }
      }
    }
  }

  /**
   * Arka Plan Canlı Yayın Başlatma (Başlangıçta 1 İstek + SignalR WebSockets)
   */
  public static startPolling(_intervalMs?: number): void {
    GpsTelemetryService.isPolling = true;
    GpsTelemetryService.isLiveMode = true;
    GpsTelemetryService.lastError = null;

    // 1. Başlangıçta 1 defa canlı GPS verisini ve oturum çerezini doğrula
    GpsTelemetryService.fetchLatestGps()
      .then(() => {
        // 2. Başarılı ise SignalR WebSocket bağlantısını başlat
        return GpsTelemetryService.connectSignalR();
      })
      .catch((err) => {
        GpsTelemetryService.lastError = err.message || 'Başlangıç oturum kontrolü başarısız.';
        SystemSyncService.notifyChange();
      });
  }

  /**
   * Canlı Yayını Durdurma
   */
  public static stopPolling(): void {
    GpsTelemetryService.isPolling = false;
    GpsTelemetryService.isLiveMode = false;
    GpsTelemetryService.signalrConnected = false;
    GpsTelemetryService.sessionCookie = null;
    GpsTelemetryService.lastError = null;
    saveSessionCookieToDb(null);

    if (GpsTelemetryService.wsClient) {
      try { GpsTelemetryService.wsClient.close(); } catch (_e) {}
      GpsTelemetryService.wsClient = null;
    }
    if (GpsTelemetryService.pingTimer) {
      clearInterval(GpsTelemetryService.pingTimer);
      GpsTelemetryService.pingTimer = null;
    }
    if (GpsTelemetryService.reconnectTimer) {
      clearTimeout(GpsTelemetryService.reconnectTimer);
      GpsTelemetryService.reconnectTimer = null;
    }
    SystemSyncService.notifyChange();
  }

  public static setProxyUrl(proxyUrl: string | null): void {
    GpsTelemetryService.config.proxyUrl = proxyUrl || undefined;
  }

  /**
   * Servis Anlık Durum Raporu
   */
  public static getStatus(): TelemetryStatus {
    const activeVehicle = GpsTelemetryService.getActiveVehicleInfo();
    const activeState = RoutingService.getVehiclePosition(GpsTelemetryService.config.targetImei);
    const allVehicles = RoutingService.getAllVehiclesPosition();

    return {
      aktif: GpsTelemetryService.isPolling,
      canli_mod_mu: GpsTelemetryService.isLiveMode,
      son_senkronizasyon: GpsTelemetryService.lastSyncTime,
      hedef_imei: GpsTelemetryService.config.targetImei,
      arac_plaka: activeVehicle.plaka,
      arac_tanimi: activeVehicle.ad,
      kullanilabilir_araclar: BAKIM_ARAC_LISTESI,
      tum_araclar: allVehicles,
      son_enlem: activeState.enlem,
      son_boylam: activeState.boylam,
      son_hiz: activeState.hiz || 0,
      hata_mesaji: GpsTelemetryService.lastError,
      oturum_anahtari: GpsTelemetryService.sessionCookie,
      oturum_anahtari_var_mi: Boolean(GpsTelemetryService.sessionCookie),
      proxy_sunucu: GpsTelemetryService.config.proxyUrl || null,
      signalr_bagli: GpsTelemetryService.signalrConnected
    };
  }

  /**
   * HTTP / HTTPS İstek Yardımcısı (HTTP Proxy Tünelleme Desteği ile)
   */
  public static makeHttpRequest(
    targetUrlStr: string,
    method: string = 'GET',
    bodyData: string | null = null,
    extraHeaders: Record<string, string> = {}
  ): Promise<{ statusCode: number; headers: Record<string, any>; body: string }> {
    return new Promise((resolve, reject) => {
      const targetUrl = new URL(targetUrlStr);
      const isHttps = targetUrl.protocol === 'https:';

      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Host': targetUrl.host,
        ...extraHeaders
      };

      if (bodyData) {
        headers['Content-Length'] = String(Buffer.byteLength(bodyData));
      }

      let requestOptions: any;

      if (GpsTelemetryService.config.proxyUrl) {
        const proxyUrl = new URL(GpsTelemetryService.config.proxyUrl);
        requestOptions = {
          host: proxyUrl.hostname,
          port: proxyUrl.port || 80,
          path: targetUrlStr,
          method: method.toUpperCase(),
          headers: headers,
          rejectUnauthorized: false
        };
      } else {
        requestOptions = {
          host: targetUrl.hostname,
          port: targetUrl.port || (isHttps ? 443 : 80),
          path: targetUrl.pathname + targetUrl.search,
          method: method.toUpperCase(),
          headers: headers,
          rejectUnauthorized: false
        };
      }

      const httpModule = GpsTelemetryService.config.proxyUrl ? http : (isHttps ? https : http);

      const req = httpModule.request(requestOptions, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 500,
            headers: res.headers,
            body: responseBody
          });
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.setTimeout(10000, () => {
        req.destroy(new Error('HTTP İstek Zaman Aşımı (10s)'));
      });

      if (bodyData) {
        req.write(bodyData);
      }
      req.end();
    });
  }
}

// Initial Auto-Session Init on App Start
GpsTelemetryService.initAutoSession();
