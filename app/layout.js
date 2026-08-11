export const metadata = {
  title: 'Cribbage Companion',
  description: 'Score tracker, cribbage hints, and PWA support.',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }) {
  const bodyStyle = {
    margin: 0,
    minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    backgroundColor: '#071326',
    color: '#f7f9fc',
    lineHeight: 1.5,
  };

  return (
    <html lang="en">
      <body style={bodyStyle}>{children}</body>
    </html>
  );
}
