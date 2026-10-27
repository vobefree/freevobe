"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import type { SiteCopy } from "@/lib/i18n/site";
import type { Locale } from "@/lib/theme/types";

type Copy = SiteCopy["contact"];

export function ContactForm({ copy, locale }: { copy: Copy; locale: Locale }) {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "", website: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [problem, setProblem] = useState("");

  const update = (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setProblem(copy.required);
      setState("error");
      return;
    }
    setState("sending");
    setProblem("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, locale }),
      });
      if (!response.ok) throw new Error("failed");
      setState("sent");
      setForm({ name: "", email: "", subject: "", message: "", website: "" });
    } catch {
      setState("error");
      setProblem(copy.error);
    }
  };

  if (state === "sent") {
    return (
      <div className="contact-sent" role="status">
        <span className="contact-sent__icon"><Icon name="check" size="lg" strokeWidth={2.2} /></span>
        <h3>{copy.success}</h3>
        <button className="ui-btn ui-btn--ghost ui-btn--sm" type="button" onClick={() => setState("idle")}>
          {copy.send}
        </button>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={submit} noValidate>
      <div className="contact-form__row">
        <label>
          <span>{copy.name}</span>
          <input className="input" value={form.name} onChange={update("name")} autoComplete="name" required />
        </label>
        <label>
          <span>{copy.email}</span>
          <input className="input" type="email" value={form.email} onChange={update("email")} autoComplete="email" required />
        </label>
      </div>
      <label>
        <span>{copy.subject}</span>
        <input className="input" value={form.subject} onChange={update("subject")} />
      </label>
      <label>
        <span>{copy.message}</span>
        <textarea className="textarea" rows={6} value={form.message} onChange={update("message")} required />
      </label>
      <label className="contact-form__trap" aria-hidden="true">
        <span>Website</span>
        <input tabIndex={-1} autoComplete="off" value={form.website} onChange={update("website")} />
      </label>

      {state === "error" && problem && (
        <p className="contact-form__error" role="alert">
          <Icon name="warning" size="sm" /> {problem}
        </p>
      )}

      <button className="ui-btn ui-btn--accent ui-btn--lg" type="submit" disabled={state === "sending"}>
        {state === "sending" ? copy.sending : copy.send}
        <Icon name="arrowRight" size="sm" strokeWidth={2.2} />
      </button>
    </form>
  );
}
