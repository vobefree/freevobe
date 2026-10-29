import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BLOG_POSTS } from '@/lib/content';

// Sajten är statiskt exporterad: alla inlägg förrenderas vid bygget.
export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS.find((entry) => entry.slug === slug);
  if (!post) return { title: 'Inlägget saknas' };
  return { title: post.title, description: post.summary };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((entry) => entry.slug === slug);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-3xl space-y-5">
      <Link href="/blog/" className="text-sm text-slate-500 hover:text-slate-200">
        ← Alla inlägg
      </Link>
      <header className="space-y-2">
        <p className="text-xs text-slate-600">{post.date}</p>
        <h1 className="text-3xl font-semibold">{post.title}</h1>
        <p className="text-slate-400">{post.summary}</p>
      </header>
      <div className="space-y-4">
        {post.body.map((paragraph) => (
          <p key={paragraph} className="text-[14.5px] leading-relaxed text-slate-300">
            {paragraph}
          </p>
        ))}
      </div>
    </article>
  );
}
