import { useState, useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  Search, X, ExternalLink, Loader2, ImageOff,
  AlertCircle, Download, Shield, ShieldOff, SlidersHorizontal,
  Sun, Moon, Upload, EyeOff, Eye, Trash2, Copy, Maximize2,
  ChevronDown, Check, Heart, Bookmark,
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

// ─── Dark mode ────────────────────────────────────────────────────────────────

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    try {
      const s = localStorage.getItem("visua-theme");
      if (s) return s === "dark";
    } catch {}
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.classList.toggle("light", !dark);
    try { localStorage.setItem("visua-theme", dark ? "dark" : "light"); } catch {}
  }, [dark]);
  return [dark, setDark] as const;
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

type ImageType = "all" | "photo" | "clipart" | "gif" | "lineart" | "face";
type ImageSize = "all" | "Small" | "Medium" | "Large" | "Wallpaper";
type ImageColor = "all" | "color" | "Monochrome" | "Red" | "Orange" | "Yellow" | "Green" | "Blue" | "Purple" | "Pink" | "Brown" | "Black" | "Gray" | "Teal" | "White";
type SafeSearch = "active" | "off";
type SearchSource = "auto" | "serpapi" | "bing" | "yandex" | string[];

interface Filters {
  imageType: ImageType;
  imageSize: ImageSize;
  imageColor: ImageColor;
  safeSearch: SafeSearch;
  source: SearchSource;
}

const DEFAULT_FILTERS: Filters = {
  imageType: "all", imageSize: "all", imageColor: "all",
  safeSearch: "active", source: "auto",
};

// ─── Filter options ───────────────────────────────────────────────────────────

