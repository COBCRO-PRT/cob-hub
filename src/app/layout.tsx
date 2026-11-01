import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Onest, Geist_Mono } from "next/font/google";
import { Shell } from "@/components/shell/Shell";
import { USER_COOKIE_NAME, readSession } from "@/lib/gate-pessoa";
import { MotionProvider } from "@/components/MotionProvider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const onest = Onest({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "COB Hub · uso interno",
  description:
    "Catálogo interno de sites, ferramentas e materiais do time COB.",
  // O hub mapeia todos os acessos internos, então fica fora de busca.
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // A barra do jogo é a mesma em todas as telas; quem está logado vira o cartão do jogador.
  const pessoa = await readSession((await cookies()).get(USER_COOKIE_NAME)?.value);
  return (
    <html
      lang="pt-BR"
      className={`${onest.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MotionProvider>
          <Shell pessoa={pessoa ? { name: pessoa.name, role: pessoa.role } : null}>{children}</Shell>
        </MotionProvider>
        <Toaster />
      </body>
    </html>
  );
}
