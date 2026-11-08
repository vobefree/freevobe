/** Varifrån en modell kommer: Ollamas officiella bibliotek eller en tredjepartsnamespace. */
export type ModelSourceKind = 'official' | 'third-party';

/** Härkomst som visas som märkning vid varje modell. */
export interface ModelProvenance {
  /** Modellnamnet som användaren skrev, t.ex. `qwen2.5-coder:7b`. */
  name: string;
  /** Sökvägen i registret, t.ex. `registry.ollama.ai/library/qwen2.5-coder`. */
  registry: string;
  source: ModelSourceKind;
  /** Varningskoder (`third_party`, `missing_checksum`) som gränssnittet översätter. */
  warnings: string[];
}

/**
 * Det som måste visas innan en hämtning får starta. Ingen hämtning sker utan att användaren
 * sett namn, storlek, källa och checksumma och sagt ja.
 */
export interface ModelPullPreview extends ModelProvenance {
  sizeBytes: number | null;
  /** SHA256 från registret, med eller utan `sha256:`-prefix. */
  checksum: string | null;
  requiresApproval: true;
}
