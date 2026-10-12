import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { AdminDashboard } from "./AdminDashboard";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function AdminPage() {
  return (
    <Container size="lg" className="py-6 sm:py-10">
      <AdminDashboard />
    </Container>
  );
}