const SOURCE_OPTIONS: { value: SearchSource; label: string }[] = [
  { value: "auto", label: "Auto (Google → Bing → Yandex)" },
  { value: "serpapi", label: "Google Images" },
  { value: "bing", label: "Bing Images" },
  { value: "yandex", label: "Yandex Images" },
];
const TYPE_OPTIONS: { value: ImageType; label: string }[] = [
  { value: "all", label: "All types" }, { value: "photo", label: "Photos" },
  { value: "clipart", label: "Clipart" }, { value: "gif", label: "GIFs" },
  { value: "lineart", label: "Line art" }, { value: "face", label: "Faces" },
];
const SIZE_OPTIONS: { value: ImageSize; label: string }[] = [
  { value: "all", label: "Any size" }, { value: "Small", label: "Small" },
  { value: "Medium", label: "Medium" }, { value: "Large", label: "Large" },
  { value: "Wallpaper", label: "Wallpaper" },
];
const COLOR_OPTIONS: { value: ImageColor; label: string; dot?: string }[] = [
  { value: "all", label: "Any color" },
  { value: "color", label: "Full color", dot: "linear-gradient(135deg,red,blue,green)" },
  { value: "Monochrome", label: "B&W", dot: "linear-gradient(135deg,#000,#fff)" },
  { value: "Red", label: "Red", dot: "#e53e3e" }, { value: "Orange", label: "Orange", dot: "#ed8936" },
  { value: "Yellow", label: "Yellow", dot: "#ecc94b" }, { value: "Green", label: "Green", dot: "#48bb78" },
  { value: "Teal", label: "Teal", dot: "#38b2ac" }, { value: "Blue", label: "Blue", dot: "#4299e1" },
  { value: "Purple", label: "Purple", dot: "#9f7aea" }, { value: "Pink", label: "Pink", dot: "#ed64a6" },
  { value: "Brown", label: "Brown", dot: "#a0522d" }, { value: "Black", label: "Black", dot: "#1a1a1a" },
  { value: "Gray", label: "Gray", dot: "#718096" }, { value: "White", label: "White", dot: "#f7fafc" },
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

// ─── Mobile filter drawer ─────────────────────────────────────────────────────

function MobileFilterDrawer({ filters, onChange, activeCount }: {
  filters: Filters; onChange: (f: Partial<Filters>) => void; activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-medium border transition-all duration-200 whitespace-nowrap flex-shrink-0 ${activeCount > 0 ? "border-primary/60 text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"}`}>
        <SlidersHorizontal size={13} />
        <span>Filters</span>
        {activeCount > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">{activeCount}</span>}
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="flex flex-col bg-background" style={{ maxHeight: "85vh" }}>
          <DrawerHeader className="border-b border-border pb-3">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-foreground font-semibold text-base">Filters</DrawerTitle>
              <DrawerClose asChild>
                <button className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-accent"><X size={18} /></button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Source */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Source</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onChange({ source: "auto" })}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border text-left transition-all ${filters.source === "auto" ? "border-primary/60 text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  <div className={`w-3.5 h-3.5 rounded border border-primary flex items-center justify-center ${filters.source === "auto" ? "bg-primary" : ""}`}>
                    {filters.source === "auto" && <Check size={10} className="text-primary-foreground" />}
                  </div>
                  All Sources (Auto)
                </button>
                {[
                  { id: "serpapi", label: "Google" },
                  { id: "bing", label: "Bing" },
                  { id: "yandex", label: "Yandex" },
                ].map((opt) => {
                  const current = Array.isArray(filters.source) ? filters.source : filters.source === "auto" ? ["serpapi", "bing", "yandex"] : [filters.source];
                  const isSelected = current.includes(opt.id) && filters.source !== "auto";

                  const toggle = () => {
                    let next: string[];
                    if (current.includes(opt.id)) {
                      next = current.filter(x => x !== opt.id);
                    } else {
                      next = [...current, opt.id];
                    }
                    if (next.length === 0 || next.length === 3) onChange({ source: "auto" });
                    else onChange({ source: next });
                  };

                  return (
                    <button key={opt.id} onClick={toggle}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border text-left transition-all ${isSelected ? "border-primary/60 text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"}`}>
                      <div className={`w-3.5 h-3.5 rounded border border-primary flex items-center justify-center ${isSelected ? "bg-primary" : ""}`}>
                        {isSelected && <Check size={10} className="text-primary-foreground" />}
                      </div>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Type */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</p>
              <div className="grid grid-cols-3 gap-2">
                {TYPE_OPTIONS.map((opt) => (
                  <button key={opt.value} onClick={() => onChange({ imageType: opt.value })}
                    className={`px-3 py-2.5 rounded-xl text-xs font-medium border text-center transition-all ${filters.imageType === opt.value ? "border-primary/60 text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Size */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Size</p>
              <div className="grid grid-cols-3 gap-2">
                {SIZE_OPTIONS.map((opt) => (
                  <button key={opt.value} onClick={() => onChange({ imageSize: opt.value })}
                    className={`px-3 py-2.5 rounded-xl text-xs font-medium border text-center transition-all ${filters.imageSize === opt.value ? "border-primary/60 text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Color */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Color</p>
              <div className="grid grid-cols-4 gap-2">
                {COLOR_OPTIONS.map((opt) => (
                  <button key={opt.value} onClick={() => onChange({ imageColor: opt.value })}
                    className={`flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl text-[10px] font-medium border transition-all ${filters.imageColor === opt.value ? "border-primary/60 text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"}`}>
                    <span className="w-5 h-5 rounded-full border border-white/20 flex-shrink-0" style={{ background: opt.dot || "transparent" }} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Safe search */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Safe Search</p>
              <div className="grid grid-cols-2 gap-2">
                {(["active", "off"] as SafeSearch[]).map((v) => (
                  <button key={v} onClick={() => onChange({ safeSearch: v })}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all ${filters.safeSearch === v ? (v === "off" ? "border-destructive/60 text-destructive bg-destructive/10" : "border-primary/60 text-primary bg-primary/10") : "border-border text-muted-foreground hover:text-foreground"}`}>
                    {v === "active" ? <Shield size={12} /> : <ShieldOff size={12} />}
                    {v === "active" ? "Safe On" : "Safe Off"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DrawerFooter className="border-t border-border pt-3">
            <div className="flex gap-2">
              {activeCount > 0 && (
                <Button variant="outline" className="flex-1 border-border text-foreground hover:bg-accent rounded-xl" onClick={() => onChange(DEFAULT_FILTERS)}>Reset all</Button>
              )}
              <Button className="flex-1 rounded-xl font-medium" style={{ background: "linear-gradient(135deg, oklch(0.72 0.15 50), oklch(0.58 0.18 38))", color: "oklch(0.1 0.005 260)" }} onClick={() => setOpen(false)}>Apply</Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}

// ─── Source Filter ────────────────────────────────────────────────────────────

function SourceFilter({ value, onChange }: { value: SearchSource; onChange: (v: SearchSource) => void }) {
  const sources = [
    { id: "serpapi", label: "Google" },
    { id: "bing", label: "Bing" },
    { id: "yandex", label: "Yandex" },
  ];

  const current = Array.isArray(value) ? value : value === "auto" ? sources.map(s => s.id) : [value];

  const toggle = (id: string) => {
    let next: string[];
    if (current.includes(id)) {
      next = current.filter(x => x !== id);
    } else {
      next = [...current, id];
    }
    if (next.length === 0) onChange("auto");
    else if (next.length === sources.length && value === "auto") onChange(next); // Stay in manual if explicitly toggling
    else if (next.length === sources.length) onChange("auto");
    else onChange(next);
  };

  const label = value === "auto" ? "All Sources" : Array.isArray(value) ? `${value.length} Sources` : sources.find(s => s.id === value)?.label || "Source";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-medium border transition-all duration-200 whitespace-nowrap flex-shrink-0 ${value !== "auto" ? "border-primary/60 text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground bg-transparent"}`}>
          <span>{label}</span>
          <ChevronDown size={11} className="flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="rounded-xl border border-border shadow-2xl z-[9999] min-w-[150px] bg-card p-1">
        <DropdownMenuItem onClick={() => onChange("auto")} className={`flex items-center gap-2 px-2 py-2 text-xs cursor-pointer rounded-lg ${value === "auto" ? "bg-primary/10 text-primary" : ""}`}>
          <div className={`w-3.5 h-3.5 rounded border border-primary flex items-center justify-center ${value === "auto" ? "bg-primary" : ""}`}>
            {value === "auto" && <Check size={10} className="text-primary-foreground" />}
          </div>
          All Sources (Auto)
        </DropdownMenuItem>
        <div className="h-px bg-border my-1" />
        {sources.map(s => (
          <DropdownMenuItem key={s.id} onClick={(e) => { e.preventDefault(); toggle(s.id); }} className={`flex items-center gap-2 px-2 py-2 text-xs cursor-pointer rounded-lg ${current.includes(s.id) && value !== "auto" ? "bg-primary/5 text-foreground" : ""}`}>
            <div className={`w-3.5 h-3.5 rounded border border-primary flex items-center justify-center ${current.includes(s.id) ? "bg-primary" : ""}`}>
              {current.includes(s.id) && <Check size={10} className="text-primary-foreground" />}
            </div>
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Partial<Filters>) => void }) {
  const isMobile = useIsMobile();
  const activeCount = Object.entries(filters).filter(([k, v]) => {
    if (k === "safeSearch") return v === "off";
    if (k === "source") return v !== "auto";
    return v !== "all";
  }).length;

  if (isMobile) return <MobileFilterDrawer filters={filters} onChange={onChange} activeCount={activeCount} />;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
      <div className="flex items-center gap-1 text-muted-foreground flex-shrink-0 mr-1">
        <SlidersHorizontal size={13} />
        {activeCount > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">{activeCount}</span>}
      </div>
      <SourceFilter value={filters.source} onChange={(v) => onChange({ source: v })} />
      <FilterDropdown label="Type" value={filters.imageType} options={TYPE_OPTIONS} onChange={(v) => onChange({ imageType: v })} />
      <FilterDropdown label="Size" value={filters.imageSize} options={SIZE_OPTIONS} onChange={(v) => onChange({ imageSize: v })} />
      <FilterDropdown label="Color" value={filters.imageColor} options={COLOR_OPTIONS} onChange={(v) => onChange({ imageColor: v })} />
      <button onClick={() => onChange({ safeSearch: filters.safeSearch === "active" ? "off" : "active" })}
        className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-medium border transition-all duration-200 flex-shrink-0 whitespace-nowrap ${filters.safeSearch === "off" ? "border-destructive/60 text-destructive bg-destructive/10" : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"}`}>
        {filters.safeSearch === "active" ? <Shield size={12} /> : <ShieldOff size={12} />}
        <span>Safe {filters.safeSearch === "active" ? "On" : "Off"}</span>
      </button>
      {activeCount > 0 && (
        <button onClick={() => onChange(DEFAULT_FILTERS)} className="flex items-center gap-1 px-2 h-9 rounded-xl text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
          <X size={11} />Reset
        </button>
      )}
    </div>
  );
}

// ─── Image card ───────────────────────────────────────────────────────────────

function ImageCard({ image, seen, onClick }: { image: ImageResult; seen: boolean; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const isMobile = useIsMobile();

  if (imgError) return null; // Don't show broken images

  // Calculate aspect ratio if dimensions available
  const aspectRatio = image.width && image.height ? image.width / image.height : null;

  return (
    <div
      className={`masonry-item group cursor-pointer relative overflow-hidden rounded-xl active:scale-[0.97] transition-transform bg-card ${seen ? "opacity-40" : ""} ${isMobile ? "rounded-lg" : "rounded-xl"}`}
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
    toast.success("Image downloaded");
  } catch (err) {
    toast.error("Could not download this image");
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
    fetch(`/api/download?url=${encodeURIComponent(url)}`)
      .then(async (res) => {
        const cl = res.headers.get("content-length");
        const sizeKB = cl ? Math.round(parseInt(cl) / 1024) : null;
        await res.blob(); // drain
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
    toast.success("Link copied to clipboard");
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
          toast.success("Removed from favorites");
        },
        onError: (err) => {
          toast.error(`Could not remove: ${err.message}`);
        }
      });
    } else {
      // Pick only needed fields to avoid zod validation errors with extra props
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
          toast.success("Added to favorites");
        },
        onError: (err) => {
          console.error("Fav add error:", err);
          toast.error(`Could not save: ${err.message}`);
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
              title={isFav ? "Remove from favorites" : "Add to favorites"}>
              <Heart size={15} fill={isFav ? "currentColor" : "none"} />
              {!isMobile && (isFav ? "Saved" : "Save")}
            </Button>
            <Button onClick={handleDownload} disabled={downloading} size={isMobile ? "default" : "sm"}
              className={`rounded-xl gap-2 font-medium ${isMobile ? "h-11 px-5 text-sm flex-1" : "h-9 px-4 text-sm"}`}
              style={{ background: "linear-gradient(135deg, oklch(0.72 0.15 50), oklch(0.58 0.18 38))", color: "oklch(0.1 0.005 260)" }}>
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {downloading ? "Downloading…" : "Download"}
            </Button>
            <Button onClick={handleCopyLink} variant="outline" size={isMobile ? "default" : "sm"}
              className={`rounded-xl gap-2 border-border ${isMobile ? "h-11 w-11 p-0" : "h-9 px-3"}`}
              title="Copy image link">
              <Copy size={15} />
              {!isMobile && "Copy link"}
            </Button>
          </div>
          {image.sourceUrl && (
            <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-medium text-sm">
              View source <ExternalLink size={14} />
            </a>
          )}
        </div>
        {previewUrl && (
          <a href={previewUrl} target="_blank" rel="noopener noreferrer"
             className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 self-start">
            <Maximize2 size={10} /> Open original image in new tab
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
                <button className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-accent flex-shrink-0"><X size={18} /></button>
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
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground flex-shrink-0 p-1 rounded-lg hover:bg-accent"><X size={18} /></button>
        </div>
        {previewContent}
      </div>
    </div>
  );
}

// ─── Reverse image search ─────────────────────────────────────────────────────

function ReverseImageSearch({ onResults }: { onResults: (results: any[], source: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const lensMutation = trpc.search.lens.useMutation();

  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image too large (max 10MB)");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      const images = (data.visual_matches ?? []).map((img: any) => ({
        title: img.title ?? "",
        thumbnailUrl: img.thumbnail ?? "",
        sourceUrl: img.link ?? "",
        sourceDomain: img.source ?? "",
        originalUrl: img.thumbnail ?? "",
      }));

      onResults(images, "google_lens");
      toast.success("Image analyzed successfully");
    } catch (err) {
      toast.error("Lens search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      <button onClick={() => fileRef.current?.click()} disabled={loading} title="Search by image"
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) handleFile(f); }}
        onDragOver={(e) => e.preventDefault()}
        className="flex items-center justify-center h-14 w-12 rounded-2xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all flex-shrink-0 disabled:opacity-50">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
      </button>
    </>
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

function Hero({ onSearch, filters, onFiltersChange, onLensResults }: {
  onSearch: (q: string) => void;
  filters: Filters;
  onFiltersChange: (f: Partial<Filters>) => void;
  onLensResults: (results: any[], source: string) => void;
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
        <p className="text-muted-foreground text-sm sm:text-base max-w-xs mx-auto leading-relaxed">Search the entire internet for images — beautifully.</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSearch(value.trim()); }} className="w-full max-w-xl mt-3">
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1 flex items-center">
            <Search size={17} className="absolute left-4 text-muted-foreground pointer-events-none z-10" />
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Search for any image or paste URL…"
              className="pl-11 pr-28 h-14 text-base rounded-2xl border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50" autoFocus />
            <Button type="submit" disabled={!value.trim()} className="absolute right-2 h-10 px-5 rounded-xl font-medium text-sm"
              style={{ background: "linear-gradient(135deg, oklch(0.72 0.15 50), oklch(0.58 0.18 38))", color: "oklch(0.1 0.005 260)" }}>
              Search
            </Button>
          </div>
          <ReverseImageSearch onResults={onLensResults} />
        </div>
      </form>
      <div className="mt-4 w-full max-w-xl"><FilterBar filters={filters} onChange={onFiltersChange} /></div>
      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        {["Architecture", "Nature", "Abstract art", "Space", "Portraits"].map((s) => (
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
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Search images…"
          className="pl-8 pr-20 h-10 rounded-xl border-border bg-card text-foreground placeholder:text-muted-foreground text-sm" />
        <Button type="submit" disabled={!value.trim()} size="sm" className="absolute right-1.5 h-7 px-3 rounded-lg text-xs font-medium"
          style={{ background: "linear-gradient(135deg, oklch(0.72 0.15 50), oklch(0.58 0.18 38))", color: "oklch(0.1 0.005 260)" }}>
          Search
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
  const [dark, setDark] = useDarkMode();
  const [view, setView] = useState<"search" | "favs">("search");
  const [activeQuery, setActiveQuery] = useState("");
  const [pages, setPages] = useState<number[]>([]); // list of start offsets fetched
  const [allResults, setAllResults] = useState<ImageResult[]>([]);
  const [modalImage, setModalImage] = useState<ImageResult | null>(null);
  const [source, setSource] = useState<"serpapi" | "bing" | "yandex" | "google_lens" | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [committedFilters, setCommittedFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filterSeen, setFilterSeen] = useState(false);
  const [seenUrls, setSeenUrls] = useState<Set<string>>(new Set());
  const [currentStart, setCurrentStart] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const markSeenMutation = trpc.seen.mark.useMutation();
  const clearSeenMutation = trpc.seen.clear.useMutation();
  const { data: favs } = trpc.favs.list.useQuery();

  const isQueryUrl = /^https?:\/\/.+/i.test(activeQuery);
  const { data, isLoading, isFetching, error, refetch } = trpc.search.images.useQuery(
    { query: activeQuery, start: currentStart, imageType: committedFilters.imageType, imageSize: committedFilters.imageSize, imageColor: committedFilters.imageColor, safeSearch: committedFilters.safeSearch, source: committedFilters.source, filterSeen },
    { enabled: !!activeQuery && !isQueryUrl, retry: false, refetchOnWindowFocus: false, staleTime: 0 }
  );

  // Accumulate results as pages load
  useEffect(() => {
    if (!data) return;
    if (currentStart === 0) {
      setAllResults(data.results);
    } else {
      setAllResults((prev) => {
        // Deduplicate by thumbnailUrl AND originalUrl to be safe
        const existing = new Set(prev.map((r) => r.thumbnailUrl));
        const newOnes = data.results.filter((r) => !existing.has(r.thumbnailUrl));

        // Also ensure we don't have completely empty batches
        if (newOnes.length === 0 && data.hasMore && !isFetching) {
          // This shouldn't happen much with the server-side fix, but just in case
        }

        return [...prev, ...newOnes];
      });
    }
    setSource(data.source);
    setHasMore(data.hasMore);
    setLoadingMore(false);
  }, [data, currentStart]);

  const lensMutation = trpc.search.lens.useMutation();

  const handleLensResults = useCallback((results: any[], source: string) => {
    setActiveQuery("Image Search Result");
    setAllResults(results);
    setSource(source as any);
    setHasMore(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleSearch = useCallback(async (q: string) => {
    const isUrl = /^https?:\/\/.+/i.test(q);
    setView("search");

    if (isUrl) {
      setLoadingMore(true);
      setActiveQuery(q);
      setAllResults([]);
      setSource(null);
      try {
        const res = await lensMutation.mutateAsync({ imageUrl: q });
        setAllResults(res.results);
        setSource(res.source);
        setHasMore(false);
      } catch (err) {
        toast.error("Google Lens search failed");
      } finally {
        setLoadingMore(false);
      }
      return;
    }

    setActiveQuery(q);
    setCurrentStart(0);
    setAllResults([]);
    setHasMore(false);
    setSource(null);
    setCommittedFilters(filters);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [filters, lensMutation]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || isFetching || !hasMore || view === "favs") return;
    setLoadingMore(true);
    // Use the nextStart from the last result if available, otherwise just increment
    setCurrentStart((prev) => {
      if (data && 'nextStart' in data && typeof data.nextStart === 'number') {
        return data.nextStart;
      }
      return prev + PAGE_SIZE;
    });
  }, [loadingMore, isFetching, hasMore, data]);

  const sentinelRef = useInfiniteScroll(handleLoadMore, hasMore && !loadingMore && !isFetching);

  const handleImageClick = (image: ImageResult) => {
    setModalImage(image);
    // Mark as seen locally and on server
    const urls = [image.thumbnailUrl, image.originalUrl].filter(Boolean) as string[];
    setSeenUrls((prev) => new Set([...prev, ...urls]));
    setAllResults((prev) => prev.map(r =>
      (r.thumbnailUrl === image.thumbnailUrl || (r.originalUrl && r.originalUrl === image.originalUrl))
      ? { ...r, isSeen: true }
      : r
    ));
    markSeenMutation.mutate({ urls });
  };

  const handleClearSeen = () => {
    clearSeenMutation.mutate(undefined, {
      onSuccess: () => {
        setSeenUrls(new Set());
        toast.success("Seen history cleared");
      }
    });
  };

  const hasResults = allResults.length > 0;
  const isLoadingFirst = isLoading && currentStart === 0;

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
            {source && (
              <span className="text-[10px] px-2 py-1 rounded-full border whitespace-nowrap hidden xs:block"
                style={{
                  borderColor: source === "serpapi" ? "oklch(0.72 0.15 50 / 0.4)" : source === "yandex" ? "oklch(0.75 0.18 140 / 0.4)" : source === "google_lens" ? "oklch(0.8 0.15 100 / 0.4)" : "oklch(0.65 0.18 200 / 0.4)",
                  color: source === "serpapi" ? "oklch(0.72 0.15 50)" : source === "yandex" ? "oklch(0.75 0.18 140)" : source === "google_lens" ? "oklch(0.8 0.15 100)" : "oklch(0.65 0.18 200)",
                  background: source === "serpapi" ? "oklch(0.72 0.15 50 / 0.08)" : source === "yandex" ? "oklch(0.75 0.18 140 / 0.08)" : source === "google_lens" ? "oklch(0.8 0.15 100 / 0.08)" : "oklch(0.65 0.18 200 / 0.08)",
                }}>
                {source === "serpapi" ? "Google" : source === "yandex" ? "Yandex" : source === "google_lens" ? "Google Lens" : "Bing"}
              </span>
            )}

            {/* Filter seen toggle */}
            {hasResults && (
              <button onClick={() => setFilterSeen((v) => !v)} title={filterSeen ? "Show all images" : "Hide seen images"}
                className={`p-2 rounded-xl transition-all ${filterSeen ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
                {filterSeen ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}

            {/* Favorites */}
            <button onClick={() => setView(v => v === "search" ? "favs" : "search")} title="My Favorites"
              className={`p-2 rounded-xl transition-all ${view === "favs" ? "text-red-500 bg-red-500/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
              <Heart size={16} fill={view === "favs" ? "currentColor" : "none"} />
            </button>

            {/* Clear seen */}
            {seenUrls.size > 0 && view === "search" && (
              <button onClick={handleClearSeen} title="Clear seen history"
                className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                <Trash2 size={16} />
              </button>
            )}

            {/* Dark mode */}
            <button onClick={() => setDark((d) => !d)} title={dark ? "Light mode" : "Dark mode"}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all">
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        {/* Filter bar */}
        {activeQuery && (
          <div className="border-t border-border">
            <div className="container py-2">
              <FilterBar filters={filters} onChange={(p) => setFilters((prev) => ({ ...prev, ...p }))} />
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
                <h1 className="text-3xl font-semibold gradient-text">My Favorites</h1>
                <p className="text-muted-foreground text-sm mt-1">Your curated collection of beautiful images.</p>
              </div>
              <Button onClick={() => setView("search")} variant="outline" className="rounded-xl border-border">Back to search</Button>
            </div>
            {!favs?.length ? (
              <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4"><Heart size={32} className="text-muted-foreground" /></div>
                <h3 className="text-foreground font-medium">No favorites yet</h3>
                <p className="text-muted-foreground text-sm max-w-xs">Heart some images during your search to see them here.</p>
              </div>
            ) : (
              <div className="masonry-grid">
                {favs.map((img, i) => (
                  <ImageCard key={img.thumbnailUrl + i} image={img} seen={false} onClick={() => handleImageClick(img)} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {!activeQuery && <Hero onSearch={handleSearch} filters={filters} onFiltersChange={(p) => setFilters((prev) => ({ ...prev, ...p }))} onLensResults={handleLensResults} />}

        {isLoadingFirst && (
          <div>
            <div className="flex items-center gap-2 mb-5">
              <Loader2 className="animate-spin text-primary" size={15} />
              <span className="text-muted-foreground text-sm">Searching for <span className="text-foreground font-medium">&ldquo;{activeQuery}&rdquo;</span>&hellip;</span>
            </div>
            <SkeletonGrid />
          </div>
        )}

        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-destructive/15"><AlertCircle size={24} className="text-destructive" /></div>
            <h3 className="text-foreground font-medium mb-2">Search failed</h3>
            <p className="text-muted-foreground text-sm max-w-xs mb-6">{error.message || "An unexpected error occurred."}</p>
            <Button onClick={() => refetch()} variant="outline" size="sm" className="border-border text-foreground hover:bg-accent">Try again</Button>
          </div>
        )}

        {!isLoading && !error && activeQuery && !hasResults && data && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-muted"><ImageOff size={24} className="text-muted-foreground" /></div>
            <h3 className="text-foreground font-medium mb-2">No images found</h3>
            <p className="text-muted-foreground text-sm max-w-xs">Try a different search term or adjust your filters.</p>
          </div>
        )}

        {hasResults && (
          <div>
            <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2 flex-wrap">
              <p className="text-muted-foreground text-xs sm:text-sm">
                <span className="text-foreground font-medium">&ldquo;{activeQuery}&rdquo;</span>
                <span className="ml-2 text-xs">&middot; {allResults.length} images</span>
                {seenUrls.size > 0 && <span className="ml-2 text-xs">&middot; {seenUrls.size} seen</span>}
              </p>
              {filterSeen && (
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Hiding seen images
                </span>
              )}
            </div>

            <div className="masonry-grid">
              {allResults.map((img, i) => (
                <ImageCard
                  key={img.thumbnailUrl + i}
                  image={img}
                  seen={img.isSeen || seenUrls.has(img.thumbnailUrl) || (img.originalUrl ? seenUrls.has(img.originalUrl) : false)}
                  onClick={() => handleImageClick(img)}
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

      {modalImage && <ImagePreview image={modalImage} onClose={() => setModalImage(null)} />}
    </div>
  );
}
