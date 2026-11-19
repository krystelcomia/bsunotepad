import { createApp } from './app.js';
import { getConfig } from './config.js';

const config = getConfig();
const { app, db } = createApp(config, { seedDemo: true });

const server = app.listen(config.port, () => {
  console.log(`INKORA server running at http://localhost:${config.port}`);
});

function shutdown() {
  server.close(() => {
    try {
      db.close();
    } catch {
      // ignore close errors
    }
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
