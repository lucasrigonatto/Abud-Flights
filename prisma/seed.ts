import { PrismaClient } from "@prisma/client";
import { AIRPORTS } from "../src/lib/airports";

const prisma = new PrismaClient();

async function main() {
  for (const airport of AIRPORTS) {
    await prisma.airport.upsert({
      where: { iata: airport.iata },
      create: {
        iata: airport.iata,
        name: airport.name,
        city: airport.city,
        country: airport.country,
        latitude: airport.latitude.toFixed(6),
        longitude: airport.longitude.toFixed(6),
        timezone: airport.timezone,
      },
      update: {
        name: airport.name,
        city: airport.city,
        country: airport.country,
        latitude: airport.latitude.toFixed(6),
        longitude: airport.longitude.toFixed(6),
        timezone: airport.timezone,
      },
    });
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
