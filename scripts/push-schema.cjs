require('dotenv').config({ path: '.env.local' });
const { execSync } = require('child_process');

// Strip surrounding quotes from env vars (some .env files wrap values in quotes)
const env = { ...process.env };
for (const key of ['DATABASE_URL', 'DATABASE_URL_UNPOOLED']) {
  if (env[key]) env[key] = env[key].replace(/^["']|["']$/g, '');
}

try {
  execSync('npx prisma db push', { env, encoding: 'utf8', stdio: 'inherit' });
} catch (e) {
  process.exit(1);
}
