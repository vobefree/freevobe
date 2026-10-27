"use client";

import { useCallback, useEffect, useState } from "react";
import type { HealthCategoryId, HealthReport } from "@/lib/health/types";
import { getInsightsStrings } from "@/lib/i18n/insights";
import type { Locale, ThemeConfig } from "@/lib/theme/types";
import { Icon } from "@/components/Icon";
import { AiInsights } from "./AiInsights";

type Props = {
  config: ThemeConfig;
  update: (recipe: (config: ThemeConfig) => ThemeConfig) => void;
  locale: Locale;
  projectId: string;
  shopConnected: boolean;
  onToast?: (message: string) => void;
};

const SEVERITY_TONE: Record<string, string> = { critical: "bad", warning: "warn", info: "muted" };

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const tone = score >= 80 ? "#2f6b3f" : score >= 60 ? "#b45309" : "#b42318";
  return (
    <div className="health-ring" aria-label={`Health score ${score} av 100`}>
      <svg viewBox="0 0 76 76" width="76" height="76" role="img" aria-hidden>
        <circle cx="38" cy="38" r={radius} fill="none" stroke="var(--line)" strokeWidth="7" />
        <circle
          cx="38"
          cy="38"
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 38 38)"
        />
      </svg>
      <div className="health-ring__value">
        <b>{score}</b>
        <span>{grade}</span>
      </div>
    </div>
  );
}

