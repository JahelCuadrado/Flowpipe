import { useNavigate } from "react-router";
import type { ChannelInfoItem } from "@newpipe/shared";

interface ChannelCardProps {
  readonly item: ChannelInfoItem;
}

export function ChannelCard({ item }: ChannelCardProps) {
  const navigate = useNavigate();

  const avatar = item.thumbnails[0]?.url ?? "";

  function handleClick() {
    navigate(`/channel?url=${encodeURIComponent(item.url)}`);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full items-center gap-4 rounded-lg p-3 text-left transition-colors hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)]"
    >
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-[var(--color-surface)]">
        {avatar && (
          <img src={avatar} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium text-[var(--color-text-primary)]">
          {item.name}
          {item.verified && (
            <span className="ml-1 text-xs text-[var(--color-text-secondary)]" title="Verified">✓</span>
          )}
        </h3>
        {item.subscriberCount !== null && (
          <p className="text-xs text-[var(--color-text-secondary)]">
            {formatSubscriberCount(item.subscriberCount)} subscribers
          </p>
        )}
        {item.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-[var(--color-text-tertiary)]">
            {item.description}
          </p>
        )}
      </div>
    </button>
  );
}

function formatSubscriberCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return String(count);
}
