import { describe, expect, it } from "vitest";
import { analyzeJobDescription, buildCv, matchCandidate } from "./pipeline.js";

describe("pipeline stubs", () => {
  it("derives company from the URL host", () => {
    const analysis = analyzeJobDescription("https://www.careers.acme.com/job/42");
    expect(analysis.company).toBe("careers.acme.com");
    expect(analysis.title).toContain("careers.acme.com");
  });

  it("builds a base64 CV artifact naming the company", () => {
    const analysis = analyzeJobDescription("https://acme.com/job");
    const cv = buildCv(analysis, matchCandidate(analysis));
    expect(cv.mimeType).toBe("text/plain");
    expect(cv.fileName).toContain("acme-com");
    const decoded = Buffer.from(cv.contentBase64, "base64").toString("utf8");
    expect(decoded).toContain("PLACEHOLDER CV");
    expect(decoded).toContain("acme.com");
  });
});
