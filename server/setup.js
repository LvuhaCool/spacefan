// Run once: node server/setup.js
// Prints the env vars you paste into Railway.
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { createInterface } from 'readline';

const rl = createInterface({ input: process.stdin, output: process.stdout });

rl.question('Придумайте пароль: ', (password) => {
  if (!password || password.length < 8) {
    console.error('Пароль должен быть не менее 8 символов.');
    process.exit(1);
  }

  const hash = bcrypt.hashSync(password, 12);

  console.log('\n─────────────────────────────────────────────');
  console.log('Скопируйте это в переменные окружения Railway:');
  console.log('─────────────────────────────────────────────\n');
  console.log(`PASSWORD_HASH=${hash}`);
  console.log(`NODE_ENV=production`);
  console.log(`YOUR_EMAIL=          ← ваш gmail`);
  console.log(`RESEND_API_KEY=      ← из resend.com`);
  console.log(`RESEND_FROM=Spacefan <onboarding@resend.dev>`);
  console.log('\n(PORT Railway выставит сам — не трогайте)\n');

  rl.close();
});
