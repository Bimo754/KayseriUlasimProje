import { getDb } from '../database/db';
import { PRIORITY_MATRIX, LOCATION_ALIASES, Responsibility, FaultStatus } from '../constants';

export class FaultService {
  private static TURKISH_SUFFIXES = [
    /'[n|d]da$/i, /'[n|d]de$/i, /'[n|d]ta$/i, /'[n|d]te$/i,
    /ndaki$/i, /ndeki$/i, /daki$/i, /deki$/i, /taki$/i, /teki$/i,
    /'nda$/i, /'nde$/i, /'dan$/i, /'den$/i, /'tan$/i, /'ten$/i,
    /ndan$/i, /nden$/i, /dan$/i, /den$/i, /tan$/i, /ten$/i,
    /da$/i, /de$/i, /ta$/i, /te$/i, /ya$/i, /ye$/i, /na$/i, /ne$/i,
    /nin$/i, /nın$/i, /nun$/i, /nün$/i, /in$/i, /ın$/i, /un$/i, /ün$/i,
    /'e$/i, /'a$/i
  ];

  public static normalizeTr(text: string): string {
    if (!text) return '';
    let tr = text
      .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
      .replace(/Ş/g, 's').replace(/ş/g, 's')
      .replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
      .replace(/Ü/g, 'u').replace(/ü/g, 'u')
      .replace(/Ö/g, 'o').replace(/ö/g, 'o')
      .replace(/Ç/g, 'c').replace(/ç/g, 'c')
      .toLowerCase();

    return tr
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s_\-]/g, ' ');
  }

  public static stripTurkishSuffixes(word: string): string {
    let clean = word;
    for (const suf of FaultService.TURKISH_SUFFIXES) {
      clean = clean.replace(suf, '');
    }
    return clean;
  }

  public static cleanFaultDescription(rawText: string, matchedLocName?: string): string {
    if (!rawText || !rawText.trim()) return 'Arıza kaydı';

    let text = rawText.trim();

    // 1. Pipe-separated format (e.g., 414 | Dedeman İmam Hatip Lisesi | veri aktivite hatası)
    if (text.includes('|')) {
      const parts = text.split('|').map(p => p.trim()).filter(p => p.length > 0);
      if (parts.length >= 3 && parts[2]) {
        text = parts[2];
      } else if (parts.length >= 2 && parts[1]) {
        text = parts[1];
      }
    }

    // 2. Build set of location words to strip out
    const wordsToStrip = new Set<string>();

    [
      'istasyonunda', 'istasyonundaki', 'istasyonu', 'istasyon', 'ist',
      'durağında', 'duraginda', 'durağı', 'duragi', 'durak',
      'kioskunda', 'kiosku', 'kiosk', 'otomat', 'otomatı',
      'bayi', 'bayii', 'bayisi'
    ].forEach(w => wordsToStrip.add(FaultService.normalizeTr(w)));

    if (matchedLocName) {
      const normLoc = FaultService.normalizeTr(matchedLocName);
      normLoc.split(/\s+/).forEach(w => {
        if (w.length >= 3 && !['istasyon', 'istasyonu', 'kiosk', 'bayi'].includes(w)) {
          wordsToStrip.add(w);
        }
      });

      for (const [aliasKey, aliasVal] of Object.entries(LOCATION_ALIASES)) {
        const normAliasVal = FaultService.normalizeTr(aliasVal);
        const normAliasKey = FaultService.normalizeTr(aliasKey);
        const firstWord = normLoc.split(' ')[0];
        if (normLoc.includes(normAliasVal) || normAliasVal.includes(firstWord) || normAliasKey.includes(firstWord)) {
          wordsToStrip.add(normAliasKey);
        }
      }
    }

    const tokens = text.split(/\s+/);
    const filteredTokens: string[] = [];

    for (const t of tokens) {
      const normT = FaultService.normalizeTr(t);
      const strippedT = FaultService.stripTurkishSuffixes(normT);

      if (wordsToStrip.has(normT) || wordsToStrip.has(strippedT)) {
        continue;
      }
      filteredTokens.push(t);
    }

    let cleaned = filteredTokens.join(' ').replace(/^[\s,;\.\-:\+\|]+|[\s,;\.\-:\+\|]+$/g, '').trim();

    if (!cleaned || cleaned.length < 3) {
      return text;
    }

    return cleaned;
  }

  public static splitBulkText(rawText: string): string[] {
    if (!rawText || !rawText.trim()) return [];

    let text = rawText.trim();
    // 1. WhatsApp / Telegram timestamps
    text = text.replace(/(\[\d{1,2}:\d{2}(?:[,\.]\s*\d{1,2}[\./]\d{1,2}[\./]\d{2,4})?\])/g, '\n$1');
    text = text.replace(/(\b\d{1,2}:\d{2}\s*-\s*)/g, '\n$1');

    // 2. Semicolons
    text = text.replace(/[;]+/g, '\n');

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const finalStatements: string[] = [];

    const subPattern = /(arızalı|arizali|arızalandı|arizalandi|bozuk|bozuldu|çalışmıyor|calismiyor|hata veriyor|okumuyor|sıkıştı|sikisti|yanmıyor|yanmiyor|kapalı|kapali|kilitlendi|kilitli|bitti|kesildi|yanıt vermiyor)[\s,;\.]+(?=[A-Za-z0-9_ğüşıöçĞÜŞİÖÇ\-\s]+(?:istasyonunda|durağında|kioskunda|turnike|iade|kiosk|kapi)|\d+\s*[\.\-]?\s*(?:turnike|iade|kiosk|kapi|cihaz)|[A-Za-z0-9_ğüşıöçĞÜŞİÖÇ]{3,})/gi;

    for (const line of lines) {
      const splitLine = line.replace(subPattern, '$1\n');
      for (const part of splitLine.split('\n')) {
        const p = part.trim();
        if (p && p.length >= 3) {
          finalStatements.push(p);
        }
      }
    }

    return finalStatements;
  }

  public static getAllFaults(status: string = FaultStatus.BEKLIYOR): any[] {
    const db = getDb();
    let query = `
      SELECT 
          a.id, a.cihaz_id, a.kiosk_id, a.lokasyon_adi, a.ariza_metni,
          a.ariza_tipi, a.oncelik_puani, a.sorumluluk, a.durum,
          a.bildirim_zamani, a.cozum_zamani,
          c.cihaz_kodu, c.tur_etiket as cihaz_etiket, c.cihaz_turu,
          i.istasyon_kodu, i.ad as istasyon_adi, i.enlem as ist_enlem, i.boylam as ist_boylam, i.aktif as ist_aktif,
          k.kiosk_kodu, k.ad as kiosk_adi, k.enlem as ksk_enlem, k.boylam as ksk_boylam, k.adres as ksk_adres
      FROM arizalar a
      LEFT JOIN cihazlar c ON a.cihaz_id = c.id
      LEFT JOIN istasyonlar i ON c.istasyon_id = i.id
      LEFT JOIN otomatik_kiosklar k ON a.kiosk_id = k.id
    `;

    const params: any[] = [];
    if (status && status !== 'ALL') {
      query += ' WHERE a.durum = ?';
      params.push(status);
    }

    query += ' ORDER BY a.oncelik_puani DESC, a.bildirim_zamani ASC';

    const rows = db.prepare(query).all(...params) as any[];
    const allStations = db.prepare('SELECT id, ad, enlem, boylam FROM istasyonlar').all() as any[];
    const allKiosks = db.prepare('SELECT id, ad, enlem, boylam FROM otomatik_kiosklar').all() as any[];

    return rows.map(r => {
      let lat = r.ist_enlem != null ? r.ist_enlem : (r.ksk_enlem || 0.0);
      let lon = r.ist_boylam != null ? r.ist_boylam : (r.ksk_boylam || 0.0);

      // Fallback geographic coordinates resolution for unlinked manual faults
      if (!lat || !lon || lat === 0.0) {
        const normLoc = FaultService.normalizeTr(r.lokasyon_adi || '');
        const matchedSt = allStations.find(s => {
          const n = FaultService.normalizeTr(s.ad);
          return normLoc.includes(n) || n.includes(normLoc);
        });
        if (matchedSt) {
          lat = matchedSt.enlem;
          lon = matchedSt.boylam;
        } else {
          const matchedKsk = allKiosks.find(k => {
            const n = FaultService.normalizeTr(k.ad);
            return normLoc.includes(n) || n.includes(normLoc);
          });
          if (matchedKsk) {
            lat = matchedKsk.enlem;
            lon = matchedKsk.boylam;
          } else {
            lat = 38.724;
            lon = 35.487;
          }
        }
      }

      const locType = r.istasyon_kodu ? 'ISTASYON' : (r.kiosk_kodu ? 'KIOSK' : 'DIGER');
      const locAddress = r.ksk_adres || `Kayseri Tramvay Hattı (${r.istasyon_adi || r.lokasyon_adi})`;

      const isActiveStation = r.ist_aktif === null || r.ist_aktif === 1;
      const faultMeta = PRIORITY_MATRIX[r.ariza_tipi] || PRIORITY_MATRIX.GENEL;

      return {
        id: r.id,
        cihaz_id: r.cihaz_id,
        cihaz_kodu: r.cihaz_kodu,
        cihaz_etiket: r.cihaz_etiket,
        kiosk_id: r.kiosk_id,
        kiosk_kodu: r.kiosk_kodu,
        lokasyon_adi: r.lokasyon_adi,
        lokasyon_adresi: locAddress,
        lokasyon_tipi: locType,
        enlem: lat,
        boylam: lon,
        ariza_metni: r.ariza_metni,
        ariza_tipi: r.ariza_tipi,
        ariza_tipi_etiket: faultMeta.etiket,
        oncelik_seviyesi: faultMeta.oncelik,
        oncelik_puani: r.oncelik_puani,
        sorumluluk: r.sorumluluk,
        durum: r.durum,
        istasyon_aktif: isActiveStation,
        bildirim_zamani: r.bildirim_zamani,
        cozum_zamani: r.cozum_zamani
      };
    });
  }

  public static parseBulkText(rawText: string): any {
    if (!rawText || !rawText.trim()) {
      return { basarili: false, mesaj: 'Lütfen arıza metni giriniz.', eklenenler: [] };
    }

    const db = getDb();
    const stations = db.prepare('SELECT id, istasyon_kodu, ad FROM istasyonlar').all() as any[];
    const kiosks = db.prepare('SELECT id, kiosk_kodu, ad, adres FROM otomatik_kiosklar').all() as any[];

    const lines = FaultService.splitBulkText(rawText);
    const eklenenArizalar: any[] = [];

    const transaction = db.transaction(() => {
      for (const line of lines) {
        let cleanLine = line.trim();
        if (!line.includes('|')) {
          cleanLine = cleanLine.replace(/\[.*?\]|\(.*?\)/g, ' ');
          cleanLine = cleanLine.replace(/^\s*[\d\.\:\-\,\s\+]+:\s*/, '').trim();
          cleanLine = cleanLine.replace(/^[•\-\*\d\.\)]+\s*/, '').trim();
          if (!cleanLine) cleanLine = line.trim();
        }

        const processedLine = cleanLine.replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ]{3,})(iade|iad|turnike|trn|kiosk|ksk|kapi)\b/gi, '$1 $2');
        const normLine = FaultService.normalizeTr(processedLine);

        let expandedLine = normLine;
        for (const [aliasKey, aliasVal] of Object.entries(LOCATION_ALIASES)) {
          const normAliasKey = FaultService.normalizeTr(aliasKey);
          if (normLine.includes(normAliasKey)) {
            expandedLine += ` ${FaultService.normalizeTr(aliasVal)}`;
          }
        }

        const tokensRaw = normLine.split(/\s+/);
        const strippedTokens = tokensRaw.map(t => FaultService.stripTurkishSuffixes(t));
        expandedLine += ' ' + strippedTokens.join(' ');

        // 1. Location Matching
        let bestSt: any = null;
        let bestKsk: any = null;
        let bestStScore = 0;
        let bestKskScore = 0;

        for (const s of stations) {
          const normStName = FaultService.normalizeTr(s.ad);
          if (expandedLine.includes(normStName)) {
            const score = normStName.length * 12;
            if (score > bestStScore) {
              bestSt = { id: s.id, kod: s.istasyon_kodu, ad: s.ad };
              bestStScore = score;
            }
          } else {
            const stTokens = normStName.split(/\s+/).filter(t => t.length >= 3 && !['istasyon', 'istasyonu', 'kiosk'].includes(t));
            const matches = stTokens.filter(t => expandedLine.includes(t));
            if (matches.length > 0) {
              const score = matches.reduce((acc, curr) => acc + curr.length, 0) * 6;
              if (score > bestStScore) {
                bestSt = { id: s.id, kod: s.istasyon_kodu, ad: s.ad };
                bestStScore = score;
              }
            }
          }
        }

        for (const k of kiosks) {
          const normKName = FaultService.normalizeTr(k.ad);
          if (expandedLine.includes(normKName)) {
            const score = normKName.length * 12;
            if (score > bestKskScore) {
              bestKsk = { id: k.id, kod: k.kiosk_kodu, ad: k.ad };
              bestKskScore = score;
            }
          } else {
            const kTokens = normKName.split(/\s+/).filter(t => t.length >= 3 && !['kiosk', 'otomatik', 'kayseri'].includes(t));
            const matches = kTokens.filter(t => expandedLine.includes(t));
            if (matches.length > 0) {
              const score = matches.reduce((acc, curr) => acc + curr.length, 0) * 6;
              if (score > bestKskScore) {
                bestKsk = { id: k.id, kod: k.kiosk_kodu, ad: k.ad };
                bestKskScore = score;
              }
            }
          }
        }

        let targetSt: any = null;
        let targetKsk: any = null;
        const preferStation = ['istasyon', 'durak', 'turnike', 'iade', 'kapi'].some(w => normLine.includes(w));
        const preferKiosk = ['kiosk', 'otomat', 'dolum', 'bilet'].some(w => normLine.includes(w));

        if (preferStation && bestSt) {
          targetSt = bestSt;
        } else if (preferKiosk && bestKsk) {
          targetKsk = bestKsk;
        } else if (bestStScore >= bestKskScore && bestSt) {
          targetSt = bestSt;
        } else if (bestKsk) {
          targetKsk = bestKsk;
        } else if (bestSt) {
          targetSt = bestSt;
        }

        // 2. Fault Type & Responsibility
        let faultType = 'GENEL';
        let responsibility: string = Responsibility.DAHILI;

        if (['kacak', 'enerji yok', 'kilitli', 'enerjisiz', 'elekrik yok', 'elektrik kesik'].some(w => normLine.includes(w))) {
          faultType = 'TURNIKE_KACAK';
        } else if (['kaset dolu', 'para sikismasi', 'para sikisti', 'kaset doldu'].some(w => normLine.includes(w))) {
          faultType = 'KIOSK_ARIZASI';
          responsibility = Responsibility.TASERON;
        } else if (['kiosk', 'dolum', 'bilet', 'otomat', 'para kabul'].some(w => normLine.includes(w))) {
          faultType = 'KIOSK_ARIZASI';
        } else if (['iade', 'validator', 'iadecihaz', 'iad'].some(w => normLine.includes(w))) {
          faultType = 'IADE_VALIDATORU';
        } else if (['serbest', 'engelli', 'kapi'].some(w => normLine.includes(w))) {
          faultType = 'SERBEST_KAPI';
        } else if (['turnike', 'okuyucu', 'kanat', 'turnikesi', 'trn'].some(w => normLine.includes(w))) {
          faultType = 'TURNIKE_ARIZASI';
        }

        // 3. Device No
        let devNo = 1;
        let devNoMatch = cleanLine.match(/(\d+)\s*[\.\-]?\s*(?:nolu|no'lu|no)?\s*(?:turnike|iade|kiosk|kapi|cihaz)?/i);
        if (!devNoMatch || !devNoMatch[1]) {
          devNoMatch = cleanLine.match(/(?:turnike|iade|kiosk|kapi|cihaz)\s*(?:nolu|no'lu|no)?\s*[\.\-]?\s*(\d+)/i);
        }
        if (devNoMatch && devNoMatch[1]) {
          devNo = parseInt(devNoMatch[1], 10);
        }

        let matchedCihazId: number | null = null;
        let matchedKioskId: number | null = null;
        let locDisplayName = cleanLine;

        if (targetSt) {
          locDisplayName = `${targetSt.ad} İstasyonu`;
          let devDbType = 'TURNIKE';
          if (faultType === 'IADE_VALIDATORU') devDbType = 'IADE_VALIDATORU';
          else if (faultType === 'SERBEST_KAPI') devDbType = 'SERBEST_KAPI';
          else if (faultType === 'KIOSK_ARIZASI') devDbType = 'KIOSK';

          const devRow = db.prepare(
            'SELECT id FROM cihazlar WHERE istasyon_id=? AND cihaz_turu=? AND cihaz_no=?'
          ).get(targetSt.id, devDbType, devNo) as any;

          if (devRow) {
            matchedCihazId = devRow.id;
          } else {
            const devRowFirst = db.prepare(
              'SELECT id FROM cihazlar WHERE istasyon_id=? AND cihaz_turu=?'
            ).get(targetSt.id, devDbType) as any;
            if (devRowFirst) matchedCihazId = devRowFirst.id;
          }
        } else if (targetKsk) {
          matchedKioskId = targetKsk.id;
          locDisplayName = targetKsk.ad;
        }

        // 4. Save Fault
        const meta = PRIORITY_MATRIX[faultType] || PRIORITY_MATRIX.GENEL;
        const oncelikPuani = meta.puan;
        const finalArizaMetni = FaultService.cleanFaultDescription(cleanLine, locDisplayName);

        const info = db.prepare(`
          INSERT INTO arizalar (cihaz_id, kiosk_id, lokasyon_adi, ariza_metni, ariza_tipi, oncelik_puani, sorumluluk, durum)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'BEKLIYOR')
        `).run(matchedCihazId, matchedKioskId, locDisplayName, finalArizaMetni, faultType, oncelikPuani, responsibility);

        const faultId = info.lastInsertRowid;

        if (matchedCihazId) {
          db.prepare("UPDATE cihazlar SET durum='ARIZALI' WHERE id=?").run(matchedCihazId);
        }
        if (matchedKioskId) {
          db.prepare("UPDATE otomatik_kiosklar SET durum='ARIZALI' WHERE id=?").run(matchedKioskId);
        }

        eklenenArizalar.push({
          id: faultId,
          lokasyon_adi: locDisplayName,
          ariza_metni: finalArizaMetni,
          ariza_tipi: faultType,
          ariza_tipi_etiket: meta.etiket,
          oncelik_seviyesi: meta.oncelik,
          oncelik_puani: oncelikPuani,
          sorumluluk: responsibility
        });
      }
    });

    transaction();

    return {
      basarili: true,
      toplam_eklenen: eklenenArizalar.length,
      eklenenler: eklenenArizalar,
      mesaj: `${eklenenArizalar.length} adet arıza metinden başarıyla ayrıştırıldı ve sisteme işlendi.`
    };
  }

  public static addFault(
    lokasyonAdi: string,
    arizaMetni: string,
    arizaTipi = 'GENEL',
    cihazId?: number | null,
    kioskId?: number | null,
    sorumluluk: string = Responsibility.DAHILI
  ): number {
    const db = getDb();

    let finalCihazId = cihazId || null;
    let finalKioskId = kioskId || null;

    // Automatic location matching if cihazId / kioskId not provided
    if (!finalCihazId && !finalKioskId && lokasyonAdi) {
      const normLoc = FaultService.normalizeTr(lokasyonAdi);
      let expandedLoc = normLoc;
      for (const [aliasKey, aliasVal] of Object.entries(LOCATION_ALIASES)) {
        if (normLoc.includes(FaultService.normalizeTr(aliasKey))) {
          expandedLoc += ` ${FaultService.normalizeTr(aliasVal)}`;
        }
      }

      const stations = db.prepare('SELECT id, istasyon_kodu, ad FROM istasyonlar').all() as any[];
      const kiosks = db.prepare('SELECT id, kiosk_kodu, ad FROM otomatik_kiosklar').all() as any[];

      let bestSt: any = null;
      let bestStScore = 0;
      for (const s of stations) {
        const normStName = FaultService.normalizeTr(s.ad);
        if (expandedLoc.includes(normStName)) {
          const score = normStName.length * 12;
          if (score > bestStScore) {
            bestSt = s;
            bestStScore = score;
          }
        }
      }

      let bestKsk: any = null;
      let bestKskScore = 0;
      for (const k of kiosks) {
        const normKName = FaultService.normalizeTr(k.ad);
        if (expandedLoc.includes(normKName)) {
          const score = normKName.length * 12;
          if (score > bestKskScore) {
            bestKsk = k;
            bestKskScore = score;
          }
        }
      }

      if (bestStScore >= bestKskScore && bestSt) {
        let devType = 'TURNIKE';
        if (arizaTipi === 'IADE_VALIDATORU') devType = 'IADE_VALIDATORU';
        else if (arizaTipi === 'SERBEST_KAPI') devType = 'SERBEST_KAPI';

        const devRow = db.prepare('SELECT id FROM cihazlar WHERE istasyon_id=? AND cihaz_turu=? LIMIT 1').get(bestSt.id, devType) as any;
        if (devRow) finalCihazId = devRow.id;
      } else if (bestKsk) {
        finalKioskId = bestKsk.id;
      }
    }

    const meta = PRIORITY_MATRIX[arizaTipi] || PRIORITY_MATRIX.GENEL;
    const oncelikPuani = meta.puan;
    const finalArizaMetni = FaultService.cleanFaultDescription(arizaMetni, lokasyonAdi);

    let faultId = 0;
    const transaction = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO arizalar (cihaz_id, kiosk_id, lokasyon_adi, ariza_metni, ariza_tipi, oncelik_puani, sorumluluk, durum)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'BEKLIYOR')
      `).run(finalCihazId, finalKioskId, lokasyonAdi, finalArizaMetni, arizaTipi, oncelikPuani, sorumluluk);

      faultId = Number(info.lastInsertRowid);

      if (finalCihazId) {
        db.prepare("UPDATE cihazlar SET durum='ARIZALI' WHERE id=?").run(finalCihazId);
      }
      if (finalKioskId) {
        db.prepare("UPDATE otomatik_kiosklar SET durum='ARIZALI' WHERE id=?").run(finalKioskId);
      }
    });

    transaction();
    return faultId;
  }

  public static updateFaultStatus(faultId: number, newStatus: string): boolean {
    const db = getDb();
    const now = new Date();
    const formattedNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const cozumZamani = newStatus === FaultStatus.COZULDU ? formattedNow : null;

    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE arizalar 
        SET durum = ?, cozum_zamani = ?
        WHERE id = ?
      `).run(newStatus, cozumZamani, faultId);

      const fault = db.prepare('SELECT cihaz_id, kiosk_id FROM arizalar WHERE id=?').get(faultId) as any;
      if (fault) {
        if (newStatus === FaultStatus.COZULDU) {
          if (fault.cihaz_id) db.prepare("UPDATE cihazlar SET durum='NORMAL' WHERE id=?").run(fault.cihaz_id);
          if (fault.kiosk_id) db.prepare("UPDATE otomatik_kiosklar SET durum='NORMAL' WHERE id=?").run(fault.kiosk_id);
        } else if (newStatus === FaultStatus.BEKLIYOR) {
          if (fault.cihaz_id) db.prepare("UPDATE cihazlar SET durum='ARIZALI' WHERE id=?").run(fault.cihaz_id);
          if (fault.kiosk_id) db.prepare("UPDATE otomatik_kiosklar SET durum='ARIZALI' WHERE id=?").run(fault.kiosk_id);
        }
      }
    });

    transaction();
    return true;
  }

  public static deleteFault(faultId: number): boolean {
    const db = getDb();
    const fault = db.prepare('SELECT cihaz_id, kiosk_id FROM arizalar WHERE id=?').get(faultId) as any;
    if (!fault) return false;

    const transaction = db.transaction(() => {
      if (fault.cihaz_id) {
        const other = db.prepare("SELECT id FROM arizalar WHERE cihaz_id=? AND id!=? AND durum='BEKLIYOR'").all(fault.cihaz_id, faultId);
        if (other.length === 0) {
          db.prepare("UPDATE cihazlar SET durum='NORMAL' WHERE id=?").run(fault.cihaz_id);
        }
      }
      if (fault.kiosk_id) {
        const otherK = db.prepare("SELECT id FROM arizalar WHERE kiosk_id=? AND id!=? AND durum='BEKLIYOR'").all(fault.kiosk_id, faultId);
        if (otherK.length === 0) {
          db.prepare("UPDATE otomatik_kiosklar SET durum='NORMAL' WHERE id=?").run(fault.kiosk_id);
        }
      }
      db.prepare('DELETE FROM arizalar WHERE id=?').run(faultId);
    });

    transaction();
    return true;
  }

  public static toggleResponsibility(faultId: number): string | null {
    const db = getDb();
    const fault = db.prepare('SELECT sorumluluk FROM arizalar WHERE id=?').get(faultId) as any;
    if (!fault) return null;

    const newResp = fault.sorumluluk === Responsibility.DAHILI ? Responsibility.TASERON : Responsibility.DAHILI;
    db.prepare('UPDATE arizalar SET sorumluluk=? WHERE id=?').run(newResp, faultId);
    return newResp;
  }

  public static syncHardwareFaults(): number {
    const db = getDb();
    let syncedCount = 0;

    const transaction = db.transaction(() => {
      // 1. Sync faulty station devices in cihazlar
      const faultyDevices = db.prepare(`
        SELECT c.id, c.cihaz_kodu, c.cihaz_turu, c.cihaz_no, c.tur_etiket, c.sorumluluk, i.ad as istasyon_adi
        FROM cihazlar c
        JOIN istasyonlar i ON c.istasyon_id = i.id
        WHERE c.durum = 'ARIZALI'
      `).all() as any[];

      for (const dev of faultyDevices) {
        const existing = db.prepare('SELECT id FROM arizalar WHERE cihaz_id=? AND durum=?').get(dev.id, FaultStatus.BEKLIYOR);
        if (!existing) {
          let faultType = 'TURNIKE_ARIZASI';
          if (dev.cihaz_turu === 'IADE_VALIDATORU') faultType = 'IADE_VALIDATORU';
          else if (dev.cihaz_turu === 'SERBEST_KAPI') faultType = 'SERBEST_KAPI';

          const meta = PRIORITY_MATRIX[faultType] || PRIORITY_MATRIX.GENEL;
          const locName = `${dev.istasyon_adi} İstasyonu`;
          const desc = `${dev.cihaz_no}. ${dev.tur_etiket || 'Turnike'} Arızalı`;

          db.prepare(`
            INSERT INTO arizalar (cihaz_id, lokasyon_adi, ariza_metni, ariza_tipi, oncelik_puani, sorumluluk, durum)
            VALUES (?, ?, ?, ?, ?, ?, 'BEKLIYOR')
          `).run(dev.id, locName, desc, faultType, meta.puan, dev.sorumluluk || Responsibility.DAHILI);
          syncedCount++;
        }
      }

      // 2. Sync faulty kiosks in otomatik_kiosklar
      const faultyKiosks = db.prepare(`
        SELECT id, kiosk_kodu, ad, sorumluluk
        FROM otomatik_kiosklar
        WHERE durum = 'ARIZALI'
      `).all() as any[];

      for (const k of faultyKiosks) {
        const existing = db.prepare('SELECT id FROM arizalar WHERE kiosk_id=? AND durum=?').get(k.id, FaultStatus.BEKLIYOR);
        if (!existing) {
          const meta = PRIORITY_MATRIX.KIOSK_ARIZASI;
          const locName = k.ad;
          const desc = `Dolum Ünitesi Arızalı`;

          db.prepare(`
            INSERT INTO arizalar (kiosk_id, lokasyon_adi, ariza_metni, ariza_tipi, oncelik_puani, sorumluluk, durum)
            VALUES (?, ?, ?, ?, ?, ?, 'BEKLIYOR')
          `).run(k.id, locName, desc, 'KIOSK_ARIZASI', meta.puan, k.sorumluluk || Responsibility.DAHILI);
          syncedCount++;
        }
      }

      // 3. Auto-resolve active fault tickets for devices/kiosks restored to NORMAL status
      db.prepare(`
        UPDATE arizalar
        SET durum = 'COZULDU', cozum_zamani = CURRENT_TIMESTAMP
        WHERE durum = 'BEKLIYOR'
          AND (
            (cihaz_id IS NOT NULL AND cihaz_id IN (SELECT id FROM cihazlar WHERE durum = 'NORMAL'))
            OR
            (kiosk_id IS NOT NULL AND kiosk_id IN (SELECT id FROM otomatik_kiosklar WHERE durum = 'NORMAL'))
          )
      `).run();
    });

    transaction();
    return syncedCount;
  }
}

