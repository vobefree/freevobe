import type { CSSProperties } from "react";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpFromLine,
  BadgePercent,
  Blocks,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  CircleCheck,
  CircleDot,
  CircleHelp,
  Contrast,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileCode,
  Frame,
  Globe,
  GripVertical,
  HandHeart,
  History,
  ImagePlus,
  Images,
  Info,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  Leaf,
  LoaderCircle,
  Lock,
  Mail,
  Minus,
  Maximize2,
  Menu,
  MessageSquareQuote,
  Monitor,
  MousePointerClick,
  MoveVertical,
  Palette,
  PenLine,
  Plug,
  Plus,
  Quote,
  Redo2,
  Repeat,
  Rocket,
  RotateCcw,
  Ruler,
  Save,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Table,
  Tablet,
  Target,
  Trash2,
  TriangleAlert,
  Truck,
  Type,
  Undo2,
  Upload,
  Wand2,
  X,
  Zap,
  ZoomIn,
  type LucideIcon,
} from "lucide-react";

/**
 * Templys ikonsystem: Lucide som enda källa.
 *
 * Alla ikoner går genom den här komponenten så att stil, storlek och färg hålls
 * konsekventa och kommer från design tokens i stället för att hårdkodas på varje
 * ställe. Ikonerna är trädskakade SVG:er som buntas med appen – inget hämtas
 * externt och inget kräver inloggning.
 */
const ICONS = {
  /* Navigering */
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  arrowUp: ArrowUp,
  arrowDown: ArrowDown,
  menu: Menu,
  close: X,
  chevronUp: ChevronUp,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  external: ExternalLink,
  globe: Globe,
  mouse: MousePointerClick,

  /* Åtgärder */
  undo: Undo2,
  redo: Redo2,
  search: Search,
  cart: ShoppingBag,
  upload: Upload,
  download: Download,
  downloadZip: ArrowDownToLine,
  import: ArrowUpFromLine,
  copy: Copy,
  trash: Trash2,
  plus: Plus,
  minus: Minus,
  edit: PenLine,
  save: Save,
  check: Check,
  checkCircle: CircleCheck,
  lock: Lock,
  eye: Eye,
  eyeOff: EyeOff,
  drag: GripVertical,
  zoom: ZoomIn,

  /* Studio, inställningar och innehåll */
  sections: LayoutTemplate,
  layers: Layers,
  settings: Settings,
  sparkles: Sparkles,
  wand: Wand2,
  history: History,
  restore: RotateCcw,
  rocket: Rocket,
  chart: ChartColumn,
  mail: Mail,
  quote: MessageSquareQuote,
  blockquote: Quote,
  grid: LayoutGrid,
  type: Type,
  image: ImagePlus,
  images: Images,
  help: CircleHelp,
  repeat: Repeat,
  target: Target,
  zap: Zap,
  table: Table,
  percent: BadgePercent,
  ruler: Ruler,
  leaf: Leaf,
  blocks: Blocks,
  plug: Plug,
  contrast: Contrast,
  palette: Palette,
  store: Store,
  card: CreditCard,
  fileCode: FileCode,
  moveVertical: MoveVertical,
  frame: Frame,
  maximize: Maximize2,
  circle: Circle,
  circleDot: CircleDot,
  star: Star,
  truck: Truck,
  shield: ShieldCheck,
  heart: HandHeart,
  loader: LoaderCircle,
  info: Info,
  warning: TriangleAlert,

  /* Enheter */
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** Storlekssteg – samma steg används inom samma kontext i hela appen. */
export type IconSize = "xs" | "sm" | "md" | "lg" | "xl";
/** Färgtoner som pekar på design tokens i stället för hårdkodade värden. */
export type IconTone = "inherit" | "ink" | "muted" | "primary" | "accent" | "onDark" | "danger";

export function Icon({
  name,
  size = "md",
  tone = "inherit",
  label,
  className,
  strokeWidth,
  filled,
  style,
}: {
  name: IconName;
  size?: IconSize;
  tone?: IconTone;
  /** Sätts bara när ikonen bär betydelse; annars döljs den för skärmläsare. */
  label?: string;
  className?: string;
  strokeWidth?: number;
  /** Fylld variant, t.ex. betygstjärnor. */
  filled?: boolean;
  style?: CSSProperties;
}) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      className={`icon icon--${size}${tone === "inherit" ? "" : ` icon--${tone}`}${filled ? " icon--filled" : ""}${className ? ` ${className}` : ""}`}
      strokeWidth={strokeWidth ?? 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable="false"
      style={style}
    />
  );
}

export const ICON_NAMES = Object.keys(ICONS) as IconName[];
