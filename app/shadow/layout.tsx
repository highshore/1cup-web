import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function ShadowLayout({ children: _children }: Readonly<{ children: React.ReactNode }>) {
  notFound();
}
