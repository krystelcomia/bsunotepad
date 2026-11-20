import { spawnSync } from 'node:child_process';

const env = { ...process.env };

// Remap Vercel's legacy npm_config_cache_dir / cache-dir env key to npm_config_cache
// so npm v11+ preserves the cache directory without emitting Unknown env config "cache-dir".
for (const key of Object.keys(env)) {
  const normalized = key.toLowerCase().replace(/-/g, '_');
  if (normalized === 'npm_config_cache_dir') {
    if (env[key] && !env.npm_config_cache && !env.NPM_CONFIG_CACHE) {
      env.npm_config_cache = env[key];
    }
    delete env[key];
  }
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const extraArgs = process.argv.slice(2);
const args = extraArgs.length > 0 ? extraArgs : ['install'];

const res = spawnSync(npmCmd, args, {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

if (res.error) {
  console.error(res.error);
  process.exit(1);
}

process.exit(res.status ?? 1);
