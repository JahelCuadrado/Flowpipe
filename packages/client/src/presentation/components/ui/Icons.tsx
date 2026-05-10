import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { readonly filled?: boolean };

export function HomeIcon({ filled, ...props }: IconProps) {
  return filled ? (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M4 21V10.08l8-6.96 8 6.96V21h-6v-6h-4v6H4z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M12 4.44 4 10.11V20h5v-6h6v6h5v-9.89l-8-5.67zM12 2l10 7.11V22H2V9.11L12 2z" />
    </svg>
  );
}

export function ShortsIcon({ filled, ...props }: IconProps) {
  return filled ? (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M10 14.65v-5.3L15 12l-5 2.65zm7.77-4.33-1.2-.5L18 9.06c1.84-.96 2.53-3.23 1.56-5.06s-3.24-2.53-5.07-1.56L6 6.94c-1.29.68-2.07 2.04-2 3.49.07 1.42.93 2.67 2.22 3.25.03.01 1.2.5 1.2.5L6 14.93c-1.83.97-2.53 3.24-1.56 5.07.97 1.83 3.24 2.53 5.07 1.56l8.5-4.5c1.29-.68 2.06-2.04 1.99-3.49-.07-1.42-.94-2.68-2.23-3.25z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M10 14.65v-5.3L15 12l-5 2.65z" />
      <path
        d="M17.77 10.32l-1.2-.5L18 9.06c1.84-.96 2.53-3.23 1.56-5.06s-3.24-2.53-5.07-1.56L6 6.94c-1.29.68-2.07 2.04-2 3.49.07 1.42.93 2.67 2.22 3.25.03.01 1.2.5 1.2.5L6 14.93c-1.83.97-2.53 3.24-1.56 5.07.97 1.83 3.24 2.53 5.07 1.56l8.5-4.5c1.29-.68 2.06-2.04 1.99-3.49-.07-1.42-.94-2.68-2.23-3.25z"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SubscriptionsIcon({ filled, ...props }: IconProps) {
  return filled ? (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M20 7H4V5h16v2zm-2-4H6V1h12v2zm2 6H4c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-9c0-1.1-.9-2-2-2zm-8 11.5v-7l5.5 3.5-5.5 3.5z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M20 7H4V5h16v2zm-2-4H6V1h12v2zm4 8v9c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2v-9c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2zm-2 0H4v9h16v-9zm-8 7.5V13l5.5 3.5-5.5 3.5z" />
    </svg>
  );
}

export function LibraryIcon({ filled, ...props }: IconProps) {
  return filled ? (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.73 0-5.14-1.39-6.56-3.5.04-2.17 4.38-3.36 6.56-3.36s6.52 1.19 6.56 3.36A7.987 7.987 0 0 1 12 20z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 2c4.42 0 8 3.58 8 8 0 1.95-.7 3.73-1.86 5.13a9.889 9.889 0 0 0-6.14-2c-2.33 0-4.47.79-6.14 2A7.952 7.952 0 0 1 4 12c0-4.42 3.58-8 8-8zm0 3c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
    </svg>
  );
}

export function AddIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={36} height={36} fill="currentColor" {...props}>
      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
      <path d="M0 0h24v24H0z" fill="none" />
    </svg>
  );
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    </svg>
  );
}

export function PlayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function PauseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  );
}

export function ThumbUpIcon({ filled, ...props }: IconProps) {
  return filled ? (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2zM9 19V9l4.34-4.34L12 9h9v2l-3 7H9z" />
    </svg>
  );
}

export function ThumbDownIcon({ filled, ...props }: IconProps) {
  return filled ? (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm0 12-4.34 4.34L12 15H3v-2l3-7h9v9zm4-12v12h4V3h-4z" />
    </svg>
  );
}

export function ShareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M15 5.63 20.66 12 15 18.37V14h-1c-3.96 0-7.14 1-9.75 3.09 1.84-4.07 5.11-6.4 9.89-7.1l.86-.13V5.63M14 2 3 12.87c.68 5.23 4.67 9.13 11 9.13v4l8-9-8-9V2z" />
    </svg>
  );
}

export function SaveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15-5-2.18L7 18V5h10v13z" />
    </svg>
  );
}

export function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M17 18v1H6v-1h11zm-.5-6.6-.7-.7-3.8 3.7V4h-1v10.4l-3.8-3.8-.7.7 5 5 5-5z" />
    </svg>
  );
}

export function RemixIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M12.5 6c0 .28-.22.5-.5.5s-.5-.22-.5-.5.22-.5.5-.5.5.22.5.5zm5 0c0 .28-.22.5-.5.5s-.5-.22-.5-.5.22-.5.5-.5.5.22.5.5zM7 10c1.1 0 2-.9 2-2 0-.18-.03-.35-.07-.51l2.83-1.63c.39.38.91.6 1.49.58.55-.02 1.04-.25 1.39-.6l2.8 1.62c-.04.17-.07.34-.07.52A2 2 0 1 0 17 6c-.18 0-.35.03-.51.07L13.66 4.44c.02-.15.04-.29.04-.44 0-1.1-.9-2-2-2-1.07 0-1.93.85-2 1.9l-2.83 1.63C6.52 5.2 5.78 5 5 5a2 2 0 0 0 0 4 2 2 0 0 0 2-2 1.98 1.98 0 0 0 0 3zm-2-.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM11 14v6.88c-.26-.09-.5-.24-.71-.45l-2.83-2.83a1.99 1.99 0 0 0-2.83 0 1.99 1.99 0 0 0 0 2.83l2.83 2.83C8.42 24.22 9.67 25 11.21 25h4.38c1.54 0 2.79-.78 3.75-1.74l2.83-2.83a1.99 1.99 0 0 0 0-2.83 1.99 1.99 0 0 0-2.83 0l-2.83 2.83c-.21.21-.45.36-.71.45V14h-4.8z" />
    </svg>
  );
}

