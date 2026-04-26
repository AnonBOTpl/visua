import { useState, useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  Search, X, ExternalLink, Loader2, ImageOff,
  AlertCircle, Download, Shield, ShieldOff, SlidersHorizontal,
  Sun, Moon, EyeOff, Trash2, Copy, Maximize2,
  ChevronDown, Check, Heart, Settings as SettingsIcon, Save, Key, Palette, Eye, Globe, Languages, Grid3X3, Laptop,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
  DrawerDescription, DrawerFooter, DrawerClose,
} from "@/components/ui/drawer";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/useMobile";
import { Checkbox } from "@/components/ui/checkbox";

// ─── Dark mode & Theme ────────────────────────────────────────────────────────

function useTheme(themeSetting: string) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    let isDark = false;

    if (themeSetting === "dark") {
      isDark = true;
    } else if (themeSetting === "light") {
      isDark = false;
    } else {
      isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    }

    setDark(isDark);
    root.classList.toggle("dark", isDark);
    root.classList.toggle("light", !isDark);
  }, [themeSetting]);

  return dark;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageResult {
  title: string;
  thumbnailUrl: string;
  sourceUrl: string;
  sourceDomain: string;
  originalUrl?: string;
  width?: number;
  height?: number;
  isSeen?: boolean;
  source?: string;
}

type ImageSize = "all" | "Small" | "Medium" | "Large" | "Wallpaper";
type SafeSearch = "active" | "off";
type SearchSource = "auto" | "serpapi" | "bing" | "yandex" | "brave" | string[];

interface Filters {
  imageSize: ImageSize;
  safeSearch: SafeSearch;
  source: SearchSource;
}

// ─── Options ──────────────────────────────────────────────────────────────────

const SIZE_OPTIONS: { value: ImageSize; label: string }[] = [
  { value: "all", label: "Dowolny rozmiar" }, { value: "Small", label: "Mały" },
  { value: "Medium", label: "Średni" }, { value: "Large", label: "Duży" },
  { value: "Wallpaper", label: "Tapeta" },
];

const LANG_OPTIONS = [
  { value: "en", label: "Angielski" },
  { value: "pl", label: "Polski" },
  { value: "all", label: "Wszystkie języki" },
];

const COUNTRY_OPTIONS = [
  { value: "ALL", label: "Cały świat" },
  { value: "PL", label: "Polska" },
  { value: "US", label: "Stany Zjednoczone" },
  { value: "UK", label: "Wielka Brytania" },
  { value: "DE", label: "Niemcy" },
];

const THEME_OPTIONS = [
  { value: "dark", label: "Ciemny", icon: Moon },
  { value: "light", label: "Jasny", icon: Sun },
  { value: "system", label: "Systemowy", icon: Laptop },
];

const COLUMNS_OPTIONS = [
  { value: "2", label: "2 kolumny" },
  { value: "3", label: "3 kolumny" },
  { value: "auto", label: "Automatycznie" },
];

const SEEN_MODE_OPTIONS = [
  { value: "off", label: "Wyłączone" },
  { value: "dim", label: "Wyszarzaj (domyślne)" },
  { value: "hide", label: "Ukrywaj całkowicie" },
];

// ─── Dropdown ─────────────────────────────────────────────────────────────────

