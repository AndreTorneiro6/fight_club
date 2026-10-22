# Matchmaking simulation — 12 teams, 10 official rounds

All defenders win. Ranking A–L remains unchanged; no invented results enter the database. First/final rounds are Open Attack. Role rotation is a soft objective in all rounds.

## Default distance 2

### Ranking-only exact coverage

Round 1 | OPEN_ATTACK | distance 2

Before: A B C D E F G H I J K L

B → A; D → C; F → E; H → G; J → I; L → K;

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 2 | NORMAL | distance 2

Before: A B C D E F G H I J K L

B → A (repeat) (consecutive); D → C (repeat) (consecutive); F → E (repeat) (consecutive); H → G (repeat) (consecutive); J → I (repeat) (consecutive); L → K (repeat) (consecutive);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 3 | NORMAL | distance 2

Before: A B C D E F G H I J K L

B → A (repeat) (consecutive); D → C (repeat) (consecutive); F → E (repeat) (consecutive); H → G (repeat) (consecutive); J → I (repeat) (consecutive); L → K (repeat) (consecutive);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 4 | NORMAL | distance 2

Before: A B C D E F G H I J K L

B → A (repeat) (consecutive); D → C (repeat) (consecutive); F → E (repeat) (consecutive); H → G (repeat) (consecutive); J → I (repeat) (consecutive); L → K (repeat) (consecutive);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 5 | NORMAL | distance 2

Before: A B C D E F G H I J K L

B → A (repeat) (consecutive); D → C (repeat) (consecutive); F → E (repeat) (consecutive); H → G (repeat) (consecutive); J → I (repeat) (consecutive); L → K (repeat) (consecutive);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 6 | NORMAL | distance 2

Before: A B C D E F G H I J K L

B → A (repeat) (consecutive); D → C (repeat) (consecutive); F → E (repeat) (consecutive); H → G (repeat) (consecutive); J → I (repeat) (consecutive); L → K (repeat) (consecutive);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 7 | NORMAL | distance 2

Before: A B C D E F G H I J K L

B → A (repeat) (consecutive); D → C (repeat) (consecutive); F → E (repeat) (consecutive); H → G (repeat) (consecutive); J → I (repeat) (consecutive); L → K (repeat) (consecutive);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 8 | NORMAL | distance 2

Before: A B C D E F G H I J K L

B → A (repeat) (consecutive); D → C (repeat) (consecutive); F → E (repeat) (consecutive); H → G (repeat) (consecutive); J → I (repeat) (consecutive); L → K (repeat) (consecutive);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 9 | NORMAL | distance 2

Before: A B C D E F G H I J K L

B → A (repeat) (consecutive); D → C (repeat) (consecutive); F → E (repeat) (consecutive); H → G (repeat) (consecutive); J → I (repeat) (consecutive); L → K (repeat) (consecutive);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 10 | OPEN_ATTACK | distance 2

Before: A B C D E F G H I J K L

B → A (repeat) (consecutive); D → C (repeat) (consecutive); F → E (repeat) (consecutive); H → G (repeat) (consecutive); J → I (repeat) (consecutive); L → K (repeat) (consecutive);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Summary: 6 distinct opponents pairs; 54 rematches; 54 consecutive rematches; 0 unmatched slots; 0 hard violations.

|Team|Attacks|Defenses|Max attack streak|Max defense streak|
|---|---:|---:|---:|---:|
|A|0|10|0|10|
|B|10|0|10|0|
|C|0|10|0|10|
|D|10|0|10|0|
|E|0|10|0|10|
|F|10|0|10|0|
|G|0|10|0|10|
|H|10|0|10|0|
|I|0|10|0|10|
|J|10|0|10|0|
|K|0|10|0|10|
|L|10|0|10|0|

### History-aware exact matching

Round 1 | OPEN_ATTACK | distance 2

Before: A B C D E F G H I J K L

B → A; D → C; F → E; H → G; J → I; L → K;

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 2 | NORMAL | distance 2

Before: A B C D E F G H I J K L

C → A; D → B; G → E; H → F; K → I; L → J;

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 3 | NORMAL | distance 2

Before: A B C D E F G H I J K L

B → A (repeat); E → C; F → D; I → G; J → H; L → K (repeat);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 4 | NORMAL | distance 2

Before: A B C D E F G H I J K L

C → A (repeat); D → B (repeat); F → E (repeat); H → G (repeat); K → I (repeat); L → J (repeat);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 5 | NORMAL | distance 2

