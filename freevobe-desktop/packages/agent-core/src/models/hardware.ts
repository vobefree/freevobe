import type { HardwareProfile } from '@freevobe/protocol';

/**
 * Hårdvaruprofilen avgör om en modell får plats innan den rekommenderas. Den läser bara siffror
 * som redan finns på datorn – inget skickas någonstans och ingenting mäts i bakgrunden.
 */

const BYTES_PER_GB = 1024 ** 3;

/** Ungefär hur mycket minne en modell med N miljarder parametrar tar i 4-bitars kvantisering. */
const BYTES_PER_BILLION_PARAMS_Q4 = 0.62 * BYTES_PER_GB;

export interface HardwareInput {
  totalmem?: number;
  freemem?: number;
  vramBytes?: number | null;
  source?: HardwareProfile['source'];
}

export interface ModelSizeInput {
  /** Modellfilens storlek när den är känd. Väger tyngst: den är faktisk, inte uppskattad. */
  sizeBytes?: number | null;
  /** Parametertal som `7b` eller `14B`, när storleken saknas. */
  parameterSize?: string | null;
}

/** Läser parametertalet ur Ollamas `parameter_size`, t.ex. `7.6B` eller `14B`. */
export function parseParameterBillions(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /([\d.]+)\s*([bm])/i.exec(value);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return (match[2] ?? 'b').toLowerCase() === 'm' ? amount / 1000 : amount;
}

/**
 * Uppskattar hur mycket minne en modell behöver. En modellfil på 4,7 GB behöver cirka 5,6 GB
 * när kontexten och KV-cachen räknas in; det är den siffran som ska jämföras med datorn.
 */
export function estimateModelBytes(input: ModelSizeInput): number | null {
  if (input.sizeBytes && input.sizeBytes > 0) return Math.ceil(input.sizeBytes * 1.2);
  const billions = parseParameterBillions(input.parameterSize);
  if (billions === null) return null;
  return Math.ceil(billions * BYTES_PER_BILLION_PARAMS_Q4);
}

/** Bygger profilen från siffror som redan är kända. Saknad data blir `unknown`, aldrig en gissning. */
export function buildHardwareProfile(input: HardwareInput = {}): HardwareProfile {
  const total = input.totalmem && input.totalmem > 0 ? input.totalmem : null;
  const free = input.freemem && input.freemem > 0 ? input.freemem : null;
  if (total === null && free === null) {
    return { totalRamGb: 0, freeRamGb: 0, vramGb: null, source: 'unknown' };
  }
  const round = (bytes: number): number => Math.round((bytes / BYTES_PER_GB) * 10) / 10;
  return {
    totalRamGb: total === null ? 0 : round(total),
    freeRamGb: free === null ? 0 : round(free),
    vramGb:
      input.vramBytes && input.vramBytes > 0
        ? Math.round((input.vramBytes / BYTES_PER_GB) * 10) / 10
        : null,
    source: input.source ?? 'system',
  };
}

/**
 * Sant när modellen får plats. Med grafikminne räcker det att modellen får plats där; annars
 * krävs att den ryms i ledigt RAM med marginal för operativsystemet.
 */
export function fitsHardware(
  hardware: HardwareProfile,
  requiredBytes: number | null,
  options: { headroom?: number } = {},
): boolean {
  if (requiredBytes === null) return true;
  // Utan data om datorn går det inte att utesluta något. Att säga nej på en gissning vore värre
  // än att låta användaren försöka – hämtningen kräver ändå ett uttryckligt ja.
  if (hardware.source === 'unknown') return true;

  const gb = requiredBytes / BYTES_PER_GB;
  if (hardware.vramGb !== null && hardware.vramGb > 0) return gb <= hardware.vramGb * 0.95;

  // Modellen måste rymmas i ledigt RAM, annars börjar datorn växla till disk.
  const headroom = options.headroom ?? 0.9;
  const usable = hardware.freeRamGb > 0 ? hardware.freeRamGb : hardware.totalRamGb * 0.6;
  return gb <= usable * headroom;
}

/** Kort beskrivning för logg och diagnostik. */
export function describeHardware(hardware: HardwareProfile): string {
  if (hardware.source === 'unknown') return 'okänd hårdvara';
  const vram = hardware.vramGb === null ? 'okänt VRAM' : `${hardware.vramGb} GB VRAM`;
  return `${hardware.totalRamGb} GB RAM (${hardware.freeRamGb} GB ledigt), ${vram}`;
}
