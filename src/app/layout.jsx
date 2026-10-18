import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  title: "Student Grade Management Portal",
  description: "Student and Teacher Grade Management System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
