import express from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { Config, BASE_DIR } from './config';
import { initDatabase, populateDatabaseFromJson } from './database/schema';
import { authRouter } from './routes/auth.routes';
import { mainRouter } from './routes/main.routes';
import { inventoryRouter } from './routes/inventory.routes';
import { deviceRouter } from './routes/device.routes';
import { routingRouter } from './routes/routing.routes';
import { reportRouter } from './routes/report.routes';
import { maintenanceRouter } from './routes/maintenance.routes';

export function createApp() {
  // Ensure database exists and is seeded
  if (!fs.existsSync(Config.DB_PATH)) {
    initDatabase();
    populateDatabaseFromJson();
  } else {
    initDatabase();
  }

  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(
    session({
      secret: Config.SECRET_KEY,
      resave: false,
      saveUninitialized: true,
      cookie: { maxAge: 24 * 60 * 60 * 1000 }
    })
  );

  // Serve static assets from app/static
  const staticDir = path.join(BASE_DIR, 'app', 'static');
  app.use('/static', express.static(staticDir));

  // Register Routes
  app.use('/api/auth', authRouter);
  app.use('/api', inventoryRouter);
  app.use('/api', deviceRouter);
  app.use('/api', routingRouter);
  app.use('/api/raporlar', reportRouter);
  app.use('/api/bakim', maintenanceRouter);
  app.use('/', mainRouter);

  return app;
}

if (require.main === module) {
  const app = createApp();
  const port = Config.PORT;
  app.listen(port, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`Kayseri Ulaşım - RouteOptimization Portalı Başlatıldı`);
    console.log(`Port: http://localhost:${port}`);
    console.log(`Stack: Node.js (TypeScript) + Express + Better-SQLite3`);
    console.log(`=======================================================`);
  });
}
