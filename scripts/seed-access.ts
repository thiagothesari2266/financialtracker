import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../server/db';

const PASSWORD_SALT_ROUNDS = 10;

const DEFAULT_USERS = [
  {
    label: 'Administrador',
    email: 'admin@nexfin.com.br',
    password: 'tmttx22ID@22',
    role: 'admin' as const,
  },
  {
    label: 'Usuario pessoal',
    email: 'thiagothesari@gmail.com',
    password: 'tmttx22ID',
    role: 'user' as const,
  },
];

const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%!';

function generatePassword(length = 12) {
  let result = '';
  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * PASSWORD_CHARS.length);
    result += PASSWORD_CHARS[index];
  }
  return result;
}

interface SeedResult {
  email: string;
  password: string;
  status: 'created' | 'skipped';
  note?: string;
}

async function upsertUser(
  email: string,
  password: string,
  role: 'admin' | 'user' = 'user'
): Promise<SeedResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existing) {
    return {
      email: normalizedEmail,
      password: '********',
      status: 'skipped',
      note: 'Usuário já existe',
    };
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
  await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      role,
    },
  });

  return {
    email: normalizedEmail,
    password,
    status: 'created',
  };
}

async function main() {
  console.log('🚀 Iniciando seed de acessos padrão...');
  const results: SeedResult[] = [];

  for (const user of DEFAULT_USERS) {
    const password =
      user.password && user.password.length >= 8 ? user.password : generatePassword();
    const result = await upsertUser(user.email, password, user.role ?? 'user');
    results.push(result);
  }

  console.log('\nResumo dos acessos:');
  results.forEach((result) => {
    if (result.status === 'created') {
      console.log(`✅ ${result.email} | senha: ${result.password}`);
    } else {
      console.log(`ℹ️  ${result.email} | ${result.note}`);
    }
  });
}

main()
  .catch((error) => {
    console.error('❌ Erro ao executar seed de acessos:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