export function HealthPanel({ update, locale, projectId, shopConnected, onToast }: Props) {
  const strings = getInsightsStrings(locale);
  const [report, setReport] = useState<HealthReport | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [psi, setPsi] = useState(false);
  const [crawl, setCrawl] = useState(false);
  const [open, setOpen] = useState<HealthCategoryId | "ai" | null>("seo");

  useEffect(() => {
    let active = true;
    fetch(`/api/health/audit?projectId=${projectId}`)
      .then((res) => res.json())
      .then((json: { report?: HealthReport | null; savedAt?: string }) => {
        if (!active) return;
        if (json.report) {
          setReport(json.report);
          setSavedAt(json.savedAt ?? json.report.checkedAt);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [projectId]);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/health/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, psi: psi && shopConnected, crawl: crawl && shopConnected }),
      });
      const json = (await res.json()) as { report?: HealthReport; error?: string };
      if (!res.ok || !json.report) throw new Error(json.error ?? "failed");
      setReport(json.report);
      setSavedAt(json.report.checkedAt);
      if (psi && !json.report.psi) onToast?.(strings.healthSkipped);
      if (crawl && !json.report.source.crawl) onToast?.(strings.healthCrawlSkipped);
      onToast?.(`${strings.healthScore}: ${json.report.score}/100 · ${json.report.grade}`);
    } catch {
      setError(strings.healthNever);
    } finally {
      setLoading(false);
    }
  }, [projectId, psi, crawl, shopConnected, onToast, strings]);

  const fix = useCallback(
    async (issueIds: string[]) => {
      if (issueIds.length === 0) return;
      setFixing(true);
      setError(null);
      try {
        const res = await fetch("/api/health/fix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, issueIds }),
        });
        const json = (await res.json()) as { config?: ThemeConfig; report?: HealthReport; applied?: string[]; error?: string };
        if (!res.ok || !json.config || !json.report) {
          onToast?.(json.error === "nothing_to_fix" ? strings.healthNothingToFix : strings.healthNothingToFix);
          return;
        }
        update(() => json.config as ThemeConfig);
        setReport(json.report);
        setSavedAt(json.report.checkedAt);
        onToast?.(strings.healthFixed);
      } catch {
        onToast?.(strings.healthNothingToFix);
      } finally {
        setFixing(false);
      }
    },
    [projectId, update, onToast, strings],
  );

  const autoFixable = report?.issues.filter((issue) => issue.autoFix) ?? [];

  return (
    <div>
      <div className="panel-section">
        <div className="panel-title">
          <span>{strings.healthTitle}</span>
          {report && <span className="health-badge">{strings.healthChecked}: {new Date(savedAt ?? report.checkedAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}</span>}
        </div>
        <p className="hint" style={{ marginTop: 0 }}>{strings.healthSub}</p>

        {report ? (
          <div className="health-hero">
            <ScoreRing score={report.score} grade={report.grade} />
            <div className="health-hero__meta">
              <div className="health-counts">
                <span className="health-count is-bad">{report.counts.critical} {strings.healthCritical.toLowerCase()}</span>
                <span className="health-count is-warn">{report.counts.warning} {strings.healthWarnings.toLowerCase()}</span>
                <span className="health-count">{report.counts.info} {strings.healthInfo.toLowerCase()}</span>
              </div>
              <small>
                {report.source.shop ?? "–"} · {report.source.psi ? "PageSpeed" : "tema"} · {report.source.pagesCrawled} länkar
              </small>
            </div>
          </div>
        ) : (
          <p className="hint">{strings.healthNever}</p>
        )}

        <div className="health-options">
          <label className="health-check">
            <input type="checkbox" checked={psi} onChange={(event) => setPsi(event.target.checked)} disabled={!shopConnected} />
            <span>
              {strings.healthPsi}
              <small>{strings.healthPsiHint}</small>
            </span>
          </label>
          <label className="health-check">
            <input type="checkbox" checked={crawl} onChange={(event) => setCrawl(event.target.checked)} disabled={!shopConnected} />
            <span>
              {strings.healthCrawl}
              <small>{strings.healthCrawlHint}</small>
            </span>
          </label>
        </div>

        <div className="health-actions">
          <button className="ui-btn ui-btn--accent ui-btn--sm" type="button" onClick={run} disabled={loading || fixing}>
            <Icon name="zap" size="xs" /> {loading ? strings.healthRunning : strings.healthRun}
          </button>
          {autoFixable.length > 0 && (
            <button
              className="ui-btn ui-btn--ghost ui-btn--sm"
              type="button"
              onClick={() => fix(autoFixable.map((issue) => issue.id))}
              disabled={fixing || loading}
            >
              <Icon name="wand" size="xs" /> {fixing ? strings.healthFixing : `${strings.healthFixAll} (${autoFixable.length})`}
            </button>
          )}
        </div>
        {error && <div className="banner banner--warn" style={{ marginTop: 8 }}>{error}</div>}
      </div>

      {report && (
        <div className="panel-section">
          <div className="panel-title">{strings.healthIssues}</div>
          <div className="health-cats">
            {report.categories.map((category) => {
              const isOpen = open === category.id;
              const tone = category.score >= 80 ? "good" : category.score >= 60 ? "warn" : "bad";
              return (
                <div key={category.id} className={`health-cat${isOpen ? " is-open" : ""}`}>
                  <button type="button" className="health-cat__head" onClick={() => setOpen(isOpen ? null : category.id)}>
                    <span className="health-cat__name">{category.label}</span>
                    <span className="health-cat__bar">
                      <i className={`is-${tone}`} style={{ width: `${category.score}%` }} />
                    </span>
                    <b className={`health-cat__score is-${tone}`}>{category.score}</b>
                    <Icon name={isOpen ? "chevronUp" : "chevronDown"} size="xs" />
                  </button>
                  {isOpen && (
                    <div className="health-cat__body">
                      <p className="hint" style={{ margin: "0 0 8px" }}>{category.summary}</p>
                      <div className="health-metrics">
                        {category.metrics.map((metric) => (
                          <div key={metric.label} className="health-metric">
                            <span>{metric.label}</span>
                            <b className={metric.tone ? `is-${metric.tone}` : ""}>{metric.value}</b>
                          </div>
                        ))}
                      </div>
                      {category.issues.length === 0 && <p className="hint">{strings.healthNoIssues}</p>}
                      {category.issues.map((issue) => (
                        <div key={issue.id} className="health-issue">
                          <div className="health-issue__top">
                            <span className={`health-dot is-${SEVERITY_TONE[issue.severity]}`} />
                            <b>{issue.title}</b>
                            {issue.autoFix && <span className="health-auto">{strings.healthAuto}</span>}
                          </div>
                          <p>{issue.detail}</p>
                          <p className="health-issue__fix">{issue.fix}</p>
                          {issue.autoFix && (
                            <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={() => fix([issue.id])} disabled={fixing}>
                              <Icon name="wand" size="xs" /> {strings.healthFix}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="hint" style={{ marginTop: 10 }}>{strings.healthDisclaimer}</p>
        </div>
      )}

      <div className="panel-section">
        <AiInsights
          projectId={projectId}
          locale={locale}
          onFix={fix}
          fixableIds={report?.issues.filter((issue) => issue.autoFix).map((issue) => issue.id) ?? []}
        />
      </div>
    </div>
  );
}
