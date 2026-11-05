const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const phone = '0000000000';
  const password = '123456';

  const hashedPassword = await bcrypt.hash(password, 10);

  const adminUser = await prisma.user.upsert({
    where: { phone: phone },
    update: {
      password: hashedPassword,
      // මෙතන නම Schema එකේ තියෙන විදිහටම දෙන්න ඕනේ (බොහෝදුරට SYSTEM_ADMIN)
      role: 'SYSTEM_ADMIN',
    },
    create: {
      firstName: 'Chamindu',
      lastName: 'Dilshan',
      phone: phone,
      nic: '000000050V',
      password: hashedPassword,
      // මෙතනත් ඒ නමම දෙන්න
      role: 'SYSTEM_ADMIN',
    },
  });

  console.log('✅ Admin User Created Successfully!');
  console.log('📱 Phone:', adminUser.phone);
  console.log('🔑 Role:', adminUser.role);
}

main()
  .catch((e) => {
    console.error('❌ Error creating Admin User:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });