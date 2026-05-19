import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Board",
  description: "Gerencie tarefas delegando para agentes de IA — simples, visual e local.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Sidebar />
        <div className="content">{children}</div>
      </body>
    </html>
  );
}
