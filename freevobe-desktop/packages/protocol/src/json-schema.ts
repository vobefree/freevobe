/**
 * Minimal JSON Schema-representation. Vi ritar bara det vi själva skickar till modellen och
 * validerar själva, så vi slipper ett runtime-beroende på ajv.
 */
export interface JsonSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: Array<string | number | boolean>;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  additionalProperties?: boolean | JsonSchema;
}

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Validerar ett värde mot ett (medvetet litet) JSON Schema. Okända nyckelord ignoreras.
 * Returnerar alla problem i stället för att kasta, så agenten kan skicka tillbaka felet
 * till modellen och låta den rätta sig själv.
 */
export function validateAgainstSchema(
  value: unknown,
  schema: JsonSchema,
  path = '$',
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (schema.type) {
    const actual = typeOf(value);
    const expected = schema.type;
    const matches =
      expected === actual ||
      (expected === 'integer' && actual === 'number' && Number.isInteger(value)) ||
      (expected === 'number' && actual === 'number');
    if (!matches) {
      issues.push({ path, message: `förväntade ${expected}, fick ${actual}` });
      return issues;
    }
  }

  if (schema.enum && !schema.enum.some((candidate) => candidate === value)) {
    issues.push({ path, message: `måste vara en av ${schema.enum.map(String).join(', ')}` });
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      issues.push({ path, message: `måste vara >= ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      issues.push({ path, message: `måste vara <= ${schema.maximum}` });
    }
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      issues.push({ path, message: `måste vara minst ${schema.minLength} tecken` });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      issues.push({ path, message: `får vara högst ${schema.maxLength} tecken` });
    }
  }

  if (
    schema.type === 'object' &&
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in record) || record[key] === undefined) {
        issues.push({ path: `${path}.${key}`, message: 'saknas (obligatorisk)' });
      }
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (key in record && record[key] !== undefined) {
        issues.push(...validateAgainstSchema(record[key], child, `${path}.${key}`));
      }
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(record)) {
        if (!allowed.has(key)) issues.push({ path: `${path}.${key}`, message: 'okänd egenskap' });
      }
    }
  }

  if (schema.type === 'array' && Array.isArray(value) && schema.items) {
    value.forEach((item, index) => {
      issues.push(...validateAgainstSchema(item, schema.items as JsonSchema, `${path}[${index}]`));
    });
  }

  return issues;
}

export function validate(value: unknown, schema: JsonSchema): ValidationResult {
  const issues = validateAgainstSchema(value, schema);
  return { ok: issues.length === 0, issues };
}
