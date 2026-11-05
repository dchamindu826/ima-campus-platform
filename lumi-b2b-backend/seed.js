const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding mock students...');
  
  await prisma.mockStudent.deleteMany();

  const students = [
    { studentId: 'STU-001', name: 'Nimal Perera', subject: 'Mathematics', feeAmount: 2500 },
    { studentId: 'STU-002', name: 'Kamal Silva', subject: 'Science', feeAmount: 3000 },
    { studentId: 'STU-003', name: 'Amal Fernando', subject: 'English', feeAmount: 2000 },
    { studentId: 'STU-004', name: 'Sunil Jayasuriya', subject: 'ICT', feeAmount: 3500 },
    { studentId: 'STU-005', name: 'Saman Kumara', subject: 'History', feeAmount: 1500 },
  ];

  for (const s of students) {
    await prisma.mockStudent.create({ data: s });
  }

  console.log('Seed completed successfully.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
