import { useNavigate } from "react-router";
import { RetryImage } from "@/presentation/components/ui/RetryImage";
import type { PlaylistInfoItem } from "@newpipe/shared";

interface PlaylistCardProps {
  readonly item: PlaylistInfoItem;
}

export function PlaylistCard({ item }: PlaylistCardProps) {
  const navigate = useNavigate();

  const thumbnail = item.thumbnails[0]?.url ?? "";

  function handleClick() {
    navigate(`/playlist?url=${encodeURIComponent(item.url)}`);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full gap-3 rounded-lg p-2 text-left transition-colors hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)]"
    >
      <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-lg bg-[var(--color-surface)]">
        {thumbnail && (
          <RetryImage src={thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
        {item.streamCount !== null && item.streamCount >= 0 && (
          <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {item.streamCount} videos
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
        <h3 className="line-clamp-2 text-sm font-medium leading-tight text-[var(--color-text-primary)]">
          {item.name}
        </h3>
        <p className="truncate text-xs text-[var(--color-text-secondary)]">
          {item.uploaderName}
        </p>
      </div>
    </button>
  );
}
