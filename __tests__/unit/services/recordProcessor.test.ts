import { describe, it, expect } from 'vitest';
import { parseTableCompletionPatterns } from '../../../services/recordProcessor';

describe('recordProcessor', () => {
  describe('parseTableCompletionPatterns', () => {
    describe('Pattern 1: "hotový stůl X"', () => {
      it('mělo by rozpoznat "hotový stůl 28.1"', () => {
        const result = parseTableCompletionPatterns('hotový stůl 28.1');
        expect(result).toEqual(['28.1']);
      });

      it('mělo by rozpoznat "hotová stůl 28.1"', () => {
        const result = parseTableCompletionPatterns('hotová stůl 28.1');
        expect(result).toEqual(['28.1']);
      });

      it('mělo by rozpoznat variantu s "u" - "hotový stul 42"', () => {
        const result = parseTableCompletionPatterns('hotový stul 42');
        expect(result).toEqual(['42']);
      });
    });

    describe('Pattern 2: "stůl X hotový"', () => {
      it('mělo by rozpoznat "stůl IT42-5 hotový"', () => {
        const result = parseTableCompletionPatterns('stůl IT42-5 hotový');
        expect(result).toEqual(['IT42-5']);
      });

      it('mělo by rozpoznat "stůl 149 hotový"', () => {
        const result = parseTableCompletionPatterns('stůl 149 hotový');
        expect(result).toEqual(['149']);
      });

      it('mělo by rozpoznat "stul 99 hotová"', () => {
        const result = parseTableCompletionPatterns('stul 99 hotová');
        expect(result).toEqual(['99']);
      });
    });

    describe('Pattern 3: "dokončil X"', () => {
      it('mělo by rozpoznat "dokončil 149"', () => {
        const result = parseTableCompletionPatterns('dokončil 149');
        expect(result).toEqual(['149']);
      });

      it('mělo by rozpoznat "dokončen 75"', () => {
        const result = parseTableCompletionPatterns('dokončen 75');
        expect(result).toEqual(['75']);
      });

      it('mělo by rozpoznat "dokončeno 88"', () => {
        const result = parseTableCompletionPatterns('dokončeno 88');
        expect(result).toEqual(['88']);
      });

      it('mělo by rozpoznat "dokončil stůl 42"', () => {
        const result = parseTableCompletionPatterns('dokončil stůl 42');
        expect(result).toEqual(['42']);
      });

      it('mělo by rozpoznat "dokončeno stul A-123"', () => {
        const result = parseTableCompletionPatterns('dokončeno stul A-123');
        expect(result).toEqual(['A-123']);
      });
    });

    describe('Pattern 4: "X dokončen"', () => {
      it('mělo by rozpoznat "55 dokončen"', () => {
        const result = parseTableCompletionPatterns('55 dokončen');
        expect(result).toEqual(['55']);
      });

      it('mělo by rozpoznat "66 dokončeno"', () => {
        const result = parseTableCompletionPatterns('66 dokončeno');
        expect(result).toEqual(['66']);
      });

      it('mělo by rozpoznat "stůl 77 dokončen"', () => {
        const result = parseTableCompletionPatterns('stůl 77 dokončen');
        expect(result).toEqual(['77']);
      });

      it('mělo by rozpoznat "stul B-99 dokončeno"', () => {
        const result = parseTableCompletionPatterns('stul B-99 dokončeno');
        expect(result).toEqual(['B-99']);
      });
    });

    describe('Pattern 5: "TR X" (legacy format)', () => {
      it('mělo by rozpoznat "TR 36"', () => {
        const result = parseTableCompletionPatterns('TR 36');
        expect(result).toEqual(['36']);
      });

      it('mělo by rozpoznat "TR36" (bez mezery)', () => {
        const result = parseTableCompletionPatterns('TR36');
        expect(result).toEqual(['36']);
      });

      it('mělo by rozpoznat "TR 28.1" s desetinným číslem', () => {
        const result = parseTableCompletionPatterns('TR 28.1');
        expect(result).toEqual(['28.1']);
      });
    });

    describe('Vícenásobné tabulky', () => {
      it('mělo by rozpoznat více tabulek v jednom popisu', () => {
        const result = parseTableCompletionPatterns(
          'hotový stůl 28.1, dokončil 149, stůl IT42-5 hotový'
        );
        expect(result).toHaveLength(3);
        expect(result).toContain('28.1');
        expect(result).toContain('149');
        expect(result).toContain('IT42-5');
      });

      it('mělo by odstranit duplicity', () => {
        const result = parseTableCompletionPatterns(
          'hotový stůl 42 a stůl 42 hotový'
        );
        expect(result).toEqual(['42']);
      });

      it('mělo by rozpoznat mix různých formátů', () => {
        const result = parseTableCompletionPatterns(
          'dokončil stůl 10, TR 20, 30 dokončeno, hotový stůl 40'
        );
        expect(result).toHaveLength(4);
        expect(result).toContain('10');
        expect(result).toContain('20');
        expect(result).toContain('30');
        expect(result).toContain('40');
      });
    });

    describe('Okrajové případy', () => {
      it('mělo by vrátit prázdné pole pro prázdný string', () => {
        const result = parseTableCompletionPatterns('');
        expect(result).toEqual([]);
      });

      it('mělo by vrátit prázdné pole pro text bez vzorů', () => {
        const result = parseTableCompletionPatterns('Dnes jsem pracoval na projektu');
        expect(result).toEqual([]);
      });

      it('mělo by fungovat s velkými písmeny', () => {
        const result = parseTableCompletionPatterns('HOTOVÝ STŮL 123');
        expect(result).toEqual(['123']);
      });

      it('mělo by fungovat se smíšenou velikostí písmen', () => {
        const result = parseTableCompletionPatterns('HoToVý StŮl 456');
        expect(result).toEqual(['456']);
      });

      it('mělo by rozpoznat alfanumerické kódy', () => {
        const result = parseTableCompletionPatterns('hotový stůl A1-B2-C3');
        expect(result).toEqual(['A1-B2-C3']);
      });

      it('mělo by rozpoznat kódy s podtržítky', () => {
        const result = parseTableCompletionPatterns('dokončil TABLE_001');
        expect(result).toEqual(['TABLE_001']);
      });

      it('mělo by zvládat více mezer', () => {
        const result = parseTableCompletionPatterns('hotový   stůl   99');
        // Regex očekává jednu mezeru, takže toto by nemělo matchnout
        // Ale \s+ matchuje více mezer, takže by mělo fungovat
        expect(result).toContain('99');
      });

      it('mělo by zvládat nové řádky v textu', () => {
        const result = parseTableCompletionPatterns(
          'hotový stůl 11\ndokončil 22\nTR 33'
        );
        expect(result).toHaveLength(3);
        expect(result).toContain('11');
        expect(result).toContain('22');
        expect(result).toContain('33');
      });
    });

    describe('Reálné scénáře', () => {
      it('mělo by parsovat typický popis pracovníka', () => {
        const description = 'Dnes jsem dokončil stůl 28.1 a hotový stůl 29. Ještě jsem pracoval na TR 30.';
        const result = parseTableCompletionPatterns(description);
        expect(result).toHaveLength(3);
        expect(result).toContain('28.1');
        expect(result).toContain('29');
        expect(result).toContain('30');
      });

      it('mělo by parsovat krátký popis', () => {
        const description = 'hotový 15';
        const result = parseTableCompletionPatterns(description);
        // "hotový 15" nematchuje žádný pattern, protože chybí "stůl"
        // Pouze "hotový stůl 15" by matchlo
        expect(result).toEqual([]);
      });

      it('mělo by parsovat popis s interpunkcí', () => {
        const description = 'Dokončil jsem: stůl 100 hotový, stůl 101 hotový, TR 102!';
        const result = parseTableCompletionPatterns(description);
        expect(result).toHaveLength(3);
        expect(result).toContain('100');
        expect(result).toContain('101');
        expect(result).toContain('102');
      });
    });
  });
});
