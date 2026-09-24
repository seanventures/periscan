import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/** Private-tree `v0.12.0` peel. Do not retag. Public orphan stays `097bb6df`. */

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

function firstLines(text: string, n: number) {
  return text.split("\n").slice(0, n).join("\n");
}

function h2Section(markdown: string, heading: RegExp): string {
  const match = markdown.match(heading);
  if (!match || match.index === undefined) {
    return "";
  }
  const rest = markdown.slice(match.index + match[0].length);
  const next = rest.search(/^## /m);
  return (next < 0 ? rest : rest.slice(0, next)).trim();
}

const CURL_INSTALL =
  "curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/seanventures/periscan/main/install.sh | bash";
const CLONE_PERISCAN = "git clone https://github.com/seanventures/periscan.git";

describe("Community GitHub README (PERISCAN-561 / PERISCAN-490)", () => {
  it("is a product landing: clone-first start, Apache-2.0 slice, seanventures issues", async () => {
    const [readme, community, faq, using] = await Promise.all([
      readRepoFile("README.md"),
      readRepoFile("COMMUNITY.md"),
      readRepoFile("FAQ.md"),
      readRepoFile("USING.md")
    ]);

    expect(readme).toContain(
      "Prove authorized exposures are real — and only mark them Fixed when a retest says so."
    );
    expect(readme).toContain(CLONE_PERISCAN);
    expect(readme).toContain("bash scripts/periscan.sh install");
    expect(readme).toContain("bash scripts/periscan.sh start");
    expect(readme).toMatch(/local clone path/i);
    expect(readme).toContain("github.com/org/repo");
    expect(readme).toContain("Apache-2.0");
    expect(readme).toContain("seanventures/periscan");
    expect(readme).toContain("[Settled](docs/SETTLED.md)");
    expect(readme).toContain("docs/BADGES.md");
    expect(readme).not.toContain("docs/images/badge-not-measured.svg");
    expect(readme).toContain("[FAQ](FAQ.md)");
    expect(readme).toContain("[Using](USING.md)");
    expect(readme).toContain("[Community](COMMUNITY.md)");

    expect(readme).not.toContain("seanheiney");
    expect(readme).not.toContain("goldeneye");
    expect(readme).not.toMatch(/we are open source now/i);
    expect(readme).not.toMatch(
      /\b95\+|Magic Quadrant|Forrester Wave progress/i
    );

    expect(community).toContain("bash scripts/periscan.sh start");
    expect(community).toContain("seanventures/periscan");
    expect(community).toMatch(/local clone path/i);
    expect(faq).toContain("seanventures/periscan");
    expect(using).toContain("bash scripts/periscan.sh install");
    expect(using).toContain("PERISCAN_API_PORT");
  });

  it("does not lead with the operator encyclopedia", async () => {
    const readme = await readRepoFile("README.md");
    const fold = firstLines(readme, 40);
    expect(fold).not.toContain("PRD_AUDIT_PROTOCOL.md");
    expect(fold).not.toContain("connector catalog");
    expect(fold).not.toContain("pnpm lab:dev");
    expect(fold).toContain("bash scripts/periscan.sh start");
  });

  it("demotes ASV / attack paths / AI apps from the first 15 lines", async () => {
    const readme = await readRepoFile("README.md");
    const lead = firstLines(readme, 15);
    const fold = firstLines(readme, 90);
    const comparedIdx = readme.search(/^## Compared to what you already run/m);
    const packIdx = readme.search(/^## Community pack/m);

    expect(lead).not.toMatch(/Automated Security Validation platform/i);
    expect(lead).not.toMatch(/attack paths/i);
    expect(lead).not.toMatch(/AI applications/i);
    expect(lead).toMatch(/validation slice/i);
    expect(lead).toContain("docs/BAS_AEV_PROGRAM.md");
    expect(lead).toMatch(/current shipped entry point/i);
    expect(lead).toMatch(/Wiz/);
    expect(lead).not.toContain("docs/images/badge-not-measured.svg");

    expect(fold).not.toMatch(/Automated Security Validation platform/i);
    expect(fold).not.toMatch(/\bCTEM\b/);
    expect(fold).not.toContain("Gitleaks, detect-secrets, git-secrets");
    expect(fold).toMatch(/authorized local path/i);
    expect(fold).toMatch(/Keep proving/i);
    expect(fold).toMatch(/Gitleaks-class/i);
    expect(fold).toMatch(/Fixed after retest/i);
    expect(fold).not.toMatch(/first hour/i);

    expect(comparedIdx).toBeGreaterThan(fold.length);
    expect(packIdx).toBeGreaterThan(comparedIdx);
    expect(readme).not.toMatch(
      /self-service Automated Security Validation platform/i
    );
    expect(readme).not.toMatch(
      /validates exposure, controls, attack paths, AI applications/i
    );
    const compared = readme.slice(comparedIdx, packIdx);
    expect(compared).toMatch(/Gitleaks-class secrets/i);
    expect(compared).toContain("| **Periscan**");
  });

  it("keeps the not-measured mark on BADGES.md, not the README body", async () => {
    const [readme, badges] = await Promise.all([
      readRepoFile("README.md"),
      readRepoFile("docs/BADGES.md")
    ]);
    expect(readme).not.toContain("badge-not-measured.svg");
    expect(readme).toContain("docs/BADGES.md");
    expect(badges).toContain("badge-not-measured.svg");
  });

  it("leads with git clone + inspect; curl|bash is secondary", async () => {
    const [readme, using, community, setup] = await Promise.all([
      readRepoFile("README.md"),
      readRepoFile("USING.md"),
      readRepoFile("COMMUNITY.md"),
      readRepoFile("docs/SETUP.md")
    ]);

    for (const doc of [readme, using, setup]) {
      const cloneIdx = doc.indexOf(CLONE_PERISCAN);
      const curlIdx = doc.indexOf(CURL_INSTALL);
      expect(cloneIdx).toBeGreaterThanOrEqual(0);
      expect(curlIdx).toBeGreaterThan(cloneIdx);
      expect(doc).toMatch(/inspect/i);
    }

    expect(community.indexOf(CLONE_PERISCAN)).toBeGreaterThanOrEqual(0);
    const communityCurl = community.indexOf(CURL_INSTALL);
    if (communityCurl >= 0) {
      expect(community.indexOf(CLONE_PERISCAN)).toBeLessThan(communityCurl);
    }
  });

  it("states Node 24 and Docker before any curl line", async () => {
    const [readme, using, community, faq, setup] = await Promise.all([
      readRepoFile("README.md"),
      readRepoFile("USING.md"),
      readRepoFile("COMMUNITY.md"),
      readRepoFile("FAQ.md"),
      readRepoFile("docs/SETUP.md")
    ]);

    for (const doc of [readme, using, community, faq, setup]) {
      const curlIdx = doc.indexOf(CURL_INSTALL);
      if (curlIdx < 0) {
        expect(doc).toMatch(/Node 24/);
        expect(doc).toMatch(/\bDocker\b/);
        continue;
      }
      const beforeCurl = doc.slice(0, curlIdx);
      expect(beforeCurl).toMatch(/Node 24/);
      expect(beforeCurl).toMatch(/\bDocker\b/);
    }
  });

  it("first hour is authorized local clone + Gitleaks-class secrets (jobsQueued=1)", async () => {
    const [readme, community, faq, using, setup] = await Promise.all([
      readRepoFile("README.md"),
      readRepoFile("COMMUNITY.md"),
      readRepoFile("FAQ.md"),
      readRepoFile("USING.md"),
      readRepoFile("docs/SETUP.md")
    ]);

    for (const doc of [readme, community, faq, using, setup]) {
      expect(doc).toMatch(/Gitleaks-class secrets/i);
      expect(doc).toContain("jobsQueued=1");
      expect(doc).toContain("git clone <your-repo>");
      expect(doc).toMatch(/absolute path/i);
      expect(doc).not.toMatch(/Pack \(default start\)/i);
      expect(doc).not.toContain("security@");
      expect(doc).not.toMatch(/GitHub OAuth/i);
      expect(doc).not.toMatch(/\blive BAS\b/i);
      expect(doc).not.toMatch(/\b5\.0\b/);
    }

    const start = readme.split("## Start")[1] ?? "";
    const firstBullet =
      start.split("\n").find((line) => /^\s*1\./.test(line)) ?? "";
    expect(firstBullet).toContain("git clone <your-repo>");
    expect(firstBullet).toMatch(/absolute path/i);
    expect(start).toContain("docs/images/shot-get-started.png");
    expect(start).toContain("docs/images/shot-github-clone-hint.png");
  });

  it("does not embed the not-measured badge in the README fold", async () => {
    const readme = await readRepoFile("README.md");
    expect(readme).not.toContain("badge-not-measured.svg");
    expect(firstLines(readme, 15)).not.toContain("badge-not-measured.svg");
    expect(readme).toContain("docs/BADGES.md");
  });

  it("fold hero is a validated finding / Fixed-after-retest story, not sign-in", async () => {
    const readme = await readRepoFile("README.md");
    const fold = firstLines(readme, 40);
    const startIdx = fold.indexOf("## Start");
    const aboveStart = startIdx >= 0 ? fold.slice(0, startIdx) : fold;

    expect(aboveStart).toContain("docs/images/shot-finding-row.png");
    expect(aboveStart).toMatch(/Validated finding with evidence/i);
    expect(aboveStart).toMatch(/Fixed only after/i);
    expect(aboveStart).not.toMatch(/sign-in/i);
    expect(aboveStart).not.toContain("docs/images/readme-hero.png");
    expect(aboveStart).not.toContain("docs/images/readme-proof-finding.png");
    expect(aboveStart).not.toContain("docs/images/shot-get-started.png");
    expect(aboveStart).not.toContain("docs/images/shot-github-clone-hint.png");
    expect(aboveStart).not.toContain("badge-measured.svg");
    expect(fold.indexOf("docs/images/badge-not-measured.svg")).toBe(-1);
  });

  it("README states the BAS/AEV objective and qualifies current delivery", async () => {
    const readme = await readRepoFile("README.md");
    const lead = firstLines(readme, 15);

    expect(lead).toMatch(/Full BAS\/AEV is the \[development objective\]/i);
    expect(lead).toMatch(/current shipped entry point/i);
    expect(lead).toMatch(/live adapters require the qualification gates/i);
    for (const engine of [
      "Atomic",
      "Caldera",
      "SharpHound/BloodHound",
      "Metasploit"
    ]) {
      expect(lead).toContain(engine);
    }
    expect(lead).toMatch(/Fixed.*only after a retest/);
    expect(lead).not.toMatch(/Periscan is (a |an )?Full BAS platform/i);
  });

  it("COMMUNITY leads with local path + Gitleaks + Fixed and qualifies the BAS/AEV objective", async () => {
    const community = await readRepoFile("COMMUNITY.md");
    const lead = firstLines(community, 20);

    expect(lead).toMatch(/local clone/i);
    expect(lead).toMatch(/Gitleaks-class secrets/i);
    expect(lead).toMatch(/Fixed/i);
    expect(lead).toContain("jobsQueued=1");
    expect(lead).toContain("BAS_AEV_PROGRAM.md");
    expect(lead).not.toMatch(/\bCTEM\b/);
    expect(lead).not.toMatch(/proof layer/i);

    const honestIdx = community.indexOf("## Honest language");
    expect(honestIdx).toBeGreaterThan(0);
    const honest = community.slice(honestIdx, honestIdx + 800);
    expect(honest).toMatch(
      /Authorized local path \+ Gitleaks-class default start/
    );
    expect(honest).toMatch(/Fixed only after re-validation/);
    expect(honest).not.toMatch(/AEV \/ CTEM/);
    expect(community).toMatch(/CTEM program views are commercial \/ later/i);
  });

  it("CHANGELOG historical notes cannot be skimmed as current proprietary LICENSE", async () => {
    const changelog = await readRepoFile("CHANGELOG.md");

    expect(changelog).not.toMatch(/LICENSE(?:]\([^)]*\))? stays proprietary/i);
    expect(changelog).not.toMatch(
      /Product \[`LICENSE`\]\(LICENSE\) stays proprietary/i
    );
    expect(changelog).toMatch(
      /current \[`LICENSE`\]\(LICENSE\) is \*\*Apache-2\.0\*\*/
    );
    expect(changelog).toMatch(/At this snapshot.*was still proprietary/s);

    const v012 = changelog.split("## 0.12.0")[1]?.split("## 0.11.0")[0] ?? "";
    expect(v012).toMatch(/Community GA/);
    expect(v012).not.toMatch(/Public LICENSE flip, declared GA/);
  });

  it("CHANGELOG 0.12.x is Community GA, not an Unreleased Not GA lead", async () => {
    const changelog = await readRepoFile("CHANGELOG.md");
    const current = changelog.split(/## 0\.11\.0\b/)[0] ?? "";

    expect(changelog).toMatch(/^## Unreleased\s*$/m);
    expect(changelog).toMatch(/^## 1\.0\.0 — 2026-09-22\s*$/m);
    expect(changelog).toMatch(/^## 0\.12\.0 — 2026-09-16\s*$/m);
    expect(current).toMatch(/Community GA/);
    expect(current).not.toMatch(/\bNot GA\b/);
    expect(current).not.toMatch(/Not a new tagged snapshot/i);
  });

  it("CHANGELOG Unreleased is after 1.0.0 and does not retag v0.12.0 (P1-TAG)", async () => {
    const changelog = await readRepoFile("CHANGELOG.md");
    const unreleased = h2Section(changelog, /^## Unreleased\s*$/m);
    const firstPara = unreleased.split(/\n\s*\n/)[0] ?? "";
    const v100 = h2Section(changelog, /^## 1\.0\.0 — 2026-09-22\s*$/m);
    const v012 = h2Section(changelog, /^## 0\.12\.0 — 2026-09-16\s*$/m);

    expect(unreleased.length).toBeGreaterThan(0);
    expect(firstPara).toMatch(/After Community 1\.0\.0/);
    expect(firstPara).toMatch(/[Dd]o not retag/);
    expect(firstPara).toMatch(/v0\.12\.0/);
    expect(firstPara).not.toMatch(/\bNot GA\b/);
    expect(unreleased).not.toMatch(/Not a new tagged snapshot/i);
    expect(unreleased).not.toMatch(/OpenClaw-style one-paste installer/);
    expect(unreleased).not.toMatch(/PERISCAN-576/);
    expect(unreleased).not.toMatch(/PERISCAN-560/);
    expect(unreleased).not.toMatch(/PERISCAN-586/);
    expect(v100).toMatch(/Community \*\*1\.0\.0\*\*/);
    expect(v100).toMatch(/PERISCAN-586/);
    expect(v100).toMatch(/keep proving/i);
    expect(v100).not.toMatch(/\bNot GA\b/);
    expect(v012).toMatch(/Community GA/);
    expect(v012).not.toMatch(/\bNot GA\b/);
  });

  it("CHANGELOG 0.12.1 heading is not tagged, not Unreleased (P1-TAG)", async () => {
    const changelog = await readRepoFile("CHANGELOG.md");

    expect(changelog).toMatch(/^## 0\.12\.1 — 2026-09-17 \(not tagged\)\s*$/m);
    expect(changelog).not.toMatch(/^## 0\.12\.1[^\n]*Unreleased/m);
  });

  it("SECURITY.md first paragraph is [SECURITY] + 72h SLA; PVR unused", async () => {
    const security = await readRepoFile("SECURITY.md");
    const firstPara = firstLines(security, 8);

    expect(firstPara).toContain("[SECURITY]");
    expect(firstPara).toMatch(/72 hours/);
    expect(firstPara).toMatch(/title-only/i);
    expect(firstPara).toMatch(/PVR|private vulnerability reporting/i);
    expect(security).toMatch(
      /does \*\*not\*\* use GitHub private vulnerability reporting/i
    );
    expect(security).not.toMatch(
      /enable GitHub private vulnerability reporting/i
    );
    expect(security).toMatch(/90 days/);
  });

  it("dependabot.yml does not claim the Apache product is proprietary", async () => {
    const dependabot = await readRepoFile(".github/dependabot.yml");
    expect(dependabot).not.toMatch(/proprietary/i);
    expect(dependabot).not.toMatch(/LICENSE flip/i);
    expect(dependabot).toMatch(/Apache-2\.0/);
  });

  it("CHANGELOG 0.12.1 lists first-hour ICP closeout without inventing 5.0 or live BAS", async () => {
    const changelog = await readRepoFile("CHANGELOG.md");
    const v0121 =
      changelog
        .split(/## 0\.12\.1 — 2026-09-17\b/)[1]
        ?.split(/## 0\.12\.0\b/)[0] ?? "";

    expect(v0121.length).toBeGreaterThan(0);
    expect(v0121).toMatch(/Proof eyebrow/i);
    expect(v0121).toMatch(/one (primary )?(CTA|verb)/i);
    expect(v0121).toMatch(/Watch.*1s|1s.*[Pp]oll/i);
    expect(v0121).toMatch(/[Gg]it [Cc]lone|[Cc]lone hint|[Gg]itHub URL/i);
    expect(v0121).toMatch(/path.*rule|finding row/i);
    expect(v0121).toMatch(/skip-?link/i);
    expect(v0121).toMatch(/README|FAQ/i);
    expect(v0121).toMatch(/SECURITY/i);
    expect(v0121).toMatch(/xmldom|deepmerge|GHSA/i);
    expect(v0121).toMatch(/scorecard|lab-runs/i);
    expect(v0121).toMatch(/installer|next.?step/i);
    expect(v0121).not.toMatch(/\blive BAS\b/i);
    expect(v0121).not.toMatch(/\b5\.0\b/);
  });

  it("ENTERPRISE.md is an honest CISO Community vs commercial boundary", async () => {
    const [enterprise, readme] = await Promise.all([
      readRepoFile("docs/ENTERPRISE.md"),
      readRepoFile("README.md")
    ]);

    expect(enterprise).toMatch(/Apache-2\.0/);
    expect(enterprise).toMatch(/validation slice/i);
    expect(enterprise).toMatch(/authorized\s+local clone path/i);
    expect(enterprise).toMatch(/Gitleaks-class secrets/i);
    expect(enterprise).toContain("jobsQueued=1");
    expect(enterprise).toMatch(/Fixed/i);
    expect(enterprise).toMatch(/retest/i);
    expect(enterprise).toMatch(/SSO in one click/);
    expect(enterprise).toMatch(/not\*\* a SOC 2 pack/i);
    expect(enterprise).toMatch(/Hosted multi-tenant SaaS/i);
    expect(enterprise).toMatch(/Managed SSO \/ SCIM/i);
    expect(enterprise).toMatch(/MSSP portfolio/i);
    expect(enterprise).toMatch(
      /execution requires a qualified\s+adapter, an approved scenario/
    );
    expect(enterprise).toContain("[SECURITY]");
    expect(enterprise).toContain("OPEN_CORE.md");
    expect(enterprise).toContain("PRODUCTION_READINESS.md");
    expect(enterprise).not.toContain("security@");
    expect(enterprise).not.toMatch(/GitHub OAuth/i);
    expect(enterprise).not.toMatch(/\blive BAS\b/i);
    expect(enterprise).not.toMatch(/\b5\.0\b/);

    expect(readme).toContain("[docs/ENTERPRISE.md](docs/ENTERPRISE.md)");
    expect(firstLines(readme, 15)).not.toContain("docs/ENTERPRISE.md");
  });

  it("CTEM in Periscan is proof-layer not platform (PERISCAN-490)", async () => {
    const [community, faq, enterprise] = await Promise.all([
      readRepoFile("COMMUNITY.md"),
      readRepoFile("FAQ.md"),
      readRepoFile("docs/ENTERPRISE.md")
    ]);

    for (const doc of [community, faq, enterprise]) {
      expect(doc).toMatch(/^## CTEM in Periscan\s*$/m);
      const idx = doc.search(/^## CTEM in Periscan\s*$/m);
      const after = doc.slice(idx);
      const nextHeading = after.slice(1).search(/\n## /);
      const section =
        nextHeading >= 0
          ? after.slice(0, nextHeading + 1)
          : after.slice(0, 900);
      expect(section).toMatch(/proof layer/i);
      expect(section).toMatch(
        /Scope\s*[→\-].*Discover\s*[→\-].*Prioritize\s*[→\-].*Validate\s*[→\-].*Mobilize\s*[→\-].*Verify/i
      );
      expect(section).toMatch(/Authorize\s*[→\-]\s*Verify/i);
      expect(section).toMatch(/Gitleaks-class secrets/i);
      expect(section).toMatch(/[Ll]ive Atomic/);
      expect(section).toMatch(/hosted|MSSP/i);
      expect(section).toMatch(
        /not.*Microsoft CTEM replacement|not a Microsoft CTEM/i
      );
      expect(section).toMatch(/full BAS\/AEV development program/i);
      expect(section).toMatch(/qualified adapters and measured evidence/i);
      expect(section).not.toMatch(
        /Microsoft CTEM replacement for|replace Microsoft CTEM/i
      );
    }

    expect(firstLines(community, 20)).not.toMatch(/\bCTEM\b/);
    expect(community).toMatch(/CTEM program views are commercial \/ later/i);
  });

  it("SOC2.md is honest: no vendor Type II; customer support pack only", async () => {
    const [soc2, enterprise, faq, docsFaq, readme] = await Promise.all([
      readRepoFile("docs/SOC2.md"),
      readRepoFile("docs/ENTERPRISE.md"),
      readRepoFile("FAQ.md"),
      readRepoFile("docs/FAQ.md"),
      readRepoFile("README.md")
    ]);

    expect(soc2).toMatch(/does not currently publish a vendor SOC 2 Type II/i);
    expect(soc2).toMatch(/soc2TypeIiStatus/);
    expect(soc2).toMatch(/\bNone\b/);
    expect(soc2).toMatch(/NotClaimed/);
    expect(soc2).toMatch(/Customer SOC 2 support evidence/i);
    expect(soc2).toMatch(/partial[\s\S]*Trust Services Criteria|partial TSC/i);
    expect(soc2).toMatch(/independent CPA|independent auditor/i);
    expect(soc2).toMatch(/period of performance/i);
    expect(soc2).toContain("SECURITY.md");
    expect(soc2).toContain("[SECURITY]");
    expect(soc2).toContain("SETUP.md");
    expect(soc2).toContain("ENTERPRISE.md");
    expect(soc2).not.toMatch(/\b(Deloitte|EY|PwC|KPMG)\b/);
    expect(soc2).not.toContain("security@");
    expect(soc2).not.toMatch(/\b5\.0\b/);
    expect(soc2).not.toMatch(/Type II report available/i);

    expect(enterprise).toContain("SOC2.md");
    expect(readme).toContain("[docs/SOC2.md](docs/SOC2.md)");
    expect(firstLines(readme, 15)).not.toContain("docs/SOC2.md");

    for (const doc of [faq, docsFaq]) {
      expect(doc).toMatch(/Are you SOC 2 certified\?/i);
      expect(doc).toMatch(/\bNo\./);
      expect(doc).toContain("SOC2.md");
      expect(doc).toMatch(/support evidence/i);
    }
  });

  it("FAQ/USING first GitHub-authorize answer is clone then paste local path", async () => {
    const [faq, docsFaq, using, docsUsing] = await Promise.all([
      readRepoFile("FAQ.md"),
      readRepoFile("docs/FAQ.md"),
      readRepoFile("USING.md"),
      readRepoFile("docs/USING.md")
    ]);

    for (const doc of [faq, docsFaq]) {
      const answer = firstGithubAuthorizeAnswer(doc);
      expect(answer.length).toBeGreaterThan(0);
      const cloneIdx = answer.indexOf("git clone <your-repo>");
      const pathIdx = answer.search(/absolute path/i);
      expect(cloneIdx).toBeGreaterThanOrEqual(0);
      expect(pathIdx).toBeGreaterThan(cloneIdx);
      expect(answer.slice(0, cloneIdx)).not.toMatch(/\bOAuth\b/i);
      expect(doc).not.toMatch(/GitHub OAuth/i);
    }

    for (const doc of [using, docsUsing]) {
      expect(doc).toContain("git clone <your-repo>");
      expect(doc).toMatch(/absolute path/i);
      expect(doc).not.toMatch(/GitHub OAuth/i);
    }
  });
});

describe("Community local/self-host SETUP (PERISCAN-490)", () => {
  it("README and USING point at docs/SETUP.md without stuffing the GitHub fold", async () => {
    const [readme, using, docsUsing] = await Promise.all([
      readRepoFile("README.md"),
      readRepoFile("USING.md"),
      readRepoFile("docs/USING.md")
    ]);

    expect(readme).toContain("[Setup](docs/SETUP.md)");
    expect(using).toContain("docs/SETUP.md");
    expect(docsUsing).toContain("SETUP.md");

    const fold = firstLines(readme, 40);
    expect(fold).toContain("bash scripts/periscan.sh start");
    expect(fold).not.toContain("DATABASE_URL");
    expect(fold).not.toContain("PERISCAN_POSTGRES_PUBLISHED_PORT");
    expect(fold).not.toContain("compose.yaml");
    expect(fold).not.toContain("/api/v1/tenants/current/sso");
    expect(fold).not.toMatch(/Enable SAML/i);
  });

  it("SETUP.md is the Node 24 / pnpm / Docker / infra compose contract", async () => {
    const setup = await readRepoFile("docs/SETUP.md");

    expect(setup).toMatch(/Node 24/);
    expect(setup).toContain("pnpm 9.15.0");
    expect(setup).toMatch(/\bDocker\b/);
    expect(setup).toContain("infra/docker-compose/docker-compose.yml");
    expect(setup).toContain("PERISCAN_POSTGRES_PUBLISHED_PORT");
    expect(setup).toContain("DATABASE_URL");
    expect(setup).toContain("REDIS_URL");
    expect(setup).toMatch(/\bRedis\b/);
    expect(setup).toContain("periscan-deps");
    expect(setup).toContain(".nvmrc");
    expect(setup).toMatch(/Corepack/i);
  });

  it("SETUP.md is honest: never docker compose at repo root; compose.yaml is not public Community deps", async () => {
    const setup = await readRepoFile("docs/SETUP.md");

    expect(setup).toContain("Do **not** run `docker compose` at the repo root");
    expect(setup).toContain("compose.yaml");
    expect(setup).not.toContain("PUBLIC_TREE.md");
    expect(setup).toContain("A public clone may");
    expect(setup).toContain("-f infra/docker-compose/docker-compose.community-deps.yml");
    expect(setup).not.toMatch(/^docker compose up$/m);
  });

  it("SETUP.md distinguishes install.sh vs periscan.sh and documents doctor/health", async () => {
    const setup = await readRepoFile("docs/SETUP.md");

    expect(setup).toContain("scripts/periscan.sh");
    expect(setup).toContain("install.sh");
    expect(setup).toContain("bash scripts/periscan.sh install");
    expect(setup).toContain("bash scripts/periscan.sh start");
    expect(setup).toContain("bash scripts/periscan.sh status");
    expect(setup).toContain("bash install.sh doctor");
    expect(setup).toContain("bash install.sh health");
    expect(setup).toMatch(/does \*\*not\*\* start/i);
    expect(setup).toMatch(/check only/i);
    expect(setup).toMatch(/health \+ repair/i);
    expect(setup).toContain("/api/v1/health");
  });

  it("SETUP.md first hour is Gitleaks on a local clone path, not live BAS or github.com/org/repo", async () => {
    const setup = await readRepoFile("docs/SETUP.md");

    expect(setup).toMatch(/Gitleaks-class secrets/i);
    expect(setup).toContain("jobsQueued=1");
    expect(setup).toContain("git clone <your-repo>");
    expect(setup).toMatch(/absolute path/i);
    expect(setup).toContain("github.com/org/repo");
    expect(setup).toMatch(/not a control-plane path/i);
    expect(setup).toMatch(/tool_unavailable/);
    expect(setup).not.toMatch(/\blive BAS\b/i);
    expect(setup).not.toContain("security@");
    expect(setup).not.toMatch(/GitHub OAuth/i);
    expect(setup).not.toMatch(/\b5\.0\b/);
  });

  it("SETUP.md treats SSO as API-first tenant config, not a click Enable SAML local step", async () => {
    const setup = await readRepoFile("docs/SETUP.md");

    expect(setup).toContain("PUT /api/v1/tenants/current/sso");
    expect(setup).toMatch(/API-first/i);
    expect(setup).not.toMatch(/click Enable SAML/i);
  });
});

/** Body of the first FAQ heading that answers authorizing a GitHub/repo URL. */
function firstGithubAuthorizeAnswer(doc: string): string {
  const headingRe =
    /^#{2,3}[^\n]*(?:authorize[`\s].*github|github\.com\/org\/repo|paste a GitHub URL|GitHub URL)[^\n]*$/gim;
  const match = headingRe.exec(doc);
  if (!match || match.index === undefined) {
    return "";
  }
  const after = doc.slice(match.index + match[0].length);
  const nextHeading = after.search(/\n#{2,3} /);
  return (nextHeading >= 0 ? after.slice(0, nextHeading) : after).trim();
}
