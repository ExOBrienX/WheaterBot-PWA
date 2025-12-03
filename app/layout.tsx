/**
 * =========================================
 * LAYOUT PRINCIPAL DE LA APP
 * =========================================
 * 
 * Este archivo es el layout raíz de la aplicación.
 * Envuelve TODAS las páginas y es donde se define:
 * - Meta tags (SEO, PWA, iOS)
 * - Fuentes
 * - Estilos globales
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./register-sw"; // Registrar Service Worker

// Fuentes de Google (optimizadas para velocidad)
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * METADATA: Información de la app
 * 
 * - title: Título que aparece en pestañas y pantalla de instalación
 * - description: Descripción para SEO y tiendas de apps
 * - viewport: Configuración de la ventana en móviles
 * - appleWebApp: Configuración para iOS
 * - formatDetection: Evitar que Safari detecte números como teléfono
 */
export const metadata: Metadata = {
  title: "WheaterBot - Clima con IA",
  description: "Chatbot que proporciona pronósticos meteorológicos con recomendaciones inteligentes impulsadas por IA",
  
  // Viewport: hace que la app se vea correcta en móviles
  viewport: "width=device-width, initial-scale=1, maximum-scale=5",
  
  // Configuración para iOS (web app mode)
  appleWebApp: {
    capable: true, // Permitir modo app
    statusBarStyle: "black-translucent" as const, // Barra negra
    title: "WheaterBot", // Nombre en pantalla de inicio
  },
  
  // Evitar que Safari trate números como teléfonos
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        {/* Link al manifest.json (necesario para PWA) */}
        <link rel="manifest" href="/manifest.json" />
        
        {/* Icono de la app */}
        <link rel="icon" href="/icon-192.png" />
        
        {/* Color de la barra de tareas en Android */}
        <meta name="theme-color" content="#0f3460" />
      </head>

      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Todo el contenido de la app va aquí */}
        {children}
      </body>
    </html>
  );
}
