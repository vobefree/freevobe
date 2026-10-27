"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale, ThemeConfig } from "@/lib/theme/types";
import { getAgencyStrings } from "@/lib/i18n/agency";
import { Icon } from "@/components/Icon";
import StorefrontPreview from "@/components/StorefrontPreview";

/**
 * Butiken ritas i desktoppbredd och skalas ned till granskningsrutan. En ren
 * CSS-transform räknar fortfarande höjden oskalat, så rutan får rätt höjd
 * mätt i webbläsaren – annars kan kunden skrolla förbi temat i tom yta.
 */
function ScaledPreview({ config }: { config: ThemeConfig }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;
    const update = () => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(wrap).transform);
      const scale = matrix.a || 1;
      setHeight(Math.round(inner.scrollHeight * scale));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [config]);

  return (
    <div className="agr-browser__scale" ref={wrapRef} style={height ? { height } : undefined}>
      <div ref={innerRef}>
        <StorefrontPreview config={config} />
      </div>
    </div>
  );
}

type Comment = { id: string; author: string; body: string; createdAt: string };

export function ClientReview({
  locale,
  token,
  projectName,
  clientName,
  displayName,
  brandColor,
  whiteLabel,
  config,
  initialStatus,
  initialComments,
}: {
  locale: Locale;
  token: string;
  projectName: string;
  clientName: string;
  displayName: string;
  brandColor: string;
  whiteLabel: boolean;
  config: ThemeConfig;
  initialStatus: string;
  initialComments: Comment[];
}) {
  const t = getAgencyStrings(locale);
  const [status, setStatus] = useState(initialStatus);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [author, setAuthor] = useState(clientName);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (action: "comment" | "approve" | "changes") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/review/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, author, body }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        review?: { status: string };
        comments?: Comment[];
      };
      if (!res.ok) {
        setError(json.error === "comment_required" ? (locale === "sv" ? "Skriv en kommentar först." : "Write a comment first.") : "Something went wrong.");
        return;
      }
      if (json.review) setStatus(json.review.status);
      if (json.comments) setComments(json.comments);
      if (action === "comment") setBody("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="agr">
      <header className="agr-top">
        <div className="wrap agr-top__inner">
          <span className="agr-brand">
            <span className="agr-brand__mark" style={{ background: brandColor }}>{whiteLabel ? displayName.slice(0, 2).toUpperCase() : "TF"}</span>
            <span><b>{displayName}</b><small>{whiteLabel ? t.clientPreview : "ThemeFold · Partner review"}</small></span>
          </span>
          <span className={`ag-chip ag-chip--${status === "approved" ? "approved" : status === "changes" ? "draft" : "review"}`}>
            {status === "approved" ? t.reviewApproved : status === "changes" ? t.reviewChanges : t.reviewPending}
          </span>
        </div>
      </header>

      <main className="wrap agr-main">
        <div className="agr-heading">
          <div>
            <p className="eyebrow-mkt">{clientName || t.clientLabel}</p>
            <h1>{projectName}</h1>
          </div>
          {status === "approved" ? (
            <a className="ui-btn ui-btn--ghost ui-btn--sm" href={`/api/review/${token}/download`}>
              <Icon name="download" size="xs" /> {t.download}
            </a>
          ) : (
            <span className="ag-chip ag-chip--draft"><Icon name="lock" size="xs" /> {t.download}</span>
          )}
        </div>

        <div className="agr-grid">
          <section className="agr-preview" aria-label={t.clientPreview}>
            <div className="agr-browser">
              <div className="agr-browser__bar">
                <span><i /><i /><i /></span>
                <span className="agr-browser__url">{config.shop.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.se</span>
                <span className="agr-browser__tag">PREVIEW</span>
              </div>
              <div className="agr-browser__view">
                <ScaledPreview config={config} />
              </div>
            </div>
          </section>

          <aside className="agr-panel">
            <div className="agr-panel__head">
              <b>{t.mockReview}</b>
              <span className="hint">{comments.length} {t.commentCount}</span>
            </div>

            <div className="agr-comments">
              {comments.length === 0 && <p className="hint">{locale === "sv" ? "Inga kommentarer ännu. Skriv den första." : "No comments yet. Start the thread."}</p>}
              {comments.map((comment) => (
                <div className="agr-comment" key={comment.id}>
                  <span className="ag-avatar">{comment.author.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <b>{comment.author}</b>
                    <p>{comment.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="agr-form">
              <input className="input" value={author} onChange={(event) => setAuthor(event.target.value)} placeholder={t.name} aria-label={t.name} />
              <textarea className="textarea" rows={3} value={body} onChange={(event) => setBody(event.target.value)} placeholder={locale === "sv" ? "Skriv en kommentar…" : "Write a comment…"} aria-label={t.mockReview} />
              {error && <p className="auth-error">{error}</p>}
              <button className="ui-btn ui-btn--ghost ui-btn--block" type="button" onClick={() => send("comment")} disabled={busy || body.trim().length < 2}>
                <Icon name="quote" size="xs" /> {locale === "sv" ? "Skicka kommentar" : "Post comment"}
              </button>
            </div>

            <div className="agr-actions">
              <button className="ui-btn ui-btn--ghost" type="button" onClick={() => send("changes")} disabled={busy}>{t.reviewChanges}</button>
              <button className="ui-btn ui-btn--accent" type="button" onClick={() => send("approve")} disabled={busy}>
                <Icon name="check" size="xs" /> {t.reviewApproved}
              </button>
            </div>

            {status === "approved" && (
              <div className="agr-done">
                <Icon name="checkCircle" size="md" />
                <b>{t.reviewApproved}</b>
                <p>{locale === "sv" ? "Temat är godkänt och redo att laddas ner eller installeras i butiken." : "The theme is approved and ready to download or install."}</p>
                <a className="ui-btn ui-btn--accent ui-btn--block" href={`/api/review/${token}/download`}>{t.download}</a>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
