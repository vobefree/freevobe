/**
 * All redaktionell text och alla länkar på ett ställe. Ändrar du produktnamn, nedladdnings-URL
 * eller navigering så räcker det här – komponenterna läser därifrån.
 */
import { DOWNLOAD_LINKS, RELEASE_REPO_URL } from '@/config/release';

/**
 * Den publika adressen. Sätts vid bygget (t.ex. för en förhandsgranskning), annars används
 * produktionsdomänen. Alla absoluta länkar – canonical, og:image, sitemap – följer den här.
 */
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://freevobe.dev').replace(/\/$/, '');

export const site = {
  name: 'Freevobe',
  tagline: 'Vobe with Ollama.',
  description:
    'Freevobe is your local vibecoding agent. Install it, connect Ollama and build software through natural-language chat — no API keys, no token counting, no cloud dependency.',
  shortDescription:
    'Local-first AI coding agent for Ollama. No tokens, no limits, no cloud dependency.',
  url: siteUrl,
  // Repo, releases och nedladdningslänkar kommer från src/config/release.ts – aldrig härifrån.
  github: RELEASE_REPO_URL,
  download: DOWNLOAD_LINKS.latest,
  discord: 'https://discord.gg/freevobe',
  x: 'https://x.com/freevobe',
  docs: `${siteUrl}/docs`,
  version: '1.0.0',
  platforms: ['Windows', 'macOS', 'Linux'],
  license: 'MIT',
} as const;

export const nav = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#skills', label: 'Skills' },
  { href: '#faq', label: 'FAQ' },
  { href: site.github, label: 'GitHub', external: true },
] as const;

export const communityBadges = [
  'Local-first',
  'Ollama-powered',
  'No API key required',
  'Open skills',
  'Private by default',
] as const;

export const problems = [
  {
    problem: 'Usage limits',
    solution: 'Run locally with Ollama.',
    detail:
      'Your GPU does the work. No rate limits, no weekly caps and no waiting for a reset at midnight.',
  },
  {
    problem: 'API costs',
    solution: 'No per-token billing.',
    detail:
      'One local model, unlimited prompts. The only cost is the electricity you already pay for.',
  },
  {
    problem: 'Cloud privacy concerns',
    solution: 'Your code stays on your machine.',
    detail:
      'Files, prompts and diffs never leave your computer unless you explicitly connect a cloud model.',
  },
] as const;

export const features = [
  {
    icon: 'plug',
    title: 'Local Ollama connection',
    body: 'Connect to your local models in one click.',
  },
  {
    icon: 'layout',
    title: 'Claude-like workspace',
    body: 'Chat, plan, edit, diff and run — in one clean workspace.',
  },
  {
    icon: 'shield',
    title: 'Safe agent actions',
    body: 'Review diffs and approve commands before anything changes.',
  },
  {
    icon: 'sparkles',
    title: 'Skills & templates',
    body: 'Use Markdown skills to teach Freevobe your workflow.',
  },
  {
    icon: 'git',
    title: 'Git & terminal',
    body: 'Create branches, commit changes and run tests without leaving the app.',
  },
  {
    icon: 'blocks',
    title: 'MCP integrations',
    body: 'Connect external tools through the Model Context Protocol.',
  },
] as const;

export const flow = [
  { step: 'Install', detail: 'Native app for your OS' },
  { step: 'Connect Ollama', detail: 'One click to localhost:11434' },
  { step: 'Choose model', detail: 'Any model you have pulled' },
  { step: 'Prompt', detail: 'Describe what to build' },
  { step: 'Review diff', detail: 'Approve every change' },
  { step: 'Ship', detail: 'Commit and run tests' },
] as const;

export const skills = [
  {
    name: 'React Component',
    description: 'Scaffolds a typed component with tests and stories.',
    body: 'export function {{name}}(props: {{name}}Props) {}',
  },
  {
    name: 'Next.js Page',
    description: 'App Router page with metadata and loading state.',
    body: 'export default async function Page() {}',
  },
  {
    name: 'API Endpoint',
    description: 'Route handler with validation and typed responses.',
    body: 'export async function POST(request: Request) {}',
  },
  {
    name: 'Bug Fix',
    description: 'Reproduce, isolate, fix — and prove it with a test.',
    body: 'failing test → smallest fix → green suite',
  },
  {
    name: 'Write Tests',
    description: 'Table-driven tests around the code you just changed.',
    body: 'describe("{{module}}", () => { it(...) })',
  },
  {
    name: 'Code Review',
    description: 'Reviews a diff for bugs, edge cases and dead code.',
    body: 'read diff → list findings → suggest patch',
  },
] as const;

export const faqs = [
  {
    question: 'What does “vobe” mean?',
    answer:
      'To vobe is to build with Ollama through natural language — locally and without token limits. It is vibe coding, minus the meter running.',
  },
  {
    question: 'Do I need an API key?',
    answer: 'No. Freevobe connects directly to your local Ollama installation.',
  },
  {
    question: 'Which models can I use?',
    answer:
      'Any model available in your local Ollama installation — Qwen, Llama, DeepSeek, Mistral, Gemma and whatever you pull next.',
  },
  {
    question: 'Does my code leave my computer?',
    answer:
      'Not by default. Freevobe is local-first: the agent, the model and your files run on your machine. A cloud model is only used if you connect one yourself.',
  },
  {
    question: 'Is Freevobe free?',
    answer: 'The core app is free to use with your own local Ollama models.',
  },
  {
    question: 'Which platforms are supported?',
    answer: 'Windows, macOS and Linux.',
  },
] as const;
