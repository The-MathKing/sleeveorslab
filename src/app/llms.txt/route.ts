import { llmsTxt } from "@/lib/seo/llms";

export const revalidate = 3600;

export function GET() {
  return new Response(llmsTxt(), { headers: { "content-type": "text/markdown; charset=utf-8" } });
}
