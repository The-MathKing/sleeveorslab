import type { Metadata } from "next";
import { Callout, PageShell, Prose } from "@/components/brand/Prose";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Photos are processed on your device. We store only what you choose to log publicly.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <PageShell
      eyebrow="Privacy"
      title="Your photos stay on your phone."
      lede="Short version: we process card photos on your device, we keep only what you choose to publish, and we don't sell anything about you."
      updated="October 12, 2026"
    >
      <Prose>
        <Callout title="The three things that matter" tone="sleeve">
          <p>1. Card photos are processed in your browser and are never uploaded to us.</p>
          <p>2. We only store what you choose to log publicly (the card and the verdict, never the photo), plus your email if you join the waitlist.</p>
          <p>3. Using your data to improve our models is opt-in, off by default.</p>
        </Callout>

        <h2>What stays on your device</h2>
        <ul>
          <li>Card photos and the thumbnails we make from them.</li>
          <li>Centering measurements, condition ratings, and verdicts.</li>
          <li>Your collection list.</li>
        </ul>
        <p>
          These live in your browser&apos;s storage (IndexedDB). Clearing your site data deletes them. We can&apos;t see them and
          can&apos;t recover them.
        </p>

        <h2>What we store on our servers</h2>
        <ul>
          <li>
            <strong>Public predictions you choose to log</strong> on Receipts: the card, grader, tier, verdict, grade
            probabilities, expected gain, whether you plan to submit, and later the grade and cert number if you report them.
            No photo, no name, no account.
          </li>
          <li>
            <strong>Waitlist email</strong>, where you signed up from, and whether you opted in to occasional emails.
          </li>
          <li>
            <strong>Anonymous usage counts</strong>, with no cookies and nothing that identifies you. Details under
            &ldquo;Cookies and tracking&rdquo; below.
          </li>
          <li>
            <strong>Basic server logs</strong> (IP address, user agent, requested URL) kept for security and debugging.
          </li>
        </ul>

        <h2>Training data is opt-in</h2>
        <p>
          We&apos;d like to improve our grade odds with real outcomes. If we ever ask to use a photo or a reported grade for that,
          it will be a separate, clearly worded opt-in, off by default, and you can withdraw it later.
        </p>

        <h2>Card lookups and prices</h2>
        <p>
          When you search for a card, the search text goes to our server, which asks third-party card and price databases.
          Card images are loaded from those providers, which means your browser contacts them directly.
        </p>

        <h2>Retention and deletion</h2>
        <ul>
          <li>Server logs are deleted after 90 days.</li>
          <li>Anonymous usage counts (see below) are deleted after 90 days.</li>
          <li>Ask us to delete anything we hold (a waitlist email, a public prediction) and we&apos;ll do it within 90 days, usually much sooner.</li>
          <li>Waitlist emails are deleted 90 days after launch if you don&apos;t become a user.</li>
        </ul>

        <h2>Cookies and tracking</h2>
        <p>
          No cookies of any kind, no advertising, no third-party trackers, no selling or sharing personal data.
        </p>
        <p>
          We do count a few things ourselves, on our own server, so we know whether the app is useful: page views, scans
          started, photos taken (camera, upload, or sample), verdicts shown (SLAB/SLEEVE/BORDERLINE and the grader), waitlist
          sign-ups, public predictions logged, and share taps. Here&apos;s exactly how:
        </p>
        <ul>
          <li>
            <strong>Anonymous, per tab.</strong> Each browser tab gets a random visit id, kept in that tab&apos;s session storage
            and gone when you close it. It isn&apos;t linked to your email, your cards, or any other visit.
          </li>
          <li>
            <strong>No cookies, no fingerprinting.</strong> Nothing is stored in cookies or long-term browser storage.
          </li>
          <li>
            <strong>No IP address or browser details stored</strong> with these counts. We keep the site you came from
            (just the domain, like reddit.com), never the full link.
          </li>
          <li>
            <strong>Never your photos, card details, or email.</strong> A verdict count says &ldquo;a SLEEVE verdict
            happened&rdquo;, not which card.
          </li>
          <li>
            <strong>Do Not Track and Global Privacy Control are honored.</strong> If your browser sends either, the app sends us
            nothing at all.
          </li>
          <li>
            <strong>Used only in aggregate</strong>, as totals like &ldquo;how many visits got to a verdict this week&rdquo;.
            Raw counts are deleted after 90 days.
          </li>
        </ul>

        <h2>Children</h2>
        <p>
          Plenty of collectors are kids. The tools work without giving us any personal information. The waitlist is for people
          13 and older; if you&apos;re younger, ask a parent to sign up.
        </p>

        <h2>Contact</h2>
        <p>
          Questions or deletion requests: <a href="mailto:hello@sleeveorslab.com">hello@sleeveorslab.com</a>.
        </p>
        <p>If this policy changes in a way that matters, we&apos;ll update the date at the top and say what changed.</p>
      </Prose>
    </PageShell>
  );
}
