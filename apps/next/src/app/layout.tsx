import type { Metadata } from "next"
import type { ReactNode } from "react"
import { TRPCReactProvider } from "../trpc/provider"
import "./globals.css"

export const metadata: Metadata = {
  title: "Sujstack",
  description: "Bun + Next + React + TypeScript with a swappable data layer",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  )
}
