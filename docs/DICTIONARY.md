# Dictionary provenance and build policy

## Included source

**Spell Checking Oriented Word Lists (SCOWL), release 2020.12.07** by Kevin Atkinson and contributors, retrieved **2026-10-10**. This older pinned v1 release is deliberate: its generated category files explicitly separate ordinary words, uppercase entries, proper names, abbreviations and contractions.

- Homepage: https://wordlist.aspell.net/
- Release archive: https://downloads.sourceforge.net/wordlist/scowl-2020.12.07.tar.gz
- Archive SHA-256: `5587667caa20c4891390c2d42dbb4d5c4c3f41bee77af1457ece3ba23fb859cc`
- Corresponding source tag: https://github.com/en-wl/wordlist/tree/rel-2020.12.07
- Tag commit: `5ef55f9c42730ebe4394a78b77855468a6f15dd2`
- Licence: https://raw.githubusercontent.com/en-wl/wordlist/rel-2020.12.07/scowl/Copyright

The selected upstream `final/` files, full generated README and complete Copyright are bundled under `data/sources/scowl/`. Upstream taboo lists and their README are under `data/exclusions/scowl-*`. `data/sources/manifest.json` hashes each included source input. Rebuilds use these pinned local files, not the current internet. The manifest separately records the release archive’s checksum and retrieval date; no changing timestamp is inserted into generated outputs.

The collective licence permits use, modification, copying and redistribution with notices retained. It includes Kevin Atkinson/VarCon permission notices, WordNet’s notice and disclaimer, UKACD’s attribution/verbatim-document requirement, Ispell’s notice/disclaimer and marked-modification requirement, and public-domain contributions including ENABLE, Moby and 12Dicts. The full combined Copyright is reproduced verbatim in source and the shipped `public/DICTIONARY-LICENSE.txt`. **UKACD Copyright (c) J Ross Beresford 1993–1999. All Rights Reserved.** Its notice is also displayed in the application footer. Word Lab’s generated dictionary is a modified filtered derivative, not an upstream release. Preserve these notices if redistributing either source or `dist/`.

## Selection process

1. Verify all bundled upstream checksums before building.
2. Read ISO-8859-1 source files, not UTF-8 by assumption.
3. Include only `english-words.*`, `american-words.*`, and `british-words.*`, up to size 80. The `english` category applies to both dialects. Variant-only, `upper`, `proper-names`, `abbreviations`, `contractions`, `special`, and level-95 files are not imported. These exclusions follow upstream metadata rather than attempting to infer names from lowercase text.
4. Trim line endings and accept only source lowercase ASCII `a–z` of length 3–12. Uppercase source entries are rejected before case normalization; punctuation, accents, digits and hyphens are not transliterated. A proper noun with an independently valid common-word meaning can remain when the ordinary-word category includes it.
5. Deduplicate each spelling’s words, keeping its lowest SCOWL coverage level. Track dialect membership with US bit 1 and British bit 2. Combined is their union, and uses the lowest available level in either dialect. UK / NZ style uses British `-ise`; dedicated NZ vocabulary and British Oxford `-ize` are not separately imported. US-derived `-ize` words may occur in Combined.
6. Answers use level ≤35 (Common), ≤60 (Standard), or ≤80 (All), then remove the four upstream taboo lists and the project’s `data/exclusions/answers.txt`. Valid guesses retain those words. Add new exclusions and inflections as separate lines; this does not require changing the source checksum manifest. Upstream files should not be edited casually.
7. Sort entries in ASCII order and output one JSON file per length with `[word,dialectMask,usAnswerLevel,ukAnswerLevel]`. Sentinel 999 means not answer-eligible in that dialect. A word can remain valid while having sentinel levels for both dialects. Metadata records configuration, input identities, exclusions digest, counts for every spelling/difficulty and output hashes.
8. `dictionary:validate` regenerates in memory, checks structure and compares every byte of dictionaries and metadata with the included outputs.

The thresholds live in `data/configuration/dictionary.json` and are shared by selection and the build. The bundled upstream subset ends at 80; increasing that number without importing/verifying the corresponding source files would not add words.

## Familiarity, quality and limitations

SCOWL 35 draws on frequency-informed classes and broad dictionary agreement; 60 is the source’s recommended general spell-check size. Level 80 intentionally includes unusual word-game vocabulary. These bands are a reproducible source selection, **not corpus frequency scores or a newly hand-reviewed game-answer list**. Familiarity varies, including among dialects. Plurals, inflections and some dated/technical words remain. The project does not pretend to have independently validated every answer’s recognisability. SCOWL metadata is the basis for excluding names/abbreviations; source classification errors remain possible.

The original taboo lists are small, dated and not exhaustive. The editable project blocklist is the maintenance mechanism. A word with ordinary and offensive meanings can remain unless explicitly excluded. No enormous guess category is silently removed in the name of answer safety.

All actual counts are included in `src/dictionaries/generated/metadata.json`; the combined-mode table is reproduced in the README. A solver’s zero candidates may indicate feedback errors, a dialect/vocabulary mismatch, or a legitimate word outside this list. That uncertainty is surfaced in the UI.

## Sources investigated but not included

[dwyl/english-words](https://github.com/dwyl/english-words) advertises a repository Unlicense, but its README attributes an extracted Infochimps list and says copyright remains with the original source. Its provenance and data rights need more resolution before inclusion; it also lacks reliable dialect and familiarity/category metadata. No dwyl data is bundled.

Current ESDB/SCOWL v2 has richer data, but the stable v1 category files are better suited to this specific reproducible import. Upgrading should be a deliberate data migration with new pins, licence review, category tests, counts and answer-pool compatibility handling.
