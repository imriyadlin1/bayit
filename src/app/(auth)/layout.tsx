export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-bl from-primary/10 via-background to-accent/5 px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
