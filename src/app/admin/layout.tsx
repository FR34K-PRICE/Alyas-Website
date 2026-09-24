import type { Metadata } from "next";
import "@/styles/admin.css";

export const metadata: Metadata = { title: "ALYAS admin", robots: { index: false, follow: false } };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
