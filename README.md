# csv-reader-speed

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/erzav31/csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/erzav31/csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0: `solve.js` returns exactly csv-reader's answer (`{columns, rows, errors}`) for every input, including its broken-row policy — BOM, stray CR, unterminated quotes, quote junk, short/long rows, blank lines — while parsing most records with native line slicing and `split(',')` and the rest with `indexOf`-based field scans instead of one character at a time.

## Run it

```sh
node main.ts
```

`main.ts` reads every case from `/input/cases.json` (or `$MAKEFUN_INPUT_DIR`) and writes the answers to `/output/answers.json` (or `$MAKEFUN_OUTPUT_DIR`).

---

<sub>Entered on [make.fun](https://make.fun/?ref=vina-erza&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
