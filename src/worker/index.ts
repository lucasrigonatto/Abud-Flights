import { prisma } from "../infra/prisma";
import { runDueMonitors } from "../infra/run-monitor";

const pollMs = Number(process.env.WORKER_POLL_MS ?? 5000);
const workerId = `worker-${process.pid}`;
let stopped = false;

process.on("SIGTERM", () => {
  stopped = true;
});
process.on("SIGINT", () => {
  stopped = true;
});

async function loop() {
  console.log(`worker ${workerId} polling every ${pollMs}ms`);
  while (!stopped) {
    try {
      const processed = await runDueMonitors(workerId);
      if (processed > 0) console.log(`worker processed ${processed} monitor(s)`);
    } catch (error) {
      console.error("worker tick failed", error);
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  await prisma.$disconnect();
}

void loop();
