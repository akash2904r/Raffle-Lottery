import "./globals.css";

export const metadata = {
  title: 'Raffle - The Lottery',
  description: 'Step into the Raffle - Your chance to win big is just one click away! Enter now and let the odds decide your fortune when the conditions align! Dream big, win bigger!',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-[#0e0e0e]">{children}</body>
    </html>
  )
}