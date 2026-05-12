import { useState, useCallback, type ImgHTMLAttributes } from "react";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1_500;

interface RetryImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Called after all retries are exhausted. If not provided, the image hides itself. */
  readonly onAllRetriesFailed?: () => void;
}

/**
 * Drop-in replacement for `<img>` that retries loading up to MAX_RETRIES times
 * with a cache-busting query parameter on each attempt.
 * After exhausting retries, hides the element or calls onAllRetriesFailed.
 */
export function RetryImage({ src, onError, onAllRetriesFailed, ...rest }: RetryImageProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [hidden, setHidden] = useState(false);

  const handleError = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
      if (retryCount < MAX_RETRIES) {
        const nextRetry = retryCount + 1;
        setTimeout(() => setRetryCount(nextRetry), RETRY_DELAY_MS);
      } else {
        if (onAllRetriesFailed) {
          onAllRetriesFailed();
        } else {
          setHidden(true);
        }
        onError?.(event);
      }
    },
    [retryCount, onError, onAllRetriesFailed],
  );

  if (hidden || !src) return null;

  // Append a cache-busting param on retries to bypass browser/CDN cache
  const retrySrc =
    retryCount > 0 ? `${src}${src.includes("?") ? "&" : "?"}_r=${retryCount}` : src;

  return <img {...rest} src={retrySrc} onError={handleError} />;
}
