import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSettingsStore } from "@/application/stores/settingsStore";
import { exportSubscriptions, importSubscriptions } from "@/application/services/PersistenceService";

const RESOLUTION_OPTIONS = ["360p", "480p", "720p", "1080p", "1440p", "2160p"] as const;
const AUDIO_FORMAT_OPTIONS = ["m4a", "webm", "opus"] as const;

const COUNTRY_OPTIONS: readonly { code: string; name: string }[] = [
  { code: "AF", name: "افغانستان (Afganistán)" },
  { code: "AL", name: "Shqipëria (Albania)" },
  { code: "DZ", name: "الجزائر (Argelia)" },
  { code: "AR", name: "Argentina" },
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Österreich (Austria)" },
  { code: "BD", name: "বাংলাদেশ (Bangladés)" },
  { code: "BE", name: "België / Belgique (Bélgica)" },
  { code: "BO", name: "Bolivia" },
  { code: "BR", name: "Brasil" },
  { code: "CA", name: "Canada (Canadá)" },
  { code: "CL", name: "Chile" },
  { code: "CN", name: "中国 (China)" },
  { code: "CO", name: "Colombia" },
  { code: "CR", name: "Costa Rica" },
  { code: "HR", name: "Hrvatska (Croacia)" },
  { code: "CU", name: "Cuba" },
  { code: "CZ", name: "Česko (Chequia)" },
  { code: "DK", name: "Danmark (Dinamarca)" },
  { code: "DO", name: "República Dominicana" },
  { code: "EC", name: "Ecuador" },
  { code: "EG", name: "مصر (Egipto)" },
  { code: "SV", name: "El Salvador" },
  { code: "ES", name: "España" },
  { code: "US", name: "United States (EE.UU.)" },
  { code: "FI", name: "Suomi (Finlandia)" },
  { code: "FR", name: "France (Francia)" },
  { code: "DE", name: "Deutschland (Alemania)" },
  { code: "GR", name: "Ελλάδα (Grecia)" },
  { code: "GT", name: "Guatemala" },
  { code: "HN", name: "Honduras" },
  { code: "HK", name: "香港 (Hong Kong)" },
  { code: "HU", name: "Magyarország (Hungría)" },
  { code: "IN", name: "भारत (India)" },
  { code: "ID", name: "Indonesia" },
  { code: "IR", name: "ایران (Irán)" },
  { code: "IQ", name: "العراق (Irak)" },
  { code: "IE", name: "Ireland (Irlanda)" },
  { code: "IL", name: "ישראל (Israel)" },
  { code: "IT", name: "Italia" },
  { code: "JP", name: "日本 (Japón)" },
  { code: "KR", name: "대한민국 (Corea del Sur)" },
  { code: "MX", name: "México" },
  { code: "MA", name: "المغرب (Marruecos)" },
  { code: "NL", name: "Nederland (Países Bajos)" },
  { code: "NZ", name: "New Zealand (Nueva Zelanda)" },
  { code: "NI", name: "Nicaragua" },
  { code: "NG", name: "Nigeria" },
  { code: "NO", name: "Norge (Noruega)" },
  { code: "PK", name: "پاکستان (Pakistán)" },
  { code: "PA", name: "Panamá" },
  { code: "PY", name: "Paraguay" },
  { code: "PE", name: "Perú" },
  { code: "PH", name: "Pilipinas (Filipinas)" },
  { code: "PL", name: "Polska (Polonia)" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "România (Rumanía)" },
  { code: "RU", name: "Россия (Rusia)" },
  { code: "SA", name: "السعودية (Arabia Saudí)" },
  { code: "RS", name: "Србија (Serbia)" },
  { code: "SG", name: "Singapore (Singapur)" },
  { code: "ZA", name: "South Africa (Sudáfrica)" },
  { code: "SE", name: "Sverige (Suecia)" },
  { code: "CH", name: "Schweiz / Suisse (Suiza)" },
  { code: "TW", name: "臺灣 (Taiwán)" },
  { code: "TH", name: "ประเทศไทย (Tailandia)" },
  { code: "TR", name: "Türkiye (Turquía)" },
  { code: "UA", name: "Україна (Ucrania)" },
  { code: "AE", name: "الإمارات (Emiratos Árabes)" },
  { code: "GB", name: "United Kingdom (Reino Unido)" },
  { code: "UY", name: "Uruguay" },
  { code: "VE", name: "Venezuela" },
  { code: "VN", name: "Việt Nam (Vietnam)" },
];

