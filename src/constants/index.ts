export enum Role {
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR'
}

export enum Responsibility {
  DAHILI = 'DAHILI',
  TASERON = 'TASERON'
}

export enum DeviceType {
  TURNIKE = 'TURNIKE',
  IADE_VALIDATORU = 'IADE_VALIDATORU',
  KIOSK = 'KIOSK',
  SERBEST_KAPI = 'SERBEST_KAPI'
}

export const DEVICE_SHORT_CODES: Record<string, string> = {
  [DeviceType.TURNIKE]: 'TRN',
  [DeviceType.IADE_VALIDATORU]: 'IAD',
  [DeviceType.KIOSK]: 'KSK',
  [DeviceType.SERBEST_KAPI]: 'KAP'
};

export const DEVICE_LABELS: Record<string, string> = {
  [DeviceType.TURNIKE]: 'Turnike',
  [DeviceType.IADE_VALIDATORU]: 'İade Validatörü',
  [DeviceType.KIOSK]: 'İstasyon Kiosku',
  [DeviceType.SERBEST_KAPI]: 'Serbest Geçiş Kapısı'
};

export function getDeviceShortCode(devType: string): string {
  return DEVICE_SHORT_CODES[devType] || 'DEV';
}

export enum DeviceStatus {
  NORMAL = 'NORMAL',
  ARIZALI = 'ARIZALI',
  BAKIMDA = 'BAKIMDA',
  KAPALI = 'KAPALI'
}

export enum FaultStatus {
  BEKLIYOR = 'BEKLIYOR',
  ISLEMDE = 'ISLEMDE',
  COZULDU = 'COZULDU'
}

export enum PriorityLevel {
  ACIL = 'ACIL',
  YUKSEK = 'YUKSEK',
  ORTA = 'ORTA',
  DUSUK = 'DUSUK'
}

export interface PriorityInfo {
  puan: number;
  etiket: string;
  oncelik: PriorityLevel;
  aciklama: string;
}

export const PRIORITY_MATRIX: Record<string, PriorityInfo> = {
  TURNIKE_KACAK: {
    puan: 100,
    etiket: 'Turnike Kaçak Düştü (Enerji Yok)',
    oncelik: PriorityLevel.ACIL,
    aciklama: 'İstasyon girişi kilitlendi veya enerji kesintisi mevcut.'
  },
  KIOSK_ARIZASI: {
    puan: 90,
    etiket: 'Kiosk Dolum Arızası',
    oncelik: PriorityLevel.YUKSEK,
    aciklama: 'Kart dolum veya bilet alma ünitesi devre dışı.'
  },
  TURNIKE_ARIZASI: {
    puan: 50,
    etiket: 'Turnike Arızası',
    oncelik: PriorityLevel.ORTA,
    aciklama: 'Kart okuyucu veya mekanik kanat hatası.'
  },
  SERBEST_KAPI: {
    puan: 35,
    etiket: 'Serbest Kapı Arızası',
    oncelik: PriorityLevel.ORTA,
    aciklama: 'Engelli / Serbest geçiş kapısı manyetik kilidi arızalı.'
  },
  IADE_VALIDATORU: {
    puan: 20,
    etiket: 'İade Validatörü Arızası',
    oncelik: PriorityLevel.DUSUK,
    aciklama: 'Ücret iadesi validatör ekranı veya okuma hatası.'
  },
  GENEL: {
    puan: 40,
    etiket: 'Genel Donanım Arızası',
    oncelik: PriorityLevel.ORTA,
    aciklama: 'Genel pano veya donanım arızası.'
  }
};

export const LINE_COLORS: Record<string, string> = {
  T1: '#ef4444',
  T2: '#3b82f6',
  T3: '#10b981',
  T4: '#f97316'
};

