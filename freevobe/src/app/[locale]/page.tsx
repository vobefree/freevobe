import { setRequestLocale } from 'next-intl/server';
import { Faq } from '@/components/sections/faq';
import { GivesBack } from '@/components/sections/gives-back';
import { Features } from '@/components/sections/features';
import { FinalCta } from '@/components/sections/final-cta';
import { Hero } from '@/components/sections/hero';
import { HowItWorks } from '@/components/sections/how-it-works';
import { Privacy } from '@/components/sections/privacy';
import { ProblemSolution } from '@/components/sections/problem-solution';
import { Skills } from '@/components/sections/skills';
import { SocialProof } from '@/components/sections/social-proof';

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <Hero />
      <SocialProof />
      <ProblemSolution />
      <Features />
      <HowItWorks />
      <Skills />

      {/* I stället för annonsplats: den frivilliga välgörenhetsdelen. */}
      <GivesBack />

      <Privacy />
      <Faq />
      <FinalCta />
    </>
  );
}