export default function SettingsPage() {
  const settings = useSettingsStore();
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="min-h-full bg-[#0f0f0f] pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0f0f0f] px-4 pb-3 pt-4">
        <h1 className="text-[20px] font-bold text-white">Ajustes</h1>
      </header>

      <div className="flex flex-col gap-5 px-4">
        {/* Content region / Country */}
        <SettingsSection title="Región" icon="🌍">
          <CustomSelectRow
            label="País del contenido"
            description="Los vídeos y tendencias se adaptarán a este país"
            value={settings.contentCountry}
            options={COUNTRY_OPTIONS.map((c) => ({ value: c.code, label: c.name }))}
            onChange={settings.setContentCountry}
            searchable
          />
        </SettingsSection>

        {/* Appearance */}
        <SettingsSection title="Apariencia" icon="🎨">
          <CustomSelectRow
            label="Tema"
            value={settings.theme}
            options={[
              { value: "dark", label: "Oscuro" },
              { value: "light", label: "Claro" },
              { value: "system", label: "Sistema" },
            ]}
            onChange={(v) => settings.setTheme(v as "dark" | "light" | "system")}
          />
        </SettingsSection>

        {/* Playback */}
        <SettingsSection title="Reproducción" icon="▶️">
          <ToggleRow
            label="Reproducción automática"
            description="Reproducir el siguiente vídeo automáticamente"
            value={settings.autoplay}
            onChange={settings.setAutoplay}
          />
          <CustomSelectRow
            label="Resolución por defecto"
            value={settings.defaultResolution}
            options={[...RESOLUTION_OPTIONS].map((r) => ({ value: r, label: r }))}
            onChange={settings.setDefaultResolution}
          />
          <CustomSelectRow
            label="Formato de audio"
            value={settings.defaultAudioFormat}
            options={[...AUDIO_FORMAT_OPTIONS].map((f) => ({ value: f, label: f.toUpperCase() }))}
            onChange={settings.setDefaultAudioFormat}
          />
        </SettingsSection>

        {/* Content */}
        <SettingsSection title="Contenido" icon="📺">
          <ToggleRow
            label="Vídeos relacionados"
            value={settings.showRelatedStreams}
            onChange={settings.setShowRelatedStreams}
          />
          <ToggleRow
            label="Comentarios"
            value={settings.showComments}
            onChange={settings.setShowComments}
          />
        </SettingsSection>

        {/* Tabs */}
        <SettingsSection title="Pestañas de navegación" icon="📑">
          <TabOrderManager />
        </SettingsSection>

        {/* Privacy */}
        <SettingsSection title="Privacidad" icon="🔒">
          <ToggleRow
            label="Historial de búsqueda"
            description="Guardar búsquedas localmente"
            value={settings.showSearchHistory}
            onChange={settings.setShowSearchHistory}
          />
          <ToggleRow
            label="Historial de visualización"
            description="Guardar vídeos vistos localmente"
            value={settings.showWatchHistory}
            onChange={settings.setShowWatchHistory}
          />
        </SettingsSection>

        {/* Data */}
        <SettingsSection title="Datos" icon="💾">
          <div className="flex flex-col gap-2.5 px-4 py-3">
            <button
              type="button"
              onClick={() => exportSubscriptions().catch(() => {})}
              className="rounded-lg bg-[#272727] px-4 py-2.5 text-[13px] font-medium text-white transition-colors active:bg-[#3a3a3a]"
            >
              Exportar suscripciones (JSON)
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg bg-[#272727] px-4 py-2.5 text-[13px] font-medium text-white transition-colors active:bg-[#3a3a3a]"
            >
              Importar suscripciones
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const count = await importSubscriptions(file);
                  setImportStatus(`${count} suscripciones importadas`);
                } catch (err: unknown) {
                  setImportStatus(err instanceof Error ? err.message : "Error en la importación");
                }
                e.target.value = "";
              }}
            />
            {importStatus && (
              <p className="text-xs text-[#aaa]">{importStatus}</p>
            )}
          </div>
        </SettingsSection>

        {/* Version */}
        <p className="mt-2 text-center text-[11px] text-[#555]">Flowpipe v1.0.0</p>
      </div>
    </div>
  );
}

