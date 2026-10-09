import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NorthBridge Production Operations",
  description: "Production event processing dashboard and MQTT device integration",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
