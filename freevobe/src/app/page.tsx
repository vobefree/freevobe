import { AdSlot } from '@/components/ads/ad-slot';
import { Faq } from '@/components/sections/faq';
import { Features } from '@/components/sections/features';
import { FinalCta } from '@/components/sections/final-cta';
import { Hero } from '@/components/sections/hero';
import { HowItWorks } from '@/components/sections/how-it-works';
import { Privacy } from '@/components/sections/privacy';
import { ProblemSolution } from '@/components/sections/problem-solution';
import { Skills } from '@/components/sections/skills';
import { SocialProof } from '@/components/sections/social-proof';

export default function Home() {
  return (
    <>
      <Hero />
      <SocialProof />
      <ProblemSolution />
      <Features />
      <HowItWorks />
      <Skills />

      {/*
        Annonsplatsen är förberedd men avstängd: den renderar ingenting förrän
        NEXT_PUBLIC_ADSENSE_CLIENT är satt. Ingen AdSense-kod ligger i sidan ännu.
      */}
      <AdSlot />

      <Privacy />
      <Faq />
      <FinalCta />
    </>
  );
}
