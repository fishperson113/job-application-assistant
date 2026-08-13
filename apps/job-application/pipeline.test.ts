import { describe, expect, it } from "vitest";
import { cvFileName, stripHtml } from "./pipeline.js";

describe("stripHtml", () => {
  it("drops scripts/styles and tags, decodes entities, collapses whitespace", () => {
    const html = `<html><head><style>.x{color:red}</style></head><body>
      <script>alert(1)</script>
      <h1>Senior   Engineer</h1>
      <p>Build&nbsp;things &amp; ship them &lt;fast&gt;</p>
    </body></html>`;
    const text = stripHtml(html);
    expect(text).not.toContain("<h1>");
    expect(text).not.toContain("<script");
    expect(text).not.toContain("alert(1)");
    expect(text).not.toContain("color:red");
    expect(text).toContain("Senior Engineer");
    expect(text).toContain("Build things & ship them <fast>");
  });
});

describe("cvFileName", () => {
  it("slugs the company and always ends in .md", () => {
    expect(cvFileName("Acme, Inc.")).toBe("cv-acme-inc.md");
    expect(cvFileName("careers.acme.com")).toBe("cv-careers-acme-com.md");
    expect(cvFileName("")).toBe("cv-role.md");
    expect(cvFileName("!!!")).toBe("cv-role.md");
  });
});
