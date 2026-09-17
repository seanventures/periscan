import { buildApp } from "./apps/api/src/app.js";
import { createRuntimeServices } from "./apps/api/src/runtime-services.js";
import { createPrismaClient } from "./packages/db/src/client.js";
const prisma = createPrismaClient();
const app = await buildApp({
  devMode: true,
  services: createRuntimeServices({
    dataRegion: "us-east-1",
    devMode: true,
    missionQueue: { async enqueueValidationJob() {} },
    prisma
  })
});
const r = await app.inject({
  method: "POST",
  payload: {
    email: `repro-${Date.now()}@x.test`,
    name: "R",
    password: "periscan-security-boundary-password",
    tenantName: "T"
  },
  url: "/api/v1/auth/signup"
});
console.log("STATUS", r.statusCode);
console.log("BODY", r.body);
await app.close();
await prisma.$disconnect();
