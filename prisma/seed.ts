import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const universities = [
    { name: "PES University", shortName: "PESU", emailDomain: "pesu.pes.edu" },
    { name: "Dayananda Sagar University", shortName: "DSU", emailDomain: "dsu.edu.in" },
    { name: "Jain University", shortName: "JAIN", emailDomain: "jainuniversity.ac.in" },
  ];

  for (const university of universities) {
    const seeded = await prisma.university.upsert({
      where: { shortName: university.shortName },
      update: {
        name: university.name,
        emailDomain: university.emailDomain,
      },
      create: university,
    });

    console.log("Seeded university:", seeded.name, `(${seeded.shortName})`);
    console.log(`Email domain: @${seeded.emailDomain}`);
  }
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
