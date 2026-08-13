import { describe, expect, it } from "vitest";
import { cvFileName, stripHtml, unwrapCodeFence } from "./pipeline.js";

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
  it("slugs the company and always ends in .pdf", () => {
    expect(cvFileName("Acme, Inc.")).toBe("cv-acme-inc.pdf");
    expect(cvFileName("careers.acme.com")).toBe("cv-careers-acme-com.pdf");
    expect(cvFileName("")).toBe("cv-role.pdf");
    expect(cvFileName("!!!")).toBe("cv-role.pdf");
  });
});

describe("unwrapCodeFence", () => {
  it("removes a ```latex fence but leaves raw LaTeX untouched", () => {
    const raw = "\\documentclass{article}\\begin{document}Hi\\end{document}";
    expect(unwrapCodeFence("```latex\n" + raw + "\n```")).toBe(raw);
    expect(unwrapCodeFence("```\n" + raw + "\n```")).toBe(raw);
    expect(unwrapCodeFence(raw)).toBe(raw);
  });
});
