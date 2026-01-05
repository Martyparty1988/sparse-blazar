import { describe, it, expect } from 'vitest';
import {
  WORKER_COLORS,
  getWorkerColor,
  getRandomWorkerColor,
  getLighterColor,
  getInitials,
} from '../../../utils/workerColors';

describe('workerColors utils', () => {
  describe('WORKER_COLORS', () => {
    it('mělo by obsahovat pole barev', () => {
      expect(WORKER_COLORS).toBeDefined();
      expect(Array.isArray(WORKER_COLORS)).toBe(true);
      expect(WORKER_COLORS.length).toBeGreaterThan(0);
    });

    it('všechny barvy by měly být validní hex kódy', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
      WORKER_COLORS.forEach(color => {
        expect(color).toMatch(hexColorRegex);
      });
    });
  });

  describe('getWorkerColor', () => {
    it('mělo by vrátit předanou barvu, pokud existuje', () => {
      const customColor = '#ff0000';
      const result = getWorkerColor(1, customColor);
      expect(result).toBe(customColor);
    });

    it('mělo by vrátit barvu podle indexu v poli workers', () => {
      const workers = [{ id: 5 }, { id: 10 }, { id: 15 }];
      const result = getWorkerColor(10, undefined, workers);
      // Worker s ID 10 je na indexu 1
      expect(result).toBe(WORKER_COLORS[1]);
    });

    it('mělo by použít modulo pro opakování barev při velkém počtu workers', () => {
      const workers = Array.from({ length: 50 }, (_, i) => ({ id: i }));
      const result = getWorkerColor(45, undefined, workers);
      expect(result).toBe(WORKER_COLORS[45 % WORKER_COLORS.length]);
    });

    it('mělo by vrátit barvu podle ID jako fallback', () => {
      const workerId = 7;
      const result = getWorkerColor(workerId);
      expect(result).toBe(WORKER_COLORS[7 % WORKER_COLORS.length]);
    });

    it('mělo by vrátit první barvu pro workerId 0', () => {
      const result = getWorkerColor(0);
      expect(result).toBe(WORKER_COLORS[0]);
    });
  });

  describe('getRandomWorkerColor', () => {
    it('mělo by vrátit barvu z WORKER_COLORS pole', () => {
      const result = getRandomWorkerColor();
      expect(WORKER_COLORS).toContain(result);
    });

    it('mělo by vrátit validní hex kód', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
      const result = getRandomWorkerColor();
      expect(result).toMatch(hexColorRegex);
    });

    it('mělo by generovat různé barvy při vícenásobném volání (pravděpodobnostně)', () => {
      const colors = new Set();
      for (let i = 0; i < 20; i++) {
        colors.add(getRandomWorkerColor());
      }
      // S 30 dostupnými barvami by mělo 20 volání vygenerovat více než 1 unikátní barvu
      expect(colors.size).toBeGreaterThan(1);
    });
  });

  describe('getLighterColor', () => {
    it('mělo by přidat opacity k hex barvě', () => {
      const color = '#3b82f6';
      const result = getLighterColor(color, 0.2);
      // 0.2 * 255 = 51 = 0x33
      expect(result).toBe('#3b82f633');
    });

    it('mělo by použít výchozí opacity 0.2', () => {
      const color = '#ef4444';
      const result = getLighterColor(color);
      expect(result).toBe('#ef444433');
    });

    it('mělo by správně zaokrouhlit opacity hodnoty', () => {
      const color = '#10b981';
      const result = getLighterColor(color, 0.5);
      // 0.5 * 255 = 127.5 → 128 = 0x80
      expect(result).toBe('#10b98180');
    });

    it('mělo by padovat jednociferné hex hodnoty', () => {
      const color = '#000000';
      const result = getLighterColor(color, 0.02);
      // 0.02 * 255 = 5.1 → 5 = 0x05
      expect(result).toBe('#00000005');
    });

    it('mělo by fungovat s opacity 0 (plně průhledné)', () => {
      const color = '#ffffff';
      const result = getLighterColor(color, 0);
      expect(result).toBe('#ffffff00');
    });

    it('mělo by fungovat s opacity 1 (plně neprůhledné)', () => {
      const color = '#ff5500';
      const result = getLighterColor(color, 1);
      expect(result).toBe('#ff5500ff');
    });
  });

  describe('getInitials', () => {
    it('mělo by vrátit iniciály pro celé jméno', () => {
      expect(getInitials('Jan Novák')).toBe('JN');
    });

    it('mělo by vrátit iniciály pro tři jména', () => {
      expect(getInitials('Jan Karel Novák')).toBe('JK');
    });

    it('mělo by vrátit iniciály pro jedno jméno', () => {
      expect(getInitials('Martin')).toBe('MA');
    });

    it('mělo by vrátit uppercase iniciály', () => {
      expect(getInitials('petr dvořák')).toBe('PD');
    });

    it('mělo by omezit iniciály na 2 znaky', () => {
      expect(getInitials('Jan Karel Petr Novák')).toBe('JK');
    });

    it('mělo by zvládat prázdný string', () => {
      expect(getInitials('')).toBe('');
    });

    it('mělo by zvládat jméno s extra mezerami', () => {
      expect(getInitials('  Jan   Novák  ')).toBe('JN');
    });
  });
});
