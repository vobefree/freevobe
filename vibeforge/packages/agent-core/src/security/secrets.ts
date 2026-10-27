export interface SecretPattern {
  kind: string;
  /** Beskrivning som visas för användaren (aldrig själva hemligheten). */
  label: string;
  regex: RegExp;
}

export interface SecretFinding {
  kind: string;
  label: string;
  line: number;
  /** Maskerad träff, t.ex. `sk-abc…xyz`. Används för att kunna peka ut raden utan att läcka. */
  preview: string;
}

/** Mönster för vanliga API-nycklar, tokens och nyckelmaterial. */
export const SECRET_PATTERNS: SecretPattern[] = [
  { kind: 'openai', label: 'OpenAI-nyckel', regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { kind: 'anthropic', label: 'Anthropic-nyckel', regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  {
    kind: 'github',
    label: 'GitHub-token',
    regex: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  },
  { kind: 'aws', label: 'AWS-nyckel', regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { kind: 'google', label: 'Google API-nyckel', regex: /\bAIza[0-9A-Za-z_-]{30,}\b/g },
  { kind: 'slack', label: 'Slack-token', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  {
    kind: 'stripe',
    label: 'Stripe-nyckel',
    regex: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
  },
  {
    kind: 'jwt',
    label: 'JWT',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g,
  },
  {
    kind: 'pem',
    label: 'Privat nyckel (PEM)',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
  },
  {
    kind: 'env-assignment',
    label: 'Hemlighet i variabeltilldelning',
    // Ingen \b i början: nycklar skrivs ofta som OPENAI_API_KEY eller GH_TOKEN.
    regex:
      /(?:api[_-]?key|apikey|secret|token|password|passwd|private[_-]?key)\s*[:=]\s*["']([^"'\s]{12,})["']/gi,
  },
];

export function mask(value: string): string {
  if (value.length <= 10) return `${value.slice(0, 2)}…`;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

/**
 * Letar efter hemligheter rad för rad. Träffarna maskeras direkt, så att en loggpost
 * eller en commit-blockering aldrig skriver ut själva hemligheten.
 */
export function scanForSecrets(text: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  if (!text) return findings;
  const lines = text.split('\n');

  lines.forEach((line, index) => {
    for (const pattern of SECRET_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.regex.exec(line)) !== null) {
        const value = match[1] ?? match[0];
        findings.push({
          kind: pattern.kind,
          label: pattern.label,
          line: index + 1,
          preview: mask(value),
        });
        if (match.index === pattern.regex.lastIndex) pattern.regex.lastIndex += 1;
      }
    }
  });

  return findings;
}

export function containsSecret(text: string): boolean {
  return scanForSecrets(text).length > 0;
}

/** Ersätter hemligheter med en maskerad markör. Används innan text loggas eller skickas iväg. */
export function redactSecrets(text: string): string {
  let output = text;
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(
      new RegExp(pattern.regex.source, pattern.regex.flags),
      (match, group) =>
        typeof group === 'string' && group.length > 0
          ? match.replace(group, mask(group))
          : mask(match),
    );
  }
  return output;
}

export function describeFindings(findings: SecretFinding[], limit = 5): string {
  return findings
    .slice(0, limit)
    .map((finding) => `${finding.label} på rad ${finding.line} (${finding.preview})`)
    .join(', ');
}
