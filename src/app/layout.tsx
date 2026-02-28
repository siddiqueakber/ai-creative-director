import type { Metadata } from "next"
import { Outfit, Crimson_Pro } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/Providers"

const outfit = Outfit({ 
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["300", "400", "500", "600"]
})

const crimsonPro = Crimson_Pro({ 
  subsets: ["latin"],
  variable: "--font-crimson",
  weight: ["400", "500"],
  style: ["normal", "italic"]
})

export const metadata: Metadata = {
  title: "Orbit | Put your life in perspective",
  description: "Turn what you're going through into a short cinematic journey and see your place in the wider story of life.",
  keywords: ["perspective", "cinematic journey", "reflection", "short film", "Orbit"],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${crimsonPro.variable}`}>
      <body className="min-h-screen gradient-bg">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
