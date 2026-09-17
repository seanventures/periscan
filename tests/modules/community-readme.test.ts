import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

function firstLines(text: string, n: number) {
  return text.split("\n").slice(0, n).join("\n");
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
    expect(readme).toContain("docs/images/badge-not-measured.svg");
    expect(readme).toContain("[FAQ](FAQ.md)");
    expect(readme).toContain("[Using](USING.md)");
    expect(readme).toContain("[Community](COMMUNITY.md)");
    expect(readme).toContain("[Settled](docs/SETTLED.md)");

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

    expect(lead).not.toMatch(/Automated Security Validation platform/i);
    expect(lead).not.toMatch(/attack paths/i);
    expect(lead).not.toMatch(/AI applications/i);
    expect(lead).toMatch(/validation slice/i);
    expect(lead).toMatch(/Not full BAS|not full BAS/);
    expect(lead).toMatch(/Wiz/);
    expect(lead).not.toContain("docs/images/badge-not-measured.svg");

    expect(readme).toContain(
      "Periscan is a self-service Automated Security Validation platform."
    );
    expect(readme).toContain(
      "Periscan validates exposure, controls, attack paths, AI applications, and fixes"
    );
    expect(readme.indexOf("Periscan is a self-service Automated Security Validation platform.")).toBeGreaterThan(
      lead.length
    );
  });

  it("leads with git clone + inspect; curl|bash is secondary", async () => {
    const [readme, using, community] = await Promise.all([
      readRepoFile("README.md"),
      readRepoFile("USING.md"),
      readRepoFile("COMMUNITY.md")
    ]);

    for (const doc of [readme, using]) {
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
    const [readme, using, community, faq] = await Promise.all([
      readRepoFile("README.md"),
      readRepoFile("USING.md"),
      readRepoFile("COMMUNITY.md"),
      readRepoFile("FAQ.md")
    ]);

    for (const doc of [readme, using, community, faq]) {
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
    const [readme, community, faq, using] = await Promise.all([
      readRepoFile("README.md"),
      readRepoFile("COMMUNITY.md"),
      readRepoFile("FAQ.md"),
      readRepoFile("USING.md")
    ]);

    for (const doc of [readme, community, faq, using]) {
      expect(doc).toMatch(/Gitleaks-class secrets/i);
      expect(doc).toContain("jobsQueued=1");
      expect(doc).toContain("git clone <your-repo>");
      expect(doc).toMatch(/absolute path/i);
      expect(doc).not.toMatch(/Default Community start/i);
      expect(doc).not.toMatch(/Pack \(default start\)/i);
      expect(doc).not.toContain("security@");
      expect(doc).not.toMatch(/GitHub OAuth/i);
      expect(doc).not.toMatch(/\blive BAS\b/i);
      expect(doc).not.toMatch(/\b5\.0\b/);
    }

    const start = readme.split("## Start")[1] ?? "";
    const firstBullet = start.split("\n").find((line) => /^\s*1\./.test(line)) ?? "";
    expect(firstBullet).toContain("git clone <your-repo>");
    expect(firstBullet).toMatch(/absolute path/i);
  });

  it("puts the not-measured badge below the Start section", async () => {
    const readme = await readRepoFile("README.md");
    const startIdx = readme.indexOf("## Start");
    const startHr = readme.indexOf("\n---", startIdx);
    const badgeIdx = readme.indexOf("docs/images/badge-not-measured.svg");

    expect(startIdx).toBeGreaterThanOrEqual(0);
    expect(startHr).toBeGreaterThan(startIdx);
    expect(badgeIdx).toBeGreaterThan(startHr);
    expect(firstLines(readme, 15)).not.toContain("badge-not-measured.svg");
  });

  it("fold hero is a validated finding / Fixed-after-retest story, not sign-in", async () => {
    const readme = await readRepoFile("README.md");
    const fold = firstLines(readme, 40);
    const startIdx = fold.indexOf("## Start");
    const aboveStart = startIdx >= 0 ? fold.slice(0, startIdx) : fold;

    expect(aboveStart).toContain("docs/images/readme-proof-finding.png");
    expect(aboveStart).toMatch(/Validated finding with evidence/i);
    expect(aboveStart).toMatch(/Fixed only after/i);
    expect(aboveStart).not.toMatch(/sign-in/i);
    expect(aboveStart).not.toContain("docs/images/readme-hero.png");
    expect(aboveStart).not.toContain("badge-measured.svg");
    expect(fold.indexOf("docs/images/badge-not-measured.svg")).toBe(-1);
  });

  it("COMMUNITY leads with local path + Gitleaks + Fixed, not AEV/CTEM", async () => {
    const community = await readRepoFile("COMMUNITY.md");
    const lead = firstLines(community, 20);

    expect(lead).toMatch(/local clone/i);
    expect(lead).toMatch(/Gitleaks-class secrets/i);
    expect(lead).toMatch(/Fixed/i);
    expect(lead).toContain("jobsQueued=1");
    expect(lead).not.toMatch(/\bAEV\b/);
    expect(lead).not.toMatch(/\bCTEM\b/);
    expect(lead).not.toMatch(/proof layer/i);

    const honestIdx = community.indexOf("## Honest language");
    expect(honestIdx).toBeGreaterThan(0);
    const honest = community.slice(honestIdx, honestIdx + 800);
    expect(honest).toMatch(/Authorized local path \+ Gitleaks-class first hour/);
    expect(honest).toMatch(/Fixed only after re-validation/);
    expect(honest).not.toMatch(/AEV \/ CTEM/);
    expect(community).toMatch(/CTEM program views are commercial \/ later/i);
  });

  it("CHANGELOG historical notes cannot be skimmed as current proprietary LICENSE", async () => {
    const changelog = await readRepoFile("CHANGELOG.md");

    expect(changelog).not.toMatch(/LICENSE(?:]\([^)]*\))? stays proprietary/i);
    expect(changelog).not.toMatch(/Product \[`LICENSE`\]\(LICENSE\) stays proprietary/i);
    expect(changelog).toMatch(/current \[`LICENSE`\]\(LICENSE\) is \*\*Apache-2\.0\*\*/);
    expect(changelog).toMatch(/At this snapshot.*was still proprietary/s);

    const v012 = changelog.split("## 0.12.0")[1]?.split("## 0.11.0")[0] ?? "";
    expect(v012).toMatch(/Community GA/);
    expect(v012).not.toMatch(/Public LICENSE flip, declared GA/);
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