// ─── Tab Order Manager (Drag & Drop) ─────────────────────────────────────────

const TAB_LABELS: Record<string, string> = {
  home: "Inicio",
  shorts: "Shorts",
  subscriptions: "Suscripciones",
};

function TabOrderManager() {
  const visibleTabs = useSettingsStore((s) => s.visibleTabs);
  const tabOrder = useSettingsStore((s) => s.tabOrder);
  const setVisibleTab = useSettingsStore((s) => s.setVisibleTab);
  const setTabOrder = useSettingsStore((s) => s.setTabOrder);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const touchStartY = useRef<number>(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleTouchStart = useCallback((index: number, event: React.TouchEvent) => {
    touchStartY.current = event.touches[0]!.clientY;
    setDragIndex(index);
  }, []);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (dragIndex === null) return;
    const touchY = event.touches[0]!.clientY;
    // Find which item the finger is over
    for (let i = 0; i < itemRefs.current.length; i++) {
      const el = itemRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (touchY >= rect.top && touchY <= rect.bottom) {
        setOverIndex(i);
        return;
      }
    }
  }, [dragIndex]);

  const handleTouchEnd = useCallback(() => {
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      const newOrder = [...tabOrder];
      const [moved] = newOrder.splice(dragIndex, 1);
      if (moved) {
        newOrder.splice(overIndex, 0, moved);
        setTabOrder(newOrder);
      }
    }
    setDragIndex(null);
    setOverIndex(null);
  }, [dragIndex, overIndex, tabOrder, setTabOrder]);

  return (
    <div
      className="flex flex-col"
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <p className="px-4 pt-3 pb-1 text-[11px] text-[#717171]">Mantén pulsado y arrastra para reordenar</p>
      {tabOrder.map((key, index) => (
        <div
          key={key}
          ref={(el) => { itemRefs.current[index] = el; }}
          className={`flex items-center justify-between px-4 py-3.5 transition-colors ${
            dragIndex === index ? "bg-[#2a2a2a]" : ""
          } ${overIndex === index && dragIndex !== index ? "border-t-2 border-[#3ea6ff]" : "border-t-2 border-transparent"}`}
        >
          {/* Drag handle */}
          <div
            className="mr-3 flex cursor-grab touch-none items-center text-[#717171] active:text-white"
            onTouchStart={(e) => handleTouchStart(index, e)}
          >
            <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor">
              <path d="M3 15h18v-2H3v2zm0 4h18v-2H3v2zm0-8h18V9H3v2zm0-6v2h18V5H3z" />
            </svg>
          </div>

          {/* Label */}
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-white">{TAB_LABELS[key] ?? key}</p>
          </div>

          {/* Toggle */}
          <button
            type="button"
            onClick={() => setVisibleTab(key as "home" | "shorts" | "subscriptions", !visibleTabs[key as keyof typeof visibleTabs])}
            className="ml-3"
          >
            <div className={`h-[26px] w-[46px] shrink-0 rounded-full transition-colors ${
              visibleTabs[key as keyof typeof visibleTabs] ? "bg-[#3ea6ff]" : "bg-[#555]"
            }`}>
              <div className={`mt-[3px] h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                visibleTabs[key as keyof typeof visibleTabs] ? "translate-x-[23px]" : "translate-x-[3px]"
              }`} />
            </div>
          </button>
        </div>
      ))}
    </div>
  );
}

