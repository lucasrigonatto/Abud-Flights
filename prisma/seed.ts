import { Prisma, PrismaClient } from "@prisma/client";
import { AIRPORTS } from "../src/lib/airports";

const prisma = new PrismaClient();

async function main() {
  const size = 400;
  for (let index = 0; index < AIRPORTS.length; index += size) {
    const slice = AIRPORTS.slice(index, index + size);
    const values = slice.map(
      (airport) =>
        Prisma.sql`(${airport.iata}, ${airport.name}, ${airport.city}, ${airport.country}, ${airport.latitude}, ${airport.longitude}, ${airport.timezone})`,
    );
    await prisma.$executeRaw`
      INSERT INTO "airports" ("iata", "name", "city", "country", "latitude", "longitude", "timezone")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("iata") DO UPDATE SET
        "name" = EXCLUDED."name",
        "city" = EXCLUDED."city",
        "country" = EXCLUDED."country",
        "latitude" = EXCLUDED."latitude",
        "longitude" = EXCLUDED."longitude",
        "timezone" = EXCLUDED."timezone"
    `;
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
