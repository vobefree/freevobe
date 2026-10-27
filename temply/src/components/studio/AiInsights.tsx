"use client";

import { useCallback, useEffect, useState } from "react";
import type { Insights } from "@/lib/ai/insights";
import { getInsightsStrings } from "@/lib/i18n/insights";
import type { Locale } from "@/lib/theme/types";
import { Icon } from "@/components/Icon";

type Props = {
  projectId: string;
  locale: Locale;
  onFix?: (issueIds: string[]) => void;
  /** Health-issues som har en automatisk åtgärd – övriga visar ingen knapp. */
  fixableIds?: string[];
  autoRun?: boolean;
};

const IMPACT_LABEL = { high: "insightsImpactHigh", medium: "insightsImpactMedium", low: "insightsImpactLow" } as const;

export function AiInsights({ projectId, locale, onFix, fixableIds, autoRun }: Props) {
  const strings = getInsightsStrings(locale);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/ai/insights?projectId=${projectId}`)
      .then((res) => res.json())
      .then((json: { insights?: Insights | null }) => {
        if (active && json.insights) setInsights(json.insights);
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
      const res = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const json = (await res.json()) as { insights?: Insights; error?: string };
      if (!res.ok || !json.insights) throw new Error(json.error ?? "failed");
      setInsights(json.insights);
      if (json.insights.error) setError(json.insights.error);
    } catch {
      setError(strings.insightsError);
    } finally {
      setLoading(false);
    }
  }, [projectId, strings.insightsError]);

  useEffect(() => {
    if (autoRun) void run();
  }, [autoRun, run]);

  return (
    <div className="insight-card">
      <div className="insight-card__head">
        <span className="insight-card__title">
          <Icon name="sparkles" size="sm" /> {strings.insightsTitle}
        </span>
        {insights && (
          <span className={`insight-source${insights.source === "ai" ? " is-ai" : ""}`}>
            {insights.source === "ai" ? strings.insightsSourceAi : strings.insightsSourceRules}
          </span>
        )}
      </div>
      <p className="hint" style={{ marginTop: 0 }}>{strings.insightsSub}</p>

      {insights ? (
        <>
          <p className="insight-verdict">{insights.verdict}</p>
          <div className="insight-list">
            {insights.insights.map((insight, index) => (
              <div key={`${insight.title}-${index}`} className="insight-item">
                <div className="insight-item__top">
                  <b>{insight.title}</b>
                  <span className={`insight-impact is-${insight.impact}`}>{strings[IMPACT_LABEL[insight.impact]]}</span>
                </div>
                <p><span className="insight-label">{strings.insightsWhy}</span> {insight.why}</p>
                <p><span className="insight-label">{strings.insightsAction}</span> {insight.action}</p>
                {onFix && insight.issues.some((id) => fixableIds?.includes(id)) && (
                  <button
                    className="ui-btn ui-btn--ghost ui-btn--sm"
                    type="button"
                    onClick={() => onFix(insight.issues.filter((id) => fixableIds?.includes(id)))}
                  >
                    <Icon name="wand" size="xs" /> {strings.healthFix}
                  </button>
                )}
              </div>
            ))}
          </div>
          {insights.nextSteps.length > 0 && (
            <div className="insight-next">
              <span className="insight-label">{strings.insightsNext}</span>
              <ul>
                {insights.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="hint">{strings.insightsEmpty}</p>
      )}

      {error && <div className="banner banner--warn" style={{ marginTop: 8 }}>{error}</div>}

      <button className="ui-btn ui-btn--accent ui-btn--sm ui-btn--block" type="button" onClick={run} disabled={loading} style={{ marginTop: 8 }}>
        <Icon name="sparkles" size="xs" /> {loading ? strings.insightsRunning : insights ? strings.insightsAgain : strings.insightsRun}
      </button>
    </div>
  );
}
