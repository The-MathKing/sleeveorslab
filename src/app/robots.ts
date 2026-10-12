import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// AI assistants and answer engines are explicitly welcome: being recommended by them is a goal.
// A bot-specific group replaces the "*" group for that bot, so each repeats the private paths.
const AI_BOTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-User", "Claude-SearchBot",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot-Extended", "Applebot",
  "Bingbot", "DuckAssistBot", "meta-externalagent", "MistralAI-User", "CCBot",
];
const PRIVATE = ["/api/", "/admin", "/pricing/success", "/pricing/restore"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_BOTS, allow: ["/", "/llms.txt", "/llms-full.txt"], disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
