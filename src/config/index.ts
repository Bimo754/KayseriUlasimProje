import path from 'path';

export const BASE_DIR = path.resolve(__dirname, '..', '..');

export const Config = {
  SECRET_KEY: process.env.SECRET_KEY || 'kayseri-ulasim-staj-gizli-anahtar-2026',
  PORT: parseInt(process.env.PORT || '5001', 10),
  DATA_DIR: path.join(BASE_DIR, 'data'),
  DB_PATH: process.env.DB_PATH || (process.env.NODE_ENV === 'test' ? path.join(BASE_DIR, 'data', 'test_kayseri_ulasim.db') : path.join(BASE_DIR, 'data', 'kayseri_ulasim.db')),
  JSON_DATA_PATH: path.join(BASE_DIR, 'data', 'kayseri_ulasim_data.json'),
  ANA_US_LAT: 38.71425,
  ANA_US_LON: 35.491111,
};
