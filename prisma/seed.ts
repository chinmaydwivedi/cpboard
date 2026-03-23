import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const pesu = await prisma.university.upsert({
    where: { shortName: "PESU" },
    update: {},
    create: {
      name: "PES University",
      shortName: "PESU",
      emailDomain: "pesu.pes.edu",
    },
  });

  console.log("Seeded university:", pesu.name, `(${pesu.shortName})`);
  console.log(`Email domain: @${pesu.emailDomain}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
