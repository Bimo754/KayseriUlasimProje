import { Router, Request, Response } from 'express';
import path from 'path';
import { BASE_DIR } from '../config';
import { SystemSyncService } from '../services/system-sync.service';

export const mainRouter = Router();

mainRouter.get('/', (_req: Request, res: Response) => {
  const templatePath = path.join(BASE_DIR, 'app', 'templates', 'index.html');
  res.sendFile(templatePath);
});

mainRouter.get('/api/sistem-surumu', (_req: Request, res: Response) => {
  res.json({ basarili: true, surum: SystemSyncService.getVersion() });
});

mainRouter.get('/api/canli-yayin', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let lastVersion: number | null = null;

  const intervalId = setInterval(() => {
    const currentVersion = SystemSyncService.getVersion();
    if (currentVersion !== lastVersion) {
      lastVersion = currentVersion;
      res.write(`data: {"surum": ${currentVersion}}\n\n`);
    } else {
      res.write(': keepalive\n\n');
    }
  }, 1500);

  req.on('close', () => {
    clearInterval(intervalId);
  });
});
