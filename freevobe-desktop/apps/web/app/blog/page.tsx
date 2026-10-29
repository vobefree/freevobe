import type { Metadata } from 'next';
import Link from 'next/link';
import { GivesBackSlot } from '@/components/GivesBackSlot';
import { BLOG_POSTS } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Blogg',
  description: 'Artiklar om lokal-first AI-verktyg, agent-loppar, diff-granskning och skills.',
};

export default function BlogIndexPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold">Blogg</h1>
        <p className="max-w-2xl text-slate-400">
          Tankar om hur man bygger ett AI-verktyg som går att lita på: lokal exekvering,
          granskningsbara ändringar och tydliga gränser för vad agenten får göra.
        </p>
      </header>

      <div className="space-y-4">
        {BLOG_POSTS.map((post) => (
          <article key={post.slug} className="vf-card p-5">
            <p className="text-[11px] text-slate-600">{post.date}</p>
            <h2 className="mt-1 text-lg font-semibold">
              <Link href={`/blog/${post.slug}/`} className="hover:text-ember">
                {post.title}
              </Link>
            </h2>
            <p className="mt-1.5 text-[13.5px] text-slate-400">{post.summary}</p>
            <Link
              href={`/blog/${post.slug}/`}
              className="mt-2 inline-block text-sm text-ember hover:underline"
            >
              Läs inlägget →
            </Link>
          </article>
        ))}
      </div>

      <GivesBackSlot />
    </div>
  );
}
