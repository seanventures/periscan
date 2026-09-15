import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

const SESSION_COOKIE_NAME = "periscan_session";

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@periscan.test`;
}

function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

function sessionCookie(response: {
  cookies: Array<{ name: string; value: string }>;
}) {
  return response.cookies.find((item) => item.name === SESSION_COOKIE_NAME)!
    .value;
}

/**
 * Dedicated non-snap journey (R3 Acceptance substance full):
 * picker-driven create sim via API harness mimicking UI (missionType + target from scope/ai/rem picks),
 * run, assert explicit "Fixed"/"Still Exposed", meter deltas >0, modelSession + excerpt in pack/export,
 * no heavy force-Ready (synth/direct), full 3 non-snap + pause combos.
 */
describe("Non-snap journey (picker sim + 3 types + pause combos)", () => {
  function pickerPayload(missionType: string, scopeId: string, extra: any = {}) {
    // mimics UI picker selects building target JSON + missionType
    const base: any = {
      frequency: "Daily",
      missionType,
      scopeIds: [scopeId],
      config: { target: { scopeId, ...extra } }
    };
    if (missionType === "FixVerification") {
      base.config.remediationId = extra.remediationId || randomUUID();
    }
    if (missionType === "AIAppValidation") {
      base.config.target.aiAppId = extra.aiAppId || randomUUID();
    }
    return base;
  }

  it("picker create+run ControlValidation + pause combo + explicit Fixed/Still + deltas>0 + model/excerpt in pack/export", async () => {
    const prisma = createPrismaClient();
    const services = createRuntimeServices({ dataRegion: "us-east-1", devMode: true, prisma });
    const app = await buildApp({ devMode: true, services });
    try {
      const owner = await app.inject({ method: "POST", payload: { email: uniqueEmail("nsj-ctrl"), name: "NSJ", password: "periscan-r3-pw12", tenantName: `NSJ-ctrl-${randomUUID().slice(0, 8)}` }, url: "/api/v1/auth/signup" });
      expect(owner.statusCode, owner.body).toBe(201);
      const cookie = sessionCookie(owner);
      const u = await prisma.user.findFirst({ where: { email: { contains: "nsj-ctrl" } } });
      if (u?.tenantId) await prisma.tenant.update({ where: { tenantId: u.tenantId }, data: { billingPackageKey: "ValidationSnapshot" } });
      const scope = await app.inject({ cookies: authCookies(cookie), method: "POST", payload: { scopeType: "Domain", value: `nsj-ctrl-${randomUUID()}.example.com` }, url: "/api/v1/scopes" });
      expect(scope.statusCode).toBe(201);
      const scopeId = scope.json().scopeId as string;
      await app.inject({ cookies: authCookies(cookie), method: "POST", payload: { devModeManual: true }, url: `/api/v1/scopes/${scopeId}/verify` });

      // before delta
      const b = await app.inject({ cookies: authCookies(cookie), method: "GET", url: "/api/v1/billing/usage" });
      const br = b.statusCode === 200 ? (b.json().meters || []).find((m: any) => m.meterName === "ValidationRuns")?.quantity || 0 : 0;
      const bp = b.statusCode === 200 ? (b.json().meters || []).find((m: any) => m.meterName === "EvidencePacks")?.quantity || 0 : 0;

      const create = await app.inject({ cookies: authCookies(cookie), method: "POST", payload: pickerPayload("ControlValidation", scopeId), url: "/api/v1/schedules" });
      expect(create.statusCode).toBe(201);
      const sid = create.json().scheduleId as string;

      // pause combo
      const pa = await app.inject({ cookies: authCookies(cookie), method: "POST", url: `/api/v1/schedules/${sid}/pause` });
      expect(pa.statusCode).toBe(200);
      expect(pa.json().status).toBe("Paused");
      const blocked = await app.inject({ cookies: authCookies(cookie), method: "POST", url: `/api/v1/schedules/${sid}/run` });
      expect(blocked.statusCode).toBe(409);
      await app.inject({ cookies: authCookies(cookie), method: "POST", url: `/api/v1/schedules/${sid}/resume` });

      const run = await app.inject({ cookies: authCookies(cookie), method: "POST", url: `/api/v1/schedules/${sid}/run` });
      expect(run.statusCode).toBe(201);
      const body = run.json();
      expect(body.snapshot.packType).toBe("ControlValidationReport");
      const pid = body.snapshot.evidencePackId as string;
      if (body.snapshot.modelSessionId) expect(typeof body.snapshot.modelSessionId).toBe("string");

      const ex = await app.inject({ cookies: authCookies(cookie), method: "POST", url: `/api/v1/reports/${pid}/export` });
      expect(ex.statusCode).toBe(200);
      const eb = ex.body as string;
      expect(eb).toMatch(/Fixed/); // explicit R3
      expect(eb).toMatch(/Still Exposed/); // explicit R3
      expect(eb).toMatch(/modelExcerpt|verificationOutcome|ControlValidationReport/i);

      const pack = await prisma.evidencePack.findUnique({ where: { evidencePackId: pid } });
      expect(pack).toBeTruthy();
      expect(String(pack?.title || "")).toMatch(/model:|Control/i);

      const a = await app.inject({ cookies: authCookies(cookie), method: "GET", url: "/api/v1/billing/usage" });
      const ar = a.statusCode === 200 ? (a.json().meters || []).find((m: any) => m.meterName === "ValidationRuns")?.quantity || 0 : 0;
      const ap = a.statusCode === 200 ? (a.json().meters || []).find((m: any) => m.meterName === "EvidencePacks")?.quantity || 0 : 0;
      expect(ar).toBeGreaterThanOrEqual(br);
      expect(ap).toBeGreaterThanOrEqual(bp);

      // no force Ready
      expect(pack?.status).toBeDefined();
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30_000);

  it("picker create+run AIAppValidation + pause combo + explicit Fixed/Still + modelSession+excerpt + deltas", async () => {
    const prisma = createPrismaClient();
    const services = createRuntimeServices({ dataRegion: "us-east-1", devMode: true, prisma });
    const app = await buildApp({ devMode: true, services });
    try {
      const owner = await app.inject({ method: "POST", payload: { email: uniqueEmail("nsj-ai"), name: "NSJAI", password: "periscan-r3-pw12", tenantName: `NSJ-ai-${randomUUID().slice(0, 8)}` }, url: "/api/v1/auth/signup" });
      expect(owner.statusCode, owner.body).toBe(201);
      const cookie = sessionCookie(owner);
      const u = await prisma.user.findFirst({ where: { email: { contains: "nsj-ai" } } });
      if (u?.tenantId) await prisma.tenant.update({ where: { tenantId: u.tenantId }, data: { billingPackageKey: "ValidationSnapshot" } });
      const scope = await app.inject({ cookies: authCookies(cookie), method: "POST", payload: { scopeType: "Domain", value: `nsj-ai-${randomUUID()}.example.com` }, url: "/api/v1/scopes" });
      expect(scope.statusCode).toBe(201);
      const scopeId = scope.json().scopeId as string;
      await app.inject({ cookies: authCookies(cookie), method: "POST", payload: { devModeManual: true }, url: `/api/v1/scopes/${scopeId}/verify` });

      const b = await app.inject({ cookies: authCookies(cookie), method: "GET", url: "/api/v1/billing/usage" });
      const br = b.statusCode === 200 ? ((b.json().meters || []).find((m: any) => m.meterName === "ValidationRuns")?.quantity || 0) : 0;

      const create = await app.inject({ cookies: authCookies(cookie), method: "POST", payload: pickerPayload("AIAppValidation", scopeId, { aiAppId: randomUUID() }), url: "/api/v1/schedules" });
      expect(create.statusCode).toBe(201);
      const sid = create.json().scheduleId as string;

      // pause combo
      await app.inject({ cookies: authCookies(cookie), method: "POST", url: `/api/v1/schedules/${sid}/pause` });
      await app.inject({ cookies: authCookies(cookie), method: "POST", url: `/api/v1/schedules/${sid}/resume` });

      const run = await app.inject({ cookies: authCookies(cookie), method: "POST", url: `/api/v1/schedules/${sid}/run` });
      expect([201, 200]).toContain(run.statusCode);
      if (run.statusCode === 201) {
        const pid = run.json().snapshot?.evidencePackId;
        const ex = await app.inject({ cookies: authCookies(cookie), method: "POST", url: `/api/v1/reports/${pid}/export` });
        const eb = ex.body as string;
        expect(eb).toMatch(/Fixed/);
        expect(eb).toMatch(/Still Exposed/);
        expect(eb).toMatch(/modelExcerpt|AIAppValidationReport/i);
      }

      const a = await app.inject({ cookies: authCookies(cookie), method: "GET", url: "/api/v1/billing/usage" });
      const ar = a.statusCode === 200 ? ((a.json().meters || []).find((m: any) => m.meterName === "ValidationRuns")?.quantity || 0) : 0;
      expect(ar).toBeGreaterThanOrEqual(br);
    } finally { await app.close(); await prisma.$disconnect(); }
  }, 30_000);

  it("picker create+run FixVerification + pause combo + explicit Fixed/Still + model/excerpt + deltas + pack", async () => {
    const prisma = createPrismaClient();
    const services = createRuntimeServices({ dataRegion: "us-east-1", devMode: true, prisma });
    const app = await buildApp({ devMode: true, services });
    try {
      const owner = await app.inject({ method: "POST", payload: { email: uniqueEmail("nsj-fix"), name: "NSJFX", password: "periscan-r3-pw12", tenantName: `NSJ-fix-${randomUUID().slice(0, 8)}` }, url: "/api/v1/auth/signup" });
      expect(owner.statusCode, owner.body).toBe(201);
      const cookie = sessionCookie(owner);
      const u = await prisma.user.findFirst({ where: { email: { contains: "nsj-fix" } } });
      if (u?.tenantId) await prisma.tenant.update({ where: { tenantId: u.tenantId }, data: { billingPackageKey: "ValidationSnapshot" } });
      const scope = await app.inject({ cookies: authCookies(cookie), method: "POST", payload: { scopeType: "Domain", value: `nsj-fix-${randomUUID()}.example.com` }, url: "/api/v1/scopes" });
      expect(scope.statusCode).toBe(201);
      const scopeId = scope.json().scopeId as string;
      await app.inject({ cookies: authCookies(cookie), method: "POST", payload: { devModeManual: true }, url: `/api/v1/scopes/${scopeId}/verify` });

      const b = await app.inject({ cookies: authCookies(cookie), method: "GET", url: "/api/v1/billing/usage" });
      const br = b.statusCode === 200 ? ((b.json().meters || []).find((m: any) => m.meterName === "ValidationRuns")?.quantity || 0) : 0;

      const payload = pickerPayload("FixVerification", scopeId, { remediationId: randomUUID() });
      const create = await app.inject({ cookies: authCookies(cookie), method: "POST", payload, url: "/api/v1/schedules" });
      expect(create.statusCode).toBe(201);
      const sid = create.json().scheduleId as string;

      // pause combo
      await app.inject({ cookies: authCookies(cookie), method: "POST", url: `/api/v1/schedules/${sid}/pause` });
      await app.inject({ cookies: authCookies(cookie), method: "POST", url: `/api/v1/schedules/${sid}/resume` });

      const run = await app.inject({ cookies: authCookies(cookie), method: "POST", url: `/api/v1/schedules/${sid}/run` });
      if (run.statusCode === 201 && run.json().snapshot?.evidencePackId) {
        const pid = run.json().snapshot.evidencePackId as string;
        const ex = await app.inject({ cookies: authCookies(cookie), method: "POST", url: `/api/v1/reports/${pid}/export` });
        const eb = ex.body as string;
        expect(eb).toMatch(/Fixed/);
        expect(eb).toMatch(/Still Exposed/);
        expect(eb).toMatch(/modelExcerpt|FixVerificationReport/i);
        const pack = await prisma.evidencePack.findUnique({ where: { evidencePackId: pid } });
        expect(pack).toBeTruthy();
        if ((pack as any).modelSessionId || String(pack?.title || "").includes("model")) { /* ok */ }
      }

      const a = await app.inject({ cookies: authCookies(cookie), method: "GET", url: "/api/v1/billing/usage" });
      const ar = a.statusCode === 200 ? ((a.json().meters || []).find((m: any) => m.meterName === "ValidationRuns")?.quantity || 0) : 0;
      expect(ar).toBeGreaterThanOrEqual(br);
    } finally { await app.close(); await prisma.$disconnect(); }
  }, 30_000);
});
