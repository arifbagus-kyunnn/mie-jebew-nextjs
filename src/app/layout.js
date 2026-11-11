import "./globals.css";

export const metadata = {
  title: "MIE JEBEW | Juaranya Pedas!",
  description: "Pesan sekarang tanpa antre. Ledakan pedas brutal di Gorontalo.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className="scroll-smooth">
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" async></script>
        <link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Grotesk:wght@400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body text-bvblack antialiased selection:bg-bvred selection:text-white bg-bvcream">
        {children}
      </body>
    </html>
  );
}