Before: A B C D E F G H I J K L

B → A (repeat); D → C (repeat); G → E (repeat); H → F (repeat); J → I (repeat); L → K (repeat);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 6 | NORMAL | distance 2

Before: A B C D E F G H I J K L

C → A (repeat); D → B (repeat); F → E (repeat); H → G (repeat); K → I (repeat); L → J (repeat);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 7 | NORMAL | distance 2

Before: A B C D E F G H I J K L

B → A (repeat); E → C (repeat); F → D (repeat); I → G (repeat); J → H (repeat); L → K (repeat);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 8 | NORMAL | distance 2

Before: A B C D E F G H I J K L

C → A (repeat); D → B (repeat); G → E (repeat); H → F (repeat); K → I (repeat); L → J (repeat);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 9 | NORMAL | distance 2

Before: A B C D E F G H I J K L

B → A (repeat); D → C (repeat); F → E (repeat); H → G (repeat); J → I (repeat); L → K (repeat);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 10 | OPEN_ATTACK | distance 2

Before: A B C D E F G H I J K L

C → A (repeat); D → B (repeat); G → E (repeat); H → F (repeat); K → I (repeat); L → J (repeat);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Summary: 16 distinct opponents pairs; 44 rematches; 0 consecutive rematches; 0 unmatched slots; 0 hard violations.

|Team|Attacks|Defenses|Max attack streak|Max defense streak|
|---|---:|---:|---:|---:|
|A|0|10|0|10|
|B|5|5|1|1|
|C|5|5|1|1|
|D|8|2|3|1|
|E|2|8|1|3|
|F|6|4|2|1|
|G|4|6|1|2|
|H|8|2|3|1|
|I|2|8|1|3|
|J|5|5|1|1|
|K|5|5|1|1|
|L|10|0|10|0|

## Round 5 Open Attack, distance 3

### Ranking-only exact coverage

Round 1 | OPEN_ATTACK | distance 2

Before: A B C D E F G H I J K L

B → A; D → C; F → E; H → G; J → I; L → K;

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 2 | NORMAL | distance 2

Before: A B C D E F G H I J K L

B → A (repeat) (consecutive); D → C (repeat) (consecutive); F → E (repeat) (consecutive); H → G (repeat) (consecutive); J → I (repeat) (consecutive); L → K (repeat) (consecutive);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 3 | NORMAL | distance 2

Before: A B C D E F G H I J K L

B → A (repeat) (consecutive); D → C (repeat) (consecutive); F → E (repeat) (consecutive); H → G (repeat) (consecutive); J → I (repeat) (consecutive); L → K (repeat) (consecutive);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 4 | NORMAL | distance 2

Before: A B C D E F G H I J K L

B → A (repeat) (consecutive); D → C (repeat) (consecutive); F → E (repeat) (consecutive); H → G (repeat) (consecutive); J → I (repeat) (consecutive); L → K (repeat) (consecutive);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 5 | OPEN_ATTACK | distance 3

Before: A B C D E F G H I J K L

B → A (repeat) (consecutive); D → C (repeat) (consecutive); F → E (repeat) (consecutive); H → G (repeat) (consecutive); J → I (repeat) (consecutive); L → K (repeat) (consecutive);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 6 | NORMAL | distance 2

Before: A B C D E F G H I J K L

B → A (repeat) (consecutive); D → C (repeat) (consecutive); F → E (repeat) (consecutive); H → G (repeat) (consecutive); J → I (repeat) (consecutive); L → K (repeat) (consecutive);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 7 | NORMAL | distance 2

Before: A B C D E F G H I J K L

B → A (repeat) (consecutive); D → C (repeat) (consecutive); F → E (repeat) (consecutive); H → G (repeat) (consecutive); J → I (repeat) (consecutive); L → K (repeat) (consecutive);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 8 | NORMAL | distance 2

Before: A B C D E F G H I J K L

B → A (repeat) (consecutive); D → C (repeat) (consecutive); F → E (repeat) (consecutive); H → G (repeat) (consecutive); J → I (repeat) (consecutive); L → K (repeat) (consecutive);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 9 | NORMAL | distance 2

Before: A B C D E F G H I J K L

B → A (repeat) (consecutive); D → C (repeat) (consecutive); F → E (repeat) (consecutive); H → G (repeat) (consecutive); J → I (repeat) (consecutive); L → K (repeat) (consecutive);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 10 | OPEN_ATTACK | distance 2

