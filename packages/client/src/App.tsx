import { Routes, Route } from "react-router";
import { lazy, Suspense } from "react";
import { AppShell } from "@/presentation/components/layout/AppShell";
import { LoadingScreen } from "@/presentation/components/ui/LoadingScreen";
import { RouteErrorBoundary } from "@/presentation/components/ui/RouteErrorBoundary";

// Lazy-loaded pages for code splitting
const HomePage = lazy(() => import("@/presentation/pages/HomePage"));
const SearchPage = lazy(() => import("@/presentation/pages/SearchPage"));
const ChannelPage = lazy(() => import("@/presentation/pages/ChannelPage"));
const PlaylistPage = lazy(() => import("@/presentation/pages/PlaylistPage"));
const SubscriptionsPage = lazy(() => import("@/presentation/pages/SubscriptionsPage"));
const FeedPage = lazy(() => import("@/presentation/pages/FeedPage"));
const LocalPlaylistsPage = lazy(() => import("@/presentation/pages/LocalPlaylistsPage"));
const LocalPlaylistDetailPage = lazy(() => import("@/presentation/pages/LocalPlaylistDetailPage"));
const HistoryPage = lazy(() => import("@/presentation/pages/HistoryPage"));
const DownloadsPage = lazy(() => import("@/presentation/pages/DownloadsPage"));
const SettingsPage = lazy(() => import("@/presentation/pages/SettingsPage"));
const ShortsPage = lazy(() => import("@/presentation/pages/ShortsPage"));
const YouPage = lazy(() => import("@/presentation/pages/YouPage"));

export function App() {
  return (
    <AppShell>
      <RouteErrorBoundary>
        <Suspense fallback={<LoadingScreen />}>
          <div className="animate-page-enter">
            <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/shorts" element={<ShortsPage />} />
            <Route path="/channel" element={<ChannelPage />} />
            <Route path="/playlist" element={<PlaylistPage />} />
            <Route path="/subscriptions" element={<SubscriptionsPage />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/local-playlists" element={<LocalPlaylistsPage />} />
            <Route path="/local-playlist" element={<LocalPlaylistDetailPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/downloads" element={<DownloadsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/you" element={<YouPage />} />
          </Routes>
          </div>
        </Suspense>
      </RouteErrorBoundary>
    </AppShell>
  );
}
