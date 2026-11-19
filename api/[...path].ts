import { createApp } from '../server/app.js';
import { getConfig } from '../server/config.js';

const config = getConfig();
const { app } = createApp(config, { seedDemo: true, serveStatic: false });

export default app;