export function CommentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v3l3.15-2.1c.28-.19.62-.3.95-.3H21c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H11.73l-.73.49-2 1.34V17H3V5h18v12z" />
    </svg>
  );
}

export function NotificationsIcon({ filled, ...props }: IconProps) {
  return filled ? (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
    </svg>
  );
}

export function MoreVertIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  );
}

export function VerifiedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" {...props}>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  );
}

export function FullscreenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
    </svg>
  );
}

export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  );
}

export function CastIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm18-7H5v1.63c3.96 1.28 7.09 4.41 8.37 8.37H19V7zM1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
    </svg>
  );
}

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
    </svg>
  );
}

export function ChevronUpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z" />
    </svg>
  );
}

export function SkipNextIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
    </svg>
  );
}

export function SkipPreviousIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
    </svg>
  );
}

export function Forward10Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2zm-7.46 3.36v-4.72l-.75.24v-.74l1.52-.58h.45v5.8h-1.22zm3.57 0c-.56 0-1-.15-1.3-.44-.3-.3-.45-.73-.45-1.31v-2.35c0-.58.15-1.02.45-1.31.3-.3.74-.44 1.3-.44s1 .15 1.3.44c.3.3.45.73.45 1.31v2.35c0 .58-.15 1.02-.45 1.31-.3.3-.74.44-1.3.44zm0-.87c.18 0 .31-.06.39-.18.08-.12.13-.32.13-.58v-2.35c0-.27-.04-.46-.13-.58a.42.42 0 0 0-.39-.19c-.18 0-.31.06-.39.19-.08.12-.13.31-.13.58v2.35c0 .27.04.46.13.58.08.12.21.18.39.18z" />
    </svg>
  );
}

export function Replay10Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8zm-1.46 11.36v-4.72l-.75.24v-.74l1.52-.58h.45v5.8h-1.22zm3.57 0c-.56 0-1-.15-1.3-.44-.3-.3-.45-.73-.45-1.31v-2.35c0-.58.15-1.02.45-1.31.3-.3.74-.44 1.3-.44s1 .15 1.3.44c.3.3.45.73.45 1.31v2.35c0 .58-.15 1.02-.45 1.31-.3.3-.74.44-1.3.44zm0-.87c.18 0 .31-.06.39-.18.08-.12.13-.32.13-.58v-2.35c0-.27-.04-.46-.13-.58a.42.42 0 0 0-.39-.19c-.18 0-.31.06-.39.19-.08.12-.13.31-.13.58v2.35c0 .27.04.46.13.58.08.12.21.18.39.18z" />
    </svg>
  );
}

export function SubtitlesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6v-2zm0 4h8v2H6v-2zm10 0h2v2h-2v-2zm-6-4h8v2h-8v-2z" />
    </svg>
  );
}

export function SpeedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M10 8v8l6-4-6-4zm6.76 1.36-1.68 1.69c.84 1.18.84 2.71 0 3.89l1.68 1.69c2.02-2.02 2.02-5.07 0-7.27zM21 12c0-2.73-1.08-5.27-2.75-7.14l-1.44 1.44C18.2 7.92 19 9.88 19 12c0 2.12-.8 4.08-2.19 5.7l1.44 1.44C19.92 17.27 21 14.73 21 12zM3.24 6.15 1.8 7.58 4.62 10.4l-2.35 2.35 2.35 2.35-2.82 2.83 1.44 1.44 2.82-2.83 2.35-2.35-2.35-2.35 2.83-2.83-1.44-1.44-2.82 2.83z" />
    </svg>
  );
}

export function QualityIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M15 17h6v1h-6v-1zm-4 0H3v1h8v-1zm0-3H3v1h8v-1zm-4-3H3v1h4v-1zm12 3h-8v1h8v-1zm0-3h-4v1h4v-1z" />
      <path d="M14 3v6l-3.61-3.22L14 3zM3 3v6l3.61-3.22L3 3z" />
    </svg>
  );
}

export function FullscreenExitIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
    </svg>
  );
}

export function PictureInPictureIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z" />
    </svg>
  );
}

export function AutoplayIcon({ filled, ...props }: IconProps) {
  return filled ? (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M2 6v12h6V6H2zm4 10H4V8h2v8zm6-10v12h6V6h-6zm4 10h-2V8h2v8zm4-10h2v12h-2z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
      <path d="M2 6v12h6V6H2zm4 10H4V8h2v8zm6-10v12h6V6h-6zm4 10h-2V8h2v8z" />
    </svg>
  );
}
