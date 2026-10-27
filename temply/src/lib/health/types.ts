/** Typer för Theme Health – en analys av temat och butiken. */

export type HealthCategoryId =
  | "performance"
  | "seo"
  | "mobile"
  | "images"
  | "links"
  | "a11y"
  | "conversion"
  | "translations";

export type HealthSeverity = "critical" | "warning" | "info";

export type HealthIssue = {
  /** Stabilt id, t.ex. "seo.title-short". Används av auto-fix och AI:n. */
  id: string;
  category: HealthCategoryId;
  severity: HealthSeverity;
  title: string;
  detail: string;
  fix: string;
  /** Poängavdrag (0–100-skalan, före kategoriviktning). */
  weight: number;
  autoFix: boolean;
  metric?: string;
};

export type HealthMetric = { label: string; value: string; tone?: "good" | "warn" | "bad" };

export type HealthCategory = {
  id: HealthCategoryId;
  label: string;
  score: number;
  summary: string;
  metrics: HealthMetric[];
  issues: HealthIssue[];
};

export type PsiMetrics = {
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  pageWeightKb: number | null;
};

export type HealthReport = {
  score: number;
  grade: "A" | "B" | "C" | "D" | "E";
  checkedAt: string;
  categories: HealthCategory[];
  issues: HealthIssue[];
  counts: { critical: number; warning: number; info: number };
  source: {
    psi: boolean;
    crawl: boolean;
    shop: string | null;
    pagesCrawled: number;
    brokenLinks: { url: string; status: number }[];
  };
  psi: PsiMetrics | null;
  /** Kort maskinläsbar sammanfattning som AI:n får som indata. */
  digest: string;
};

export const CATEGORY_LABELS: Record<HealthCategoryId, string> = {
  performance: "Hastighet & prestanda",
  seo: "SEO",
  mobile: "Mobilanpassning",
  images: "Bilder",
  links: "Länkar",
  a11y: "Tillgänglighet",
  conversion: "Konvertering",
  translations: "Översättningar",
};

export const CATEGORY_WEIGHTS: Record<HealthCategoryId, number> = {
  performance: 18,
  seo: 16,
  mobile: 12,
  images: 12,
  links: 10,
  a11y: 12,
  conversion: 14,
  translations: 6,
};