function FilterDropdown<T extends string>({
  label, value, options, onChange,
}: {
  label: string; value: T;
  options: { value: T; label: string; dot?: string }[];
  onChange: (v: T) => void;
}) {
  const selected = options.find((o) => o.value === value);
  const isActive = value !== options[0].value;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-medium border transition-all duration-200 whitespace-nowrap flex-shrink-0 ${isActive ? "border-primary/60 text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground bg-transparent"}`}>
          {selected?.dot && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/20" style={{ background: selected.dot }} />}
          <span>{selected?.label ?? label}</span>
          <ChevronDown size={11} className="flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="rounded-xl border border-border shadow-2xl z-[9999] min-w-[150px] max-h-[300px] overflow-y-auto bg-card">
        {options.map((opt) => (
          <DropdownMenuItem key={opt.value} onClick={() => onChange(opt.value)}
            className={`flex items-center gap-2.5 px-3 py-2.5 text-xs cursor-pointer ${opt.value === value ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}>
            {opt.dot !== undefined && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/20" style={{ background: opt.dot || "transparent" }} />}
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Settings Modal/Drawer ────────────────────────────────────────────────────

function SettingsModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const isMobile = useIsMobile();
  const utils = trpc.useUtils();
  const { data: settings } = trpc.system.settings.get.useQuery();
  const setSetting = trpc.system.settings.set.useMutation({
    onSuccess: () => utils.system.settings.get.invalidate()
  });
  const setManySettings = trpc.system.settings.setMany.useMutation({
    onSuccess: () => utils.system.settings.get.invalidate()
  });
  const clearSeen = trpc.seen.clear.useMutation();
  const clearFavs = trpc.favs.clear.useMutation();

  const [braveKey, setBraveKey] = useState("");
  const [serpapiKey, setSerpapiKey] = useState("");

  if (!settings) return null;

  const handleUpdate = (key: string, value: string) => {
    setSetting.mutate({ key, value });
  };

  const handleSaveKeys = () => {
    const updates = [];
    if (braveKey) updates.push({ key: "brave_api_key", value: braveKey });
    if (serpapiKey) updates.push({ key: "serpapi_key", value: serpapiKey });
    if (updates.length > 0) {
      setManySettings.mutate({ settings: updates }, {
        onSuccess: () => {
          toast.success("Klucze API zostały zapisane");
          setBraveKey("");
          setSerpapiKey("");
        }
      });
    }
  };

  const exportFavs = async () => {
    const favs = await utils.favs.list.fetch();
    const blob = new Blob([JSON.stringify(favs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "visua_ulubione.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const content = (
    <div className="p-4 sm:p-6 space-y-8 overflow-y-auto max-h-[70vh]">
      {/* Search Section */}
      <section className="space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-primary uppercase tracking-wider">
          <Search size={16} /> Wyszukiwanie
        </h3>
        <div className="grid gap-4">
          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card/50">
             <div className="flex flex-col">
               <span className="text-sm font-medium">SafeSearch</span>
               <span className="text-xs text-muted-foreground">Filtruj treści dla dorosłych</span>
             </div>
             <Checkbox
               checked={settings.safesearch === "active"}
               onCheckedChange={(checked) => handleUpdate("safesearch", checked ? "active" : "off")}
             />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
             <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Languages size={12} /> Język wyników
                </label>
                <select
                  className="w-full h-10 px-3 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary/50"
                  value={settings.search_lang}
                  onChange={(e) => handleUpdate("search_lang", e.target.value)}
                >
                  {LANG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
             </div>
             <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Globe size={12} /> Kraj
                </label>
                <select
                  className="w-full h-10 px-3 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary/50"
                  value={settings.search_country}
                  onChange={(e) => handleUpdate("search_country", e.target.value)}
                >
                  {COUNTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
             </div>
          </div>
        </div>
      </section>

      {/* API Keys */}
      <section className="space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-primary uppercase tracking-wider">
          <Key size={16} /> Klucze API
        </h3>
        <div className="space-y-3">
          {[
            { id: "brave", label: "Brave Search", setKey: "brave_api_key_set", state: braveKey, setState: setBraveKey },
            { id: "serpapi", label: "Google (SerpApi)", setKey: "serpapi_key_set", state: serpapiKey, setState: setSerpapiKey },
          ].map(api => (
            <div key={api.id} className="p-4 rounded-xl border border-border bg-card/50 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{api.label}</span>
                  {settings[api.setKey] && <Check size={14} className="text-green-500" />}
                </div>
              </div>
              <div className="relative">
                <Input
                  type="password"
                  placeholder={settings[api.setKey] ? "••••••••••••••••" : "Wprowadź klucz API..."}
                  className="pr-10 h-10 rounded-xl"
                  value={api.state}
                  onChange={(e) => api.setState(e.target.value)}
                />
                <Key size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          ))}
          <Button onClick={handleSaveKeys} className="w-full rounded-xl gap-2 font-medium" disabled={!braveKey && !serpapiKey}>
             <Save size={16} /> Zapisz klucze
          </Button>
        </div>
      </section>

      {/* Appearance */}
      <section className="space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-primary uppercase tracking-wider">
          <Palette size={16} /> Wygląd
        </h3>
        <div className="grid gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">Motyw</label>
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map(o => (
                <button key={o.value} onClick={() => handleUpdate("theme", o.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${settings.theme === o.value ? "border-primary text-primary bg-primary/5" : "border-border text-muted-foreground hover:border-border/80"}`}>
                  <o.icon size={16} />
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Grid3X3 size={12} /> Kolumny siatki
            </label>
            <select
              className="w-full h-10 px-3 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary/50"
              value={settings.grid_columns}
              onChange={(e) => handleUpdate("grid_columns", e.target.value)}
            >
              {COLUMNS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-primary uppercase tracking-wider">
          <Shield size={16} /> Prywatność
        </h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Eye size={12} /> Widziane zdjęcia
            </label>
            <select
              className="w-full h-10 px-3 rounded-xl border border-border bg-card text-sm outline-none focus:border-primary/50"
              value={settings.seen_mode}
              onChange={(e) => handleUpdate("seen_mode", e.target.value)}
            >
              {SEEN_MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="rounded-xl border-border text-xs gap-1.5" onClick={() => {
              if (confirm("Czy na pewno chcesz wyczyścić historię widzianych zdjęć?")) {
                clearSeen.mutate(undefined, { onSuccess: () => { toast.success("Historia wyczyszczona"); utils.search.images.invalidate(); } });
              }
            }}>
              <Trash2 size={14} /> Wyczyść historię
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl border-border text-xs gap-1.5" onClick={() => {
              if (confirm("Czy na pewno chcesz usunąć wszystkie ulubione zdjęcia?")) {
                clearFavs.mutate(undefined, { onSuccess: () => { toast.success("Ulubione usunięte"); utils.favs.list.invalidate(); } });
              }
            }}>
              <Heart size={14} /> Usuń ulubione
            </Button>
          </div>
          <Button variant="outline" className="w-full rounded-xl gap-2 font-medium border-border" onClick={exportFavs}>
             <Download size={16} /> Eksportuj ulubione (JSON)
          </Button>
        </div>
      </section>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-background max-h-[90vh]">
          <DrawerHeader className="border-b border-border">
            <DrawerTitle>Ustawienia</DrawerTitle>
            <DrawerDescription>Dostosuj działanie i wygląd Visua</DrawerDescription>
          </DrawerHeader>
          {content}
          <DrawerFooter className="border-t border-border pt-4">
             <DrawerClose asChild><Button variant="outline" className="rounded-xl">Zamknij</Button></DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} style={{ background: "oklch(0 0 0 / 0.85)" }}>
      <div className="glass rounded-2xl max-w-2xl w-full flex flex-col shadow-2xl bg-card overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border bg-card/50">
          <div>
            <h2 className="text-lg font-bold text-foreground">Ustawienia</h2>
            <p className="text-xs text-muted-foreground">Dostosuj działanie i wygląd Visua</p>
          </div>
          <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-accent"><X size={20} /></button>
        </div>
        {content}
        <div className="p-4 border-t border-border bg-card/50 flex justify-end">
           <Button onClick={() => onOpenChange(false)} className="rounded-xl px-8" style={{ background: "linear-gradient(135deg, oklch(0.72 0.15 50), oklch(0.58 0.18 38))", color: "oklch(0.1 0.005 260)" }}>Gotowe</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({ filters, onChange, settings }: { filters: Filters; onChange: (f: Partial<Filters>) => void; settings: any }) {
  const isMobile = useIsMobile();
  const sources = [
    { id: "bing", label: "Bing + Yandex", shortLabel: "B+Y", always: true },
    { id: "brave", label: "Brave", shortLabel: "Brave" , keySet: "brave_api_key_set" },
    { id: "serpapi", label: "Google", shortLabel: "Google", keySet: "serpapi_key_set" },
  ];

  const currentSources = Array.isArray(filters.source) ? filters.source : ["bing", "yandex"];

  const toggleSource = (id: string) => {
    let next: string[];
    if (id === "bing") {
      if (currentSources.includes("bing")) {
        next = currentSources.filter(s => s !== "bing" && s !== "yandex");
      } else {
        next = [...currentSources, "bing", "yandex"];
      }
    } else {
      if (currentSources.includes(id)) {
        next = currentSources.filter(s => s !== id);
      } else {
        next = [...currentSources, id];
      }
    }

    if (next.length === 0) next = ["bing", "yandex"];
    onChange({ source: next });
  };

  const isSelected = (id: string) => {
    if (id === "bing") return currentSources.includes("bing") || currentSources.includes("yandex");
    return currentSources.includes(id);
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
      <div className="flex items-center gap-1 text-muted-foreground flex-shrink-0 mr-1">
        <SlidersHorizontal size={13} />
      </div>

      {/* Multi-select sources */}
      <div className="flex items-center gap-1.5 mr-2 pr-2 border-r border-border flex-shrink-0">
        {sources.map(s => {
          if (!s.always && (!settings || !settings[s.keySet])) return null;
          const active = isSelected(s.id);
          return (
            <button key={s.id} onClick={() => toggleSource(s.id)}
              className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-[11px] sm:text-xs font-medium border transition-all duration-200 whitespace-nowrap ${active ? "border-primary/60 text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"}`}>
              {active && <Check size={11} />}
              {isMobile ? s.shortLabel : s.label}
            </button>
          );
        })}
      </div>

      <FilterDropdown label="Rozmiar" value={filters.imageSize} options={SIZE_OPTIONS} onChange={(v) => onChange({ imageSize: v })} />
    </div>
  );
}

// ─── Image card ───────────────────────────────────────────────────────────────

function ImageCard({ image, seen, onClick, removing }: { image: ImageResult; seen: boolean; onClick: () => void; removing?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const isMobile = useIsMobile();

  if (imgError) return null;

  const aspectRatio = image.width && image.height ? image.width / image.height : null;

  return (
    <div
      className={`masonry-item group cursor-pointer relative overflow-hidden rounded-xl active:scale-[0.97] transition-all duration-500 bg-card ${seen ? "opacity-40" : ""} ${isMobile ? "rounded-lg" : "rounded-xl"} ${removing ? "opacity-0 scale-95 translate-y-4" : "opacity-100 scale-100 translate-y-0"}`}
      onClick={onClick}
      style={{
        aspectRatio: aspectRatio ? `${aspectRatio}` : undefined,
        minHeight: !loaded && !aspectRatio ? 160 : undefined
      }}
    >
      {!loaded && <div className="shimmer absolute inset-0 rounded-xl" />}
      <img src={image.thumbnailUrl} alt={image.title}
          className={`w-full h-full rounded-xl object-cover transition-all duration-300 group-hover:brightness-90 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)} onError={() => setImgError(true)} loading="lazy" />
      <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2.5">
        {image.title && <p className="text-white text-[11px] font-medium line-clamp-2 leading-snug mb-0.5">{image.title}</p>}
        <div className="flex items-center justify-between gap-2">
          {image.sourceDomain && <span className="text-white/60 text-[10px] truncate flex-1">{image.sourceDomain}</span>}
          {image.source && (
            <span className="text-[9px] px-1 rounded bg-white/20 text-white/90 font-medium uppercase tracking-wider">
              {image.source === "serpapi" ? "Google" : image.source}
            </span>
          )}
        </div>
        {image.width && image.height && <span className="text-white/50 text-[10px]">{image.width}×{image.height}</span>}
      </div>
      {seen && (
        <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1">
          <EyeOff size={10} className="text-white/70" />
        </div>
      )}
    </div>
  );
}

// ─── Download helper ──────────────────────────────────────────────────────────

async function downloadImage(imgUrl: string, onStart: () => void, onDone: () => void) {
  onStart();
  try {
    const res = await fetch(`/api/download?url=${encodeURIComponent(imgUrl)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const rawName = imgUrl.split("/").pop()?.split("?")[0] ?? "image";
    const filename = rawName.includes(".") ? rawName : `${rawName}.jpg`;
    const a = document.createElement("a");
    a.href = blobUrl; a.download = filename; a.style.display = "none";
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(blobUrl); }, 1500);
    toast.success("Zdjęcie pobrane");
  } catch (err) {
    toast.error("Nie udało się pobrać zdjęcia");
  } finally {
    onDone();
  }
}

// ─── Image info hook ──────────────────────────────────────────────────────────

interface ImgInfo { width: number; height: number; sizeKB: number | null; }

function useImageInfo(url: string | undefined): ImgInfo | null {
  const [info, setInfo] = useState<ImgInfo | null>(null);
  useEffect(() => {
    if (!url) return;
    setInfo(null);
    const img = new Image();
    img.onload = () => setInfo((p) => ({ width: img.naturalWidth, height: img.naturalHeight, sizeKB: p?.sizeKB ?? null }));
    img.src = url;
    fetch(`/api/download?url=${encodeURIComponent(url)}`, { method: 'HEAD' })
      .then(async (res) => {
        const cl = res.headers.get("content-length");
        const sizeKB = cl ? Math.round(parseInt(cl) / 1024) : null;
        setInfo((p) => p ? { ...p, sizeKB } : { width: 0, height: 0, sizeKB });
      }).catch(() => {});
  }, [url]);
  return info;
}

// ─── Image preview modal/drawer ───────────────────────────────────────────────

function ImagePreview({ image, onClose }: { image: ImageResult; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const isMobile = useIsMobile();
  const previewUrl = image.originalUrl || image.thumbnailUrl;
  const info = useImageInfo(previewUrl);

  const handleDownload = () => {
    if (!previewUrl) return;
    downloadImage(previewUrl, () => setDownloading(true), () => setDownloading(false));
  };

  const handleCopyLink = () => {
    if (!previewUrl) return;
    navigator.clipboard.writeText(previewUrl);
    toast.success("Link skopiowany do schowka");
  };

  const addFav = trpc.favs.add.useMutation();
  const removeFav = trpc.favs.remove.useMutation();
  const utils = trpc.useUtils();
  const { data: currentFavs } = trpc.favs.list.useQuery();
  const isFav = currentFavs?.some(f => f.thumbnailUrl === image.thumbnailUrl);

  const toggleFav = () => {
    if (isFav) {
      removeFav.mutate({ thumbnailUrl: image.thumbnailUrl }, {
        onSuccess: () => {
          utils.favs.list.invalidate();
          toast.success("Usunięto z ulubionych");
        },
        onError: (err) => {
          toast.error(`Błąd: ${err.message}`);
        }
      });
    } else {
      const favData = {
        title: image.title,
        thumbnailUrl: image.thumbnailUrl,
        sourceUrl: image.sourceUrl,
        originalUrl: image.originalUrl,
        sourceDomain: image.sourceDomain,
        width: image.width,
        height: image.height,
      };
      addFav.mutate(favData, {
        onSuccess: () => {
          utils.favs.list.invalidate();
          toast.success("Dodano do ulubionych");
        },
        onError: (err) => {
          toast.error(`Błąd: ${err.message}`);
        }
      });
    }
  };

  const infoBadge = info && (info.width > 0 || info.sizeKB !== null) ? (
    <div className="flex items-center gap-2 flex-wrap mt-1.5">
      {info.width > 0 && info.height > 0 && (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">{info.width}×{info.height}</span>
      )}
      {info.sizeKB !== null && (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${info.sizeKB < 50 ? "bg-destructive/10 text-destructive" : info.sizeKB < 300 ? "bg-yellow-500/10 text-yellow-600" : "bg-green-500/10 text-green-600"}`}>
          {info.sizeKB < 1024 ? `${info.sizeKB} KB` : `${(info.sizeKB / 1024).toFixed(1)} MB`}
          {info.sizeKB < 50 && " · miniaturka!"}
        </span>
      )}
    </div>
  ) : null;

  const previewContent = (
    <>
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-[180px]">
        {!loaded && <div className="flex items-center justify-center" style={{ minHeight: 180 }}><Loader2 className="animate-spin text-primary" size={28} /></div>}
        <img src={previewUrl} alt={image.title}
          className={`max-w-full rounded-xl object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0 absolute"}`}
          style={{ maxHeight: isMobile ? "45vh" : "60vh" }}
          onLoad={() => setLoaded(true)}
          onError={(e) => { const t = e.currentTarget; if (t.src !== image.thumbnailUrl) t.src = image.thumbnailUrl; setLoaded(true); }} />
      </div>
      <div className="p-4 border-t border-border flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-2 flex-1">
            <Button onClick={toggleFav} variant="outline" size={isMobile ? "default" : "sm"}
              className={`rounded-xl gap-2 border-border ${isMobile ? "h-11 w-11 p-0" : "h-9 px-3"} ${isFav ? "text-red-500 bg-red-500/10 border-red-500/20" : ""}`}
              title={isFav ? "Usuń z ulubionych" : "Dodaj do ulubionych"}>
              <Heart size={15} fill={isFav ? "currentColor" : "none"} />
              {!isMobile && (isFav ? "Zapisano" : "Zapisz")}
            </Button>
            <Button onClick={handleDownload} disabled={downloading} size={isMobile ? "default" : "sm"}
              className={`rounded-xl gap-2 font-medium ${isMobile ? "h-11 px-5 text-sm flex-1" : "h-9 px-4 text-sm"}`}
              style={{ background: "linear-gradient(135deg, oklch(0.72 0.15 50), oklch(0.58 0.18 38))", color: "oklch(0.1 0.005 260)" }}>
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {downloading ? "Pobieranie…" : "Pobierz"}
            </Button>
            <Button onClick={handleCopyLink} variant="outline" size={isMobile ? "default" : "sm"}
              className={`rounded-xl gap-2 border-border ${isMobile ? "h-11 w-11 p-0" : "h-9 px-3"}`}
              title="Kopiuj link do zdjęcia">
              <Copy size={15} />
              {!isMobile && "Kopiuj link"}
            </Button>
          </div>
          {image.sourceUrl && (
            <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-medium text-sm">
              Źródło <ExternalLink size={14} />
            </a>
          )}
        </div>
        {previewUrl && (
          <a href={previewUrl} target="_blank" rel="noopener noreferrer"
             className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 self-start">
            <Maximize2 size={10} /> Otwórz oryginalne zdjęcie w nowej karcie
          </a>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DrawerContent className="flex flex-col bg-background" style={{ maxHeight: "92vh" }}>
          <DrawerHeader className="border-b border-border pb-3 pt-4 px-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {image.title && <DrawerTitle className="text-foreground font-medium text-sm leading-snug line-clamp-2 text-left">{image.title}</DrawerTitle>}
                {image.sourceDomain && <DrawerDescription className="text-muted-foreground text-xs mt-0.5 text-left">{image.sourceDomain}</DrawerDescription>}
                {infoBadge}
              </div>
              <DrawerClose asChild>
                <button aria-label="Zamknij podgląd" className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-accent flex-shrink-0"><X size={18} /></button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          {previewContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "oklch(0 0 0 / 0.85)" }} onClick={onClose}>
      <div className="glass rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl bg-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-4 border-b border-border">
          <div className="flex-1 min-w-0 pr-4">
            {image.title && <h2 className="text-foreground font-medium text-sm leading-snug line-clamp-2">{image.title}</h2>}
            {image.sourceDomain && <p className="text-muted-foreground text-xs mt-1">{image.sourceDomain}</p>}
            {infoBadge}
          </div>
          <button aria-label="Zamknij podgląd" onClick={onClose} className="text-muted-foreground hover:text-foreground flex-shrink-0 p-1 rounded-lg hover:bg-accent"><X size={18} /></button>
        </div>
        {previewContent}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonGrid() {
  const heights = [160, 220, 140, 190, 210, 160, 180, 240, 150, 200, 220, 170];
  return (
    <div className="masonry-grid">
      {heights.map((h, i) => <div key={i} className="masonry-item"><div className="shimmer rounded-xl" style={{ height: h }} /></div>)}
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ onSearch, filters, onFiltersChange, settings }: {
  onSearch: (q: string) => void;
  filters: Filters;
  onFiltersChange: (f: Partial<Filters>) => void;
  settings: any;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="flex flex-col items-center justify-center min-h-[55vh] px-2 text-center">
      <div className="mb-5">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mx-auto mb-3"
          style={{ background: "linear-gradient(135deg, oklch(0.72 0.15 50), oklch(0.55 0.18 35))", boxShadow: "0 0 32px oklch(0.72 0.15 50 / 0.3)" }}>
          <Search size={24} className="text-background" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-semibold gradient-text mb-2 tracking-tight">Visua</h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-xs mx-auto leading-relaxed">Przeszukuj cały internet w poszukiwaniu zdjęć — pięknie.</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSearch(value.trim()); }} className="w-full max-w-xl mt-3">
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1 flex items-center">
            <Search size={17} className="absolute left-4 text-muted-foreground pointer-events-none z-10" />
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Szukaj dowolnego zdjęcia..."
              className="pl-11 pr-28 h-14 text-base rounded-2xl border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50" autoFocus />
            <Button type="submit" disabled={!value.trim()} className="absolute right-2 h-10 px-5 rounded-xl font-medium text-sm"
              style={{ background: "linear-gradient(135deg, oklch(0.72 0.15 50), oklch(0.58 0.18 38))", color: "oklch(0.1 0.005 260)" }}>
              Szukaj
            </Button>
          </div>
        </div>
      </form>
      <div className="mt-4 w-full max-w-xl"><FilterBar filters={filters} onChange={onFiltersChange} settings={settings} /></div>
      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        {["Architektura", "Przyroda", "Sztuka abstrakcyjna", "Kosmos", "Portrety"].map((s) => (
          <button key={s} onClick={() => onSearch(s)} className="px-3 py-1.5 rounded-full text-xs text-muted-foreground border border-border hover:border-primary/50 hover:text-foreground transition-all active:scale-95">{s}</button>
        ))}
      </div>
    </div>
  );
}

// ─── Top search bar ───────────────────────────────────────────────────────────

function TopSearchBar({ query, onSearch }: { query: string; onSearch: (q: string) => void }) {
  const [value, setValue] = useState(query);
  useEffect(() => { setValue(query); }, [query]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSearch(value.trim()); }} className="flex-1 min-w-0">
      <div className="relative flex items-center">
        <Search size={15} className="absolute left-3 text-muted-foreground pointer-events-none z-10" />
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Szukaj zdjęć..."
          className="pl-8 pr-20 h-10 rounded-xl border-border bg-card text-foreground placeholder:text-muted-foreground text-sm" />
        <Button type="submit" disabled={!value.trim()} size="sm" className="absolute right-1.5 h-7 px-3 rounded-lg text-xs font-medium"
          style={{ background: "linear-gradient(135deg, oklch(0.72 0.15 50), oklch(0.58 0.18 38))", color: "oklch(0.1 0.005 260)" }}>
          Szukaj
        </Button>
      </div>
    </form>
  );
}

// ─── Infinite scroll hook ────────────────────────────────────────────────────

function useInfiniteScroll(onLoadMore: () => void, enabled: boolean) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!enabled) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) onLoadMore(); },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onLoadMore, enabled]);
  return sentinelRef;
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;

export default function Home() {
  const [view, setView] = useState<"search" | "favs">("search");
  const [activeQuery, setActiveQuery] = useState("");
  const [allResults, setAllResults] = useState<ImageResult[]>([]);
  const [modalImage, setModalImage] = useState<ImageResult | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    imageSize: "all",
    safeSearch: "active", source: ["bing", "yandex"],
  });
  const [committedFilters, setCommittedFilters] = useState<Filters>({
    imageSize: "all",
    safeSearch: "active", source: ["bing", "yandex"],
  });
  const [seenUrls, setSeenUrls] = useState<Set<string>>(new Set());
  const [currentStart, setCurrentStart] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const scrollPosRef = useRef(0);

  const { data: settings } = trpc.system.settings.get.useQuery();
  useTheme(settings?.theme || "dark");

  const markSeenMutation = trpc.seen.mark.useMutation();
  const { data: favs } = trpc.favs.list.useQuery();

  // Load default filters from settings
  useEffect(() => {
    if (settings && !activeQuery) {
       setFilters(prev => ({
         ...prev,
         imageSize: (settings.default_image_size as any) || "all",
         safeSearch: (settings.safesearch as any) || "active",
       }));
    }
  }, [settings, activeQuery]);

  const { data, isLoading, isFetching, error, refetch } = trpc.search.images.useQuery(
    {
      query: activeQuery,
      start: currentStart,
      imageSize: committedFilters.imageSize,
      safeSearch: committedFilters.safeSearch,
      source: committedFilters.source
    },
    { enabled: !!activeQuery, retry: false, refetchOnWindowFocus: false, staleTime: 0 }
  );

  // Accumulate results as pages load
  useEffect(() => {
    if (!data) return;
    if (currentStart === 0) {
      setAllResults(data.results);
    } else {
      setAllResults((prev) => {
        const existing = new Set(prev.map((r) => r.thumbnailUrl));
        const newOnes = data.results.filter((r) => !existing.has(r.thumbnailUrl));
        return [...prev, ...newOnes];
      });
    }
    setSources(data.sources || []);
    setHasMore(data.hasMore);
    setLoadingMore(false);
  }, [data, currentStart]);

  const handleSearch = useCallback(async (q: string) => {
    setView("search");
    setActiveQuery(q);
    setCurrentStart(0);
    setAllResults([]);
    setHasMore(false);
    setSources([]);
    setCommittedFilters(filters);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [filters]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || isFetching || !hasMore || view === "favs") return;
    setLoadingMore(true);
    setCurrentStart((prev) => {
      if (data && 'nextStart' in data && typeof data.nextStart === 'number') {
        return data.nextStart;
      }
      return prev + PAGE_SIZE;
    });
  }, [loadingMore, isFetching, hasMore, data, view]);

  const sentinelRef = useInfiniteScroll(handleLoadMore, hasMore && !loadingMore && !isFetching);

  const handleImageClick = (image: ImageResult) => {
    const scrollPos = window.scrollY;
    scrollPosRef.current = scrollPos;
    setModalImage(image);

    // Mark seen
    const urls = [image.thumbnailUrl, image.originalUrl].filter(Boolean) as string[];
    setSeenUrls((prev) => new Set([...prev, ...urls]));
    setAllResults((prev) => prev.map(r =>
      (r.thumbnailUrl === image.thumbnailUrl || (r.originalUrl && r.originalUrl === image.originalUrl))
      ? { ...r, isSeen: true }
      : r
    ));
    markSeenMutation.mutate({ urls });
  };

  const handleCloseModal = () => {
    const scrollPos = scrollPosRef.current;
    const currentImg = modalImage;
    setModalImage(null);

    // Dynamic hide logic
    if (settings?.seen_mode === "hide" && currentImg) {
       setRemovingId(currentImg.thumbnailUrl);
       setTimeout(() => {
          setAllResults(prev => prev.filter(r => r.thumbnailUrl !== currentImg.thumbnailUrl));
          setRemovingId(null);
       }, 500);
    }

    setTimeout(() => {
      window.scrollTo({ top: scrollPos, behavior: 'instant' as any });
    }, 100);
    setTimeout(() => {
      window.scrollTo({ top: scrollPos, behavior: 'instant' as any });
    }, 250);
  };

  const hasResults = allResults.length > 0;
  const isLoadingFirst = isLoading && currentStart === 0;

  // Grid columns logic
  const gridColumns = settings?.grid_columns || "auto";
  const gridClass = gridColumns === "2" ? "grid-cols-2 sm:grid-cols-2" : gridColumns === "3" ? "grid-cols-2 sm:grid-cols-3" : "masonry-grid";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border" style={{ backdropFilter: "blur(12px)" }}>
        <div className="container flex items-center gap-3 h-14 sm:h-16">
          <a href="/" className="flex items-center gap-2 flex-shrink-0"
            onClick={(e) => { e.preventDefault(); setView("search"); setActiveQuery(""); setAllResults([]); setCurrentStart(0); }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, oklch(0.72 0.15 50), oklch(0.55 0.18 35))" }}>
              <Search size={13} className="text-background" />
            </div>
            <span className="font-semibold text-sm gradient-text hidden sm:block">Visua</span>
          </a>

          {activeQuery && <TopSearchBar query={activeQuery} onSearch={handleSearch} />}

          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            {sources.length > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border bg-muted/30">
                {sources.map(s => (
                  <span key={s} className="text-[10px] font-bold text-primary uppercase w-4 text-center" title={s === "serpapi" ? "Google" : s.charAt(0).toUpperCase() + s.slice(1)}>
                    {s === "serpapi" ? "G" : s.charAt(0).toUpperCase()}
                  </span>
                ))}
              </div>
            )}

            {/* Favorites */}
            <button onClick={() => setView(v => v === "search" ? "favs" : "search")} title="Moje Ulubione"
              className={`p-2 rounded-xl transition-all ${view === "favs" ? "text-red-500 bg-red-500/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
              <Heart size={16} fill={view === "favs" ? "currentColor" : "none"} />
            </button>

            {/* Settings */}
            <button onClick={() => setSettingsOpen(true)} title="Ustawienia"
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
              <SettingsIcon size={16} />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        {activeQuery && (
          <div className="border-t border-border">
            <div className="container py-2">
              <FilterBar filters={filters} onChange={(p) => setFilters((prev) => ({ ...prev, ...p }))} settings={settings} />
            </div>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="container py-6 sm:py-8">
        {view === "favs" ? (
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-semibold gradient-text">Moje Ulubione</h1>
                <p className="text-muted-foreground text-sm mt-1">Twoja kolekcja pięknych obrazów.</p>
              </div>
              <Button onClick={() => setView("search")} variant="outline" className="rounded-xl border-border">Powrót do wyszukiwania</Button>
            </div>
            {!favs?.length ? (
              <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4"><Heart size={32} className="text-muted-foreground" /></div>
                <h3 className="text-foreground font-medium">Brak ulubionych</h3>
                <p className="text-muted-foreground text-sm max-w-xs">Dodaj serduszko przy zdjęciu podczas wyszukiwania, aby zobaczyć je tutaj.</p>
              </div>
            ) : (
              <div className={gridClass === "masonry-grid" ? "masonry-grid" : "grid " + gridClass + " gap-4"}>
                {favs.map((img, i) => (
                  <ImageCard key={img.thumbnailUrl + i} image={img} seen={false} onClick={() => handleImageClick(img)} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {!activeQuery && <Hero onSearch={handleSearch} filters={filters} onFiltersChange={(p) => setFilters((prev) => ({ ...prev, ...p }))} settings={settings} />}

        {isLoadingFirst && (
          <div>
            <div className="flex items-center gap-2 mb-5">
              <Loader2 className="animate-spin text-primary" size={15} />
              <span className="text-muted-foreground text-sm">Szukanie <span className="text-foreground font-medium">&ldquo;{activeQuery}&rdquo;</span>&hellip;</span>
            </div>
            <SkeletonGrid />
          </div>
        )}

        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-destructive/15"><AlertCircle size={24} className="text-destructive" /></div>
            <h3 className="text-foreground font-medium mb-2">Wyszukiwanie nieudane</h3>
            <p className="text-muted-foreground text-sm max-w-xs mb-6">{error.message || "Wystąpił nieoczekiwany błąd."}</p>
            <Button onClick={() => refetch()} variant="outline" size="sm" className="border-border text-foreground hover:bg-accent">Spróbuj ponownie</Button>
          </div>
        )}

        {!isLoading && !error && activeQuery && !hasResults && data && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-muted"><ImageOff size={24} className="text-muted-foreground" /></div>
            <h3 className="text-foreground font-medium mb-2">Brak wyników</h3>
            <p className="text-muted-foreground text-sm max-w-xs">Spróbuj wpisać inne hasło lub dostosuj filtry.</p>
          </div>
        )}

        {hasResults && (
          <div>
            <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2 flex-wrap">
              <p className="text-muted-foreground text-xs sm:text-sm">
                <span className="text-foreground font-medium">&ldquo;{activeQuery}&rdquo;</span>
                <span className="ml-2 text-xs">&middot; {allResults.length} obrazów</span>
                {seenUrls.size > 0 && <span className="ml-2 text-xs">&middot; {seenUrls.size} widzianych</span>}
              </p>
            </div>

            <div className={gridClass === "masonry-grid" ? "masonry-grid" : "grid " + gridClass + " gap-4"}>
              {allResults.map((img, i) => (
                <ImageCard
                  key={img.thumbnailUrl + i}
                  image={img}
                  seen={img.isSeen || seenUrls.has(img.thumbnailUrl) || (img.originalUrl ? seenUrls.has(img.originalUrl) : false)}
                  onClick={() => handleImageClick(img)}
                  removing={removingId === img.thumbnailUrl}
                />
              ))}
            </div>

            {/* Infinite scroll sentinel */}
            {hasMore && (
              <div ref={sentinelRef} className="h-8 mt-4" />
            )}

            {(loadingMore || (isFetching && currentStart > 0)) && (
              <div className="mt-4"><SkeletonGrid /></div>
            )}
          </div>
        )}
          </>
        )}
      </main>

      {modalImage && <ImagePreview image={modalImage} onClose={handleCloseModal} />}
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
