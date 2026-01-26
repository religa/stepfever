# SSC Test Charts

Test charts for SSC parser development.

## Real-World Charts (Downloaded)

### Springtime.ssc
- **Source:** [garcia/simfile](https://github.com/garcia/simfile) testdata
- **Artist:** Kommisar
- **BPM:** 181.685 (displayed as 182)
- **Features:**
  - 9 charts (dance-single and pump-single)
  - Per-chart BPM changes (90.843 to 726.74)
  - Per-chart OFFSET overrides
  - TIMESIGNATURES
  - CHARTNAME, DISPLAYBPM

### stepmania-springtime.ssc
- **Source:** [stepmania/stepmania](https://github.com/stepmania/stepmania) official repo
- **Same song, different version**

### L9.ssc
- **Source:** [garcia/simfile](https://github.com/garcia/simfile) testdata
- **Artist:** paraoka
- **BPM:** 123
- **Features:**
  - Complex TIMESIGNATURES (multiple changes: 4/4, 3/4, 2/4, 3/8)
  - KEYSOUNDS (extensive list of .ogg files)
  - CHARTNAME, CREDIT
  - Per-chart timing overrides

### nekonabe.sm
- **Source:** [garcia/simfile](https://github.com/garcia/simfile) testdata
- **Title:** 猫鍋 (Nekonabe)
- **Artist:** 再生ハイパーべるーヴ (saisei hyperberoove)
- **BPM:** 140
- **Features:**
  - SM format (for comparison)
  - BGCHANGES (extensive video backgrounds)
  - LYRICSPATH (.lrc file)
  - Japanese text (transliteration support)

## Synthetic Test Charts

### test-lifts.ssc
- **Purpose:** Test lift note (L) parsing and judgment
- **Features:**
  - Basic lift notes
  - Mixed taps and lifts
  - Simultaneous lifts
  - Per-chart BPM/OFFSET overrides
  - STOPS

### test-per-chart-timing.ssc
- **Purpose:** Test per-chart timing overrides
- **Features:**
  - 4 difficulties with different timing:
    - Easy: Uses song-level timing
    - Medium: Overrides BPM (150→180)
    - Hard: Overrides OFFSET, adds STOPS
    - Challenge: Complex BPM changes (150→75→300→150), multiple TIMESIGNATURES

## Feature Coverage

| Feature | Springtime | L9 | test-lifts | test-per-chart |
|---------|------------|----|-----------| ---------------|
| Per-chart BPMS | ✓ | ✓ | ✓ | ✓ |
| Per-chart STOPS | | | ✓ | ✓ |
| Per-chart OFFSET | ✓ | | ✓ | ✓ |
| TIMESIGNATURES | ✓ | ✓ | | ✓ |
| CHARTNAME | ✓ | ✓ | ✓ | ✓ |
| CREDIT | | ✓ | ✓ | ✓ |
| DISPLAYBPM | ✓ | | ✓ | ✓ |
| KEYSOUNDS | | ✓ | | |
| Lift notes (L) | | | ✓ | |

## Usage

```typescript
import { parseSM } from '@stepfever/core';
import { readFileSync } from 'fs';

const content = readFileSync('tests/fixtures/ssc-samples/Springtime.ssc', 'utf-8');
const chart = parseSM(content);
```

## Sources

- [garcia/simfile](https://github.com/garcia/simfile) - Python simfile library with test data
- [stepmania/stepmania](https://github.com/stepmania/stepmania) - Official StepMania repo
- [SSC Format Spec](https://github.com/stepmania/stepmania/wiki/ssc) - Official SSC documentation
