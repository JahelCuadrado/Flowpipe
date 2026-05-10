interface ErrorMessageProps {
  readonly message: string;
  readonly onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="text-3xl">⚠</div>
      <p className="text-sm text-[var(--color-text-secondary)]">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)]"
        >
          Retry
        </button>
      )}
    </div>
  );
}
