import { describe, expect, it } from 'vitest';
import {
  buildPullPreview,
  classifyModelSource,
  digestsMatch,
  modelProvenance,
  modelRegistryPath,
  normalizeDigest,
} from './provenance.js';

describe('modellhärkomst', () => {
  it('räknar modeller utan namespace som officiella', () => {
    expect(classifyModelSource('qwen2.5-coder:7b')).toBe('official');
    expect(classifyModelSource('library/llama3.2')).toBe('official');
    expect(modelRegistryPath('qwen2.5-coder:7b')).toBe('registry.ollama.ai/library/qwen2.5-coder');
  });

  it('märker namespaces utanför library som tredjepart', () => {
    expect(classifyModelSource('någon/min-modell:latest')).toBe('third-party');
    expect(modelRegistryPath('någon/min-modell:q4')).toBe('registry.ollama.ai/någon/min-modell');
    expect(modelProvenance('någon/min-modell').warnings).toContain('third_party');
  });

  it('normaliserar checksummor innan jämförelse', () => {
    expect(normalizeDigest('SHA256:ABCdef')).toBe('abcdef');
    expect(normalizeDigest('   ')).toBeNull();
    expect(digestsMatch('sha256:abc', 'ABC')).toBe(true);
    expect(digestsMatch('abc', 'abd')).toBe(false);
    expect(digestsMatch(null, 'abc')).toBe(false);
  });

  it('kräver alltid godkännande och flaggar saknad checksumma', () => {
    const preview = buildPullPreview({ name: 'qwen2.5-coder:7b', sizeBytes: 4_700_000_000 });
    expect(preview.requiresApproval).toBe(true);
    expect(preview.source).toBe('official');
    expect(preview.sizeBytes).toBe(4_700_000_000);
    expect(preview.checksum).toBeNull();
    expect(preview.warnings).toContain('missing_checksum');
    expect(preview.warnings).not.toContain('third_party');
  });

  it('visar både tredjepart och checksumma när de finns', () => {
    const preview = buildPullPreview({
      name: 'någon/min-modell:q4',
      checksum: 'sha256:abc123',
      sizeBytes: 2_000_000_000,
    });
    expect(preview.warnings).toEqual(['third_party']);
    expect(preview.checksum).toBe('abc123');
  });
});
