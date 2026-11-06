import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dashboard, history, startScheduler } from './service.mjs';
import preview from '../config/preview.json' with { type: 'json' };

const app = express();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // GPT renders previews in an iframe. Permit its origins while keeping
  // unrelated sites from embedding the dashboard.
  res.setHeader('Content-Security-Policy', `frame-ancestors 'self' ${preview.frameAncestors.join(' ')}`);
  next();
});
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'satoshi', time: new Date().toISOString() }));
app.get('/api/dashboard', async (req, res) => {
  const mode = req.query.mode ?? 'live';
  if (!['live', 'demo'].includes(mode)) return res.status(400).json({ message: 'Mode tidak valid.' });
  try {
    const data = await dashboard(mode);
    res.setHeader('Cache-Control', 'no-store');
    res.status(data.unavailable ? 503 : 200).json(data);
  } catch (error) { res.status(502).json({ unavailable: true, message: `Analisis belum tersedia: ${error.message}` }); }
});
app.get('/api/history', async (req, res) => res.json({ reports: await history() }));
app.use('/api', (req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan.' }));
// A preview may select the API port. Serve the prepared build there too,
// while Vite on port 5173 continues to provide hot reload during development.
if (existsSync(path.join(root, 'dist/index.html'))) {
  app.use(express.static(path.join(root, 'dist')));
  app.get('/{*path}', (req, res) => res.sendFile(path.join(root, 'dist/index.html')));
} else {
  app.get('/{*path}', (req, res) => res.status(503).type('text/plain').send('Halaman belum dibangun. Jalankan npm run build, atau gunakan server pengembangan pada port 5173.'));
}
const port = Number(process.env.PORT || 3001);
const server = app.listen(port, '0.0.0.0', () => console.log(`Satoshi API siap pada port ${port}`));
const timer = process.env.DISABLE_SCHEDULER === '1' ? null : startScheduler();
function shutdown() { if (timer) clearInterval(timer); server.close(() => process.exit(0)); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
