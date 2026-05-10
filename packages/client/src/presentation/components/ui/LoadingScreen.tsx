/**
  * Full-screen loading indicator shown during lazy route loading.
  */
export function LoadingScreen() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
    </div>
  );
}