function SettingsSection({ title, icon, children }: { readonly title: string; readonly icon: string; readonly children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 px-1">
        <span className="text-[14px]">{icon}</span>
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[#aaa]">
          {title}
        </h2>
      </div>
      <div className="flex flex-col divide-y divide-[#1f1f1f] rounded-xl bg-[#181818]">
        {children}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  readonly label: string;
  readonly description?: string;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center justify-between px-4 py-3.5 text-left active:bg-white/5"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[14px] text-white">{label}</p>
        {description && (
          <p className="mt-0.5 text-[12px] text-[#717171]">{description}</p>
        )}
      </div>
      <div
        className={`ml-3 h-[26px] w-[46px] shrink-0 rounded-full transition-colors ${
          value ? "bg-[#3ea6ff]" : "bg-[#555]"
        }`}
      >
        <div
          className={`mt-[3px] h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            value ? "translate-x-[23px]" : "translate-x-[3px]"
          }`}
        />
      </div>
    </button>
  );
}

interface SelectOption {
  readonly value: string;
  readonly label: string;
}

function CustomSelectRow({
  label,
  description,
  value,
  options,
  onChange,
  searchable = false,
}: {
  readonly label: string;
  readonly description?: string;
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly onChange: (value: string) => void;
  readonly searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  const filteredOptions = searchable && search.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        o.value.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  function handleOpen() {
    setSearch("");
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setSearch("");
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center justify-between px-4 py-3.5 text-left active:bg-white/5"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[14px] text-white">{label}</p>
          {description && (
            <p className="mt-0.5 text-[12px] text-[#717171]">{description}</p>
          )}
        </div>
        <div className="ml-3 flex shrink-0 items-center gap-1">
          <span className="text-[13px] text-[#3ea6ff]">{selectedLabel}</span>
          <svg viewBox="0 0 24 24" width={16} height={16} fill="#717171">
            <path d="M7 10l5 5 5-5z" />
          </svg>
        </div>
      </button>

      {/* Bottom sheet via portal — always renders at body root */}
      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 animate-fade-in"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-lg animate-slide-up rounded-t-2xl bg-[#212121] pb-[env(safe-area-inset-bottom,0px)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center py-3">
              <div className="h-1 w-10 rounded-full bg-[#555]" />
            </div>

            {/* Title */}
            <p className="px-5 pb-3 text-[15px] font-semibold text-white">{label}</p>

            {/* Search input */}
            {searchable && (
              <div className="px-5 pb-3">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  autoFocus
                  className="w-full rounded-lg bg-[#333] px-3 py-2 text-[14px] text-white outline-none placeholder:text-[#717171]"
                />
              </div>
            )}

            {/* Options */}
            <div className="max-h-[60vh] overflow-y-auto pb-4">
              {filteredOptions.length === 0 && (
                <p className="px-5 py-4 text-center text-[13px] text-[#717171]">Sin resultados</p>
              )}
              {filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); handleClose(); }}
                  className={`flex w-full items-center gap-3 px-5 py-3 text-left active:bg-white/5 ${
                    opt.value === value ? "text-[#3ea6ff]" : "text-white"
                  }`}
                >
                  {/* Radio indicator */}
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    opt.value === value ? "border-[#3ea6ff]" : "border-[#555]"
                  }`}>
                    {opt.value === value && (
                      <div className="h-2.5 w-2.5 rounded-full bg-[#3ea6ff]" />
                    )}
                  </div>
                  <span className="text-[14px]">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
