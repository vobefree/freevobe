import { describe, expect, it } from 'vitest';
import {
  buildHardwareProfile,
  describeHardware,
  estimateModelBytes,
  fitsHardware,
  parseParameterBillions,
} from './hardware.js';

const GB = 1024 ** 3;

describe('hårdvaruprofil', () => {
  it('läser parametertal i B och M', () => {
    expect(parseParameterBillions('7.6B')).toBe(7.6);
    expect(parseParameterBillions('14b')).toBe(14);
    expect(parseParameterBillions('500M')).toBe(0.5);
    expect(parseParameterBillions('okänd')).toBeNull();
    expect(parseParameterBillions(null)).toBeNull();
  });

  it('räknar modellens minnesbehov med marginal', () => {
    expect(estimateModelBytes({ sizeBytes: 1_000_000_000 })).toBe(1_200_000_000);
    const byParams = estimateModelBytes({ parameterSize: '7b' });
    expect(byParams).not.toBeNull();
    expect(byParams! / GB).toBeCloseTo(4.34, 1);
    expect(estimateModelBytes({})).toBeNull();
  });

  it('bygger profil av kända siffror och lämnar okänt som okänt', () => {
    const profile = buildHardwareProfile({ totalmem: 16 * GB, freemem: 8 * GB });
    expect(profile.totalRamGb).toBe(16);
    expect(profile.freeRamGb).toBe(8);
    expect(profile.vramGb).toBeNull();
    expect(profile.source).toBe('system');

    const unknown = buildHardwareProfile();
    expect(unknown.source).toBe('unknown');
    expect(describeHardware(unknown)).toBe('okänd hårdvara');
  });

  it('avgör om en modell får plats', () => {
    const unknown = buildHardwareProfile();
    expect(fitsHardware(unknown, 100 * GB)).toBe(true);

    const gpu = buildHardwareProfile({ totalmem: 32 * GB, freemem: 24 * GB, vramBytes: 8 * GB });
    expect(fitsHardware(gpu, 6 * GB)).toBe(true);
    expect(fitsHardware(gpu, 12 * GB)).toBe(false);

    const cpuOnly = buildHardwareProfile({ totalmem: 16 * GB, freemem: 4 * GB });
    expect(fitsHardware(cpuOnly, 6 * GB)).toBe(false);
    expect(fitsHardware(cpuOnly, 2 * GB)).toBe(true);
  });
});
