import { describe, expect, it } from "vitest";
import { getTiers } from "@/lib/grading";
import { PLANS } from "@/lib/billing/plans";
import { faqLd, pageMetadata, softwareApplicationLd } from "./index";
import { llmsFullTxt, llmsTxt } from "./llms";

describe("llms.txt", () => {
  it("follows the llmstxt.org shape: H1, blockquote summary, link sections", () => {
    const t = llmsTxt();
    expect(t.startsWith("# Sleeve or Slab\n\n> ")).toBe(true);
    expect(t).toMatch(/^## Tools$/m);
    expect(t).toContain("/scan");
    expect(t).toContain("Not affiliated with PSA, CGC");
  });
  it("full version carries every available fee tier and plan price from the live config", () => {
    const t = llmsFullTxt();
    for (const tier of getTiers()) expect(t).toContain(tier.name);
    for (const p of Object.values(PLANS)) expect(t).toContain(p.price);
    expect(t).toContain("55/45");
  });
});

describe("structured data", () => {
  it("app offers match plan prices", () => {
    const ld = softwareApplicationLd();
    expect(ld.offers.map((o) => o.price)).toEqual(Object.values(PLANS).map((p) => (p.priceCents / 100).toFixed(2)));
  });
  it("FAQ is valid FAQPage", () => {
    const ld = faqLd();
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity.length).toBeGreaterThan(3);
    expect(JSON.parse(JSON.stringify(ld))).toEqual(ld);
  });
  it("page metadata sets canonical and OG url", () => {
    const m = pageMetadata("/fees", "Grading fees", "d");
    expect(m.alternates?.canonical).toBe("/fees");
    expect(m.openGraph).toMatchObject({ url: "/fees", title: "Grading fees · Sleeve or Slab" });
  });
});
