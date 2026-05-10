import { NavLink } from "react-router";
import { HomeIcon, ShortsIcon, SubscriptionsIcon, LibraryIcon } from "@/presentation/components/ui/Icons";
import { useSettingsStore } from "@/application/stores/settingsStore";
import type { ReactNode } from "react";

interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: (filled: boolean) => ReactNode;
  readonly settingsKey?: "home" | "shorts" | "subscriptions";
}

const NAV_ITEMS: readonly NavItem[] = [
  { path: "/", label: "Inicio", icon: (f) => <HomeIcon filled={f} />, settingsKey: "home" },
  { path: "/shorts", label: "Shorts", icon: (f) => <ShortsIcon filled={f} />, settingsKey: "shorts" },
  { path: "/subscriptions", label: "Suscripciones", icon: (f) => <SubscriptionsIcon filled={f} />, settingsKey: "subscriptions" },
  { path: "/you", label: "Tú", icon: (f) => <LibraryIcon filled={f} /> },
];

/**
 * YouTube-style bottom navigation bar.
 * Tabs can be toggled on/off from Settings (except "Tú").
 */
export function BottomNav() {
  const visibleTabs = useSettingsStore((s) => s.visibleTabs);

  const items = NAV_ITEMS.filter(
    (item) => !item.settingsKey || visibleTabs[item.settingsKey]
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#272727] bg-[#0f0f0f] pb-[env(safe-area-inset-bottom,0px)]">
      <div className="mx-auto flex max-w-lg items-center justify-around">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] press-scale transition-colors duration-150 ${
                isActive ? "text-white" : "text-[#aaa]"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {item.icon(isActive)}
                <span className="leading-tight">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
