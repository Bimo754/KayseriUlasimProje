import { getDb } from '../database/db';

export interface StationNode {
  id: number;
  kod: string;
  ad: string;
  enlem: number;
  boylam: number;
  line_sira?: number;
  turnike_sayisi?: number;
  hat_kodu?: string;
}

export interface LineCorridor {
  hat_id: number;
  hat_kod: string;
  hat_ad: string;
  stations: StationNode[];
}

export class TopologyMapper {
  /**
   * Loads all active stations mapped into their respective line corridors sorted by hib.sira_no
   */
  public static loadLineCorridors(): LineCorridor[] {
    const db = getDb();
    const lines = db.prepare(`SELECT id, kod, ad FROM hatlar ORDER BY id`).all() as any[];
    const lineCorridors: LineCorridor[] = [];

    for (const line of lines) {
      const rawLineSt = db.prepare(`
        SELECT i.id, i.istasyon_kodu as kod, i.ad, i.enlem, i.boylam,
               hib.sira_no as line_sira,
               (SELECT COUNT(*) FROM cihazlar c WHERE c.istasyon_id = i.id AND c.cihaz_turu = 'TURNIKE') as turnike_sayisi,
               (SELECT GROUP_CONCAT(DISTINCT h2.kod) FROM hat_istasyon_baglantisi hib2 JOIN hatlar h2 ON hib2.hat_id = h2.id WHERE hib2.istasyon_id = i.id) as hat_kodu
        FROM istasyonlar i
        JOIN hat_istasyon_baglantisi hib ON i.id = hib.istasyon_id
        WHERE i.aktif = 1 AND i.enlem IS NOT NULL AND i.boylam IS NOT NULL AND hib.hat_id = ?
        ORDER BY hib.sira_no ASC
      `).all(line.id) as StationNode[];

      lineCorridors.push({
        hat_id: line.id,
        hat_kod: line.kod,
        hat_ad: line.ad,
        stations: rawLineSt
      });
    }
    return lineCorridors;
  }

  /**
   * Loads all active system stations
   */
  public static loadAllActiveStations(): StationNode[] {
    const db = getDb();
    return db.prepare(`
      SELECT i.id, i.istasyon_kodu as kod, i.ad, i.enlem, i.boylam,
             1 as line_sira,
             (SELECT COUNT(*) FROM cihazlar c WHERE c.istasyon_id = i.id AND c.cihaz_turu = 'TURNIKE') as turnike_sayisi,
             (SELECT GROUP_CONCAT(DISTINCT h2.kod) FROM hat_istasyon_baglantisi hib2 JOIN hatlar h2 ON hib2.hat_id = h2.id WHERE hib2.istasyon_id = i.id) as hat_kodu
      FROM istasyonlar i
      WHERE i.aktif = 1 AND i.enlem IS NOT NULL AND i.boylam IS NOT NULL
    `).all() as StationNode[];
  }
}