export const LOCATION_ALIASES: Record<string, string> = {
  alparslan: 'alpaslan',
  alpaslan: 'alpaslan',
  alparslaniade: 'alpaslan iade',
  alpaslaniade: 'alpaslan iade',

  mimsin: 'mimarsinan kavsagi',
  mimarsinan: 'mimarsinan kavsagi',
  mimarsinankavsagi: 'mimarsinan kavsagi',
  mimarsinankavşağı: 'mimarsinan kavsagi',
  mimarsinankavsagiiad: 'mimarsinan kavsagi iade',
  mimarsinankavsagiiade: 'mimarsinan kavsagi iade',
  mimsiniade: 'mimarsinan kavsagi iade',

  organize: 'organize sanayi',
  organizesanayi: 'organize sanayi',
  organizesanayiiade: 'organize sanayi iade',
  orgsanayi: 'organize sanayi',
  'org sanayi': 'organize sanayi',

  kumarli: 'kumarli',
  kumarlı: 'kumarli',
  kumarliiade: 'kumarli iade',
  kumarlıiade: 'kumarli iade',
  kumarliiad: 'kumarli iade',

  psikiyatri: 'psikiyatri hastanesi',
  psikiyatrihastanesi: 'psikiyatri hastanesi',
  psikiyatriiade: 'psikiyatri hastanesi iade',
  psikiyatriiad: 'psikiyatri hastanesi iade',

  meydan: 'cumhuriyet meydani',
  cumhuriyetmeydani: 'cumhuriyet meydani',
  meydaniade: 'cumhuriyet meydani iade',

  duvenonu: 'duvenonu',
  düvenönü: 'duvenonu',
  duvenonuiade: 'duvenonu iade',

  erciyes: 'erciyes universitesi',
  erciyesuniversitesi: 'erciyes universitesi',
  erue: 'erciyes universitesi',
  fakulte: 'hastaneler',
  tipfakultesi: 'hastaneler',
  hastaneler: 'hastaneler',

  terminal: 'otogar',
  otogar: 'otogar',
  sehirlerarasiotogar: 'otogar',

  sehirhastanesi: 'sehir hastanesi',
  'sehir hastanesiiade': 'sehir hastanesi iade',

  talas: 'talas belediyesi',
  talasbelediyesi: 'talas belediyesi',
  talascemilbaba: 'talas cemil baba',

  buyuksehir: 'buyuksehir belediyesi',
  buyuksehirbelediyesi: 'buyuksehir belediyesi',

  anafartalar1: 'anafartalar',
  anafartalar2: 'anafartalar 2',
  mobilyakent1: 'mobilyakent 1',
  mobilyakent2: 'mobilyakent 2',
  ildem1: 'ildem 1',
  ildem2: 'ildem 2',
  ildem3: 'ildem 3',
  ildem4: 'ildem 4',
  ildem5: 'ildem 5',

  belsinkursu: 'belsin kursu',
  kursu: 'belsin kursu',
  kürsü: 'belsin kursu',

  harikalardiyari: 'harikalar diyari',
  cirgilan: 'cirgilan',
  gesikavsagi: 'gesi kavsagi',
  beyazsehir: 'beyazsehir',
  tokikavsagi: 'toki kavsagi',

  nuhnaci: 'nuh naci yazgan',
  nuhnaciyazgan: 'nuh naci yazgan',
  kumsmall: 'kumsmall avm',
  kumsmallavm: 'kumsmall avm',

  kizilay: 'kizilay kan merkezi',
  kizilaykanmerkezi: 'kizilay kan merkezi',
  yurtlar: 'yurtlar bolgesi',
  yurtlarbolgesi: 'yurtlar bolgesi',

  kayu: 'kayseri universitesi',
  kayseriuniversitesi: 'kayseri universitesi',
  halefhoca: 'halef hoca',
  anayurt: 'anayurt pazar yeri',
  anayurtpazaryeri: 'anayurt pazar yeri',

  dsi: 'dsi - yeni sanayi',
  yenisanayi: 'dsi - yeni sanayi',
  eskisanayi: 'eski sanayi',
  osmankavuncu: 'osman kavuncu',
  aydinlikevler: 'aydinlikevler',
  karayollari: 'karayollari',
  stadyum: 'stadyum',
  koprulukavsak: 'koprulu kavsak',
  yazibaglari: 'yazi baglari',

  mustafasimsek: 'sehit mustafa simsek',
  sehitmustafasimsek: 'sehit mustafa simsek',
  furkandogan: 'sehit furkan dogan',
  sehitfurkandogan: 'sehit furkan dogan',

  semayazar: 'sema yazar parki',
  erciyesevler: 'erciyes evler',
  ciftekumbet: 'cifte kumbet',
  yildizevler: 'yildiz evler',
  doguterminali: 'dogu terminali',
  gokkent: 'gokkent',
  ahievran: 'ahi evran',
  hastanekonutlari: 'hastane konutlari',
  hurdacilar: 'hurdacilar',
  fenlisesi: 'fen lisesi',
  yildirimbeyazit: 'yildirim beyazit',
  kecitepesi: 'kecitepesi',
  dedeman: 'dedeman ihl',
  dedemanihl: 'dedeman ihl',
  dedemanimamhatip: 'dedeman ihl',
  dedemanimamhatiplisesi: 'dedeman ihl',
  'dedeman imam hatip lisesi': 'dedeman ihl',
  germiralti: 'germiralti',
  turgutozal: 'turgut ozal',
  izzetbayraktar: 'izzet bayraktar camii'
};
