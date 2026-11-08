import { describe, expect, it } from 'vitest';
import { capabilityForOutputType, providersForOutputType } from '@freevobe/protocol';
import { classifyTask, isMediaOutputType } from './classifier.js';

describe('classifyTask', () => {
  it('känner igen bildbeställningar på svenska och engelska', () => {
    const sv = classifyTask('Skapa en bild av en räv i vattenfärg');
    expect(sv.outputType).toBe('image');
    expect(sv.confidence).toBeGreaterThan(0.8);
    expect(sv.matched).toEqual(['skapa', 'bild']);

    expect(classifyTask('Create a hero image for my landing page').outputType).toBe('image');
    expect(classifyTask('Generera en logotyp åt mitt företag').outputType).toBe('image');
  });

  it('känner igen video och ljud', () => {
    expect(classifyTask('Gör en 10 sekunders produktvideo').outputType).toBe('video');
    expect(classifyTask('Create a short trailer for the launch').outputType).toBe('video');
    expect(classifyTask('Komponera lugn pianomusik till videon').outputType).toBe('audio');
    expect(classifyTask('Generate a jingle for our podcast').outputType).toBe('audio');
  });

  it('väljer kod när prompten handlar om filer, funktioner eller kommandon', () => {
    expect(classifyTask("Skapa en fil hello.txt med innehållet 'Hello World'").outputType).toBe(
      'code',
    );
    expect(classifyTask('Fixa buggen i login.tsx').outputType).toBe('code');
    expect(classifyTask('Implementera en endpoint för fakturor').outputType).toBe('code');
  });

  it('låter kodsignalen vinna över ett medieord i samma mening', () => {
    // "hero-bild" finns, men uppgiften är att lägga in den i komponenten – ingen ny bild.
    expect(classifyTask('Lägg in hero-bilden i Hero-komponenten').outputType).toBe('code');
    // "bygg" är inget genereringsverb, så en sida med bild blir kod.
    expect(classifyTask('Bygg en landningssida med hero-bild').outputType).toBe('code');
  });

  it('faller tillbaka på text för vanliga frågor', () => {
    const result = classifyTask('Vad är skillnaden mellan let och const?');
    expect(result.outputType).toBe('text');
    expect(result.matched).toEqual([]);
  });

  it('kopplar output_type till rätt capability och providers', () => {
    expect(capabilityForOutputType('image')).toBe('image_gen');
    expect(capabilityForOutputType('code')).toBe('text');
    expect(providersForOutputType('image')).toEqual(['google', 'xai']);
    expect(providersForOutputType('audio')).toEqual(['google']);
    expect(isMediaOutputType('video')).toBe(true);
    expect(isMediaOutputType('code')).toBe(false);
  });
});