Before: A B C D E F G H I J K L

B → A (repeat) (consecutive); D → C (repeat) (consecutive); F → E (repeat) (consecutive); H → G (repeat) (consecutive); J → I (repeat) (consecutive); L → K (repeat) (consecutive);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Summary: 6 distinct opponents pairs; 54 rematches; 54 consecutive rematches; 0 unmatched slots; 0 hard violations.

|Team|Attacks|Defenses|Max attack streak|Max defense streak|
|---|---:|---:|---:|---:|
|A|0|10|0|10|
|B|10|0|10|0|
|C|0|10|0|10|
|D|10|0|10|0|
|E|0|10|0|10|
|F|10|0|10|0|
|G|0|10|0|10|
|H|10|0|10|0|
|I|0|10|0|10|
|J|10|0|10|0|
|K|0|10|0|10|
|L|10|0|10|0|

### History-aware exact matching

Round 1 | OPEN_ATTACK | distance 2

Before: A B C D E F G H I J K L

B → A; D → C; F → E; H → G; J → I; L → K;

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 2 | NORMAL | distance 2

Before: A B C D E F G H I J K L

C → A; D → B; G → E; H → F; K → I; L → J;

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 3 | NORMAL | distance 2

Before: A B C D E F G H I J K L

B → A (repeat); E → C; F → D; I → G; J → H; L → K (repeat);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 4 | NORMAL | distance 2

Before: A B C D E F G H I J K L

C → A (repeat); D → B (repeat); F → E (repeat); H → G (repeat); K → I (repeat); L → J (repeat);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 5 | OPEN_ATTACK | distance 3

Before: A B C D E F G H I J K L

B → A (repeat); F → C; E → D; J → G; K → H; L → I;

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 6 | NORMAL | distance 2

Before: A B C D E F G H I J K L

C → A (repeat); D → B (repeat); G → E (repeat); H → F (repeat); J → I (repeat); L → K (repeat);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 7 | NORMAL | distance 2

Before: A B C D E F G H I J K L

B → A (repeat); E → C (repeat); F → D (repeat); H → G (repeat); K → I (repeat); L → J (repeat);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 8 | NORMAL | distance 2

Before: A B C D E F G H I J K L

C → A (repeat); D → B (repeat); F → E (repeat); I → G (repeat); J → H (repeat); L → K (repeat);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 9 | NORMAL | distance 2

Before: A B C D E F G H I J K L

B → A (repeat); D → C (repeat); G → E (repeat); H → F (repeat); K → I (repeat); L → J (repeat);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Round 10 | OPEN_ATTACK | distance 2

Before: A B C D E F G H I J K L

C → A (repeat); D → B (repeat); F → E (repeat); H → G (repeat); J → I (repeat); L → K (repeat);

After: A B C D E F G H I J K L. Unmatched: none. Hard violations: 0.

Summary: 21 distinct opponents pairs; 39 rematches; 0 consecutive rematches; 0 unmatched slots; 0 hard violations.

|Team|Attacks|Defenses|Max attack streak|Max defense streak|
|---|---:|---:|---:|---:|
|A|0|10|0|10|
|B|5|5|1|1|
|C|5|5|1|1|
|D|7|3|3|1|
|E|3|7|1|3|
|F|7|3|3|1|
|G|3|7|1|3|
|H|7|3|2|1|
|I|2|8|1|4|
|J|6|4|2|1|
|K|5|5|2|1|
|L|10|0|10|0|

Exhaustive enumeration finds exactly 13 full-coverage schedules at distance 2, whose union contains 16 distinct pairings. Across 60 games, at least 44 rematches are therefore unavoidable in aggregate. The intelligent default achieves this lower bound and avoids every consecutive rematch. Individual repeated pairings may still be replaceable at equal coverage, trading another repeated edge; per-edge counterfactual warnings distinguish this from fixed/coverage-unavoidable repetition.

The optimizer first maximizes coverage, then deterministic weighted priorities, consecutive/recent repeat penalties, lifetime pair frequency and role imbalance. Champion A cannot attack and last-ranked L cannot defend: perfect alternation is impossible. A repeated edge is not labelled mathematically unavoidable merely because selected by the global objective; local alternatives may reduce that edge while worsening total variety/coverage. Administrators review all warnings. Exact infeasibility follows complete enumeration of eligible matchings. No live data were read or written.
