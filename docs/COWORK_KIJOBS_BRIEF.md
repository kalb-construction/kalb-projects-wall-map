# Brief for Cowork — U:\KIJOBS Completed-Projects Extraction

**Requester:** Akash (Kalb Construction) · **Date issued:** 2026-08-17
**Target:** every Kalb job folder under `U:\KIJOBS`
**Scope:** projects **completed between 2024-01-01 and 2026-08-17 inclusive**
**Consumer:** the Kalb Project Atlas lobby wall (`public/data/projects.json`, 51 existing records)

Your output is merged into a live display in the Kalb lobby. A wrong value is worse than a missing one. Read the rules below literally.

---

## 0. Hard constraints — read first

> **Two fields can take the whole lobby wall down if they are wrong.**
> `number` must be a **quoted string** and must never be absent — the app
> seeds its procedural artwork from it and a missing value throws.
> `name` must never be absent unless `shortName` is present — the index
> rail sorts on it and a missing value throws. The app now drops such rows
> instead of crashing, but a dropped row is a project that silently is not
> on the wall. Get these two right on every record.


1. **`U:\` is read-only. You must not write, create, rename, move, delete, or modify anything on it** — including temp files, lock files, and metadata.
   - Do **not** open `.docx` / `.xlsx` / `.pdf` in a desktop Office/Acrobat application from the share. Office writes an owner lock file (`~$name.docx`) **into the same folder** — that is a write to `U:\` and it is prohibited.
   - If you must open a document with an application, **copy it to a local scratch directory first and open the copy.** Prefer library-based reads (python-docx, openpyxl, pdfplumber/pypdf, OCR for scans) over any application.
   - Do not change ACLs, do not "check out" anything, do not touch folders outside `U:\KIJOBS`.
2. **Never fabricate.** Every value you emit must be transcribable to a specific document, or derived by a rule written in this brief. If you cannot do either, **omit the key** and name it in `missing`. Omission is a supported, expected state — 31 of the 51 existing records already carry data-quality flags.
3. **Never guess by proximity.** File modified-timestamps, folder location ("Archive", "Old Jobs"), alphabetical neighbours, and your own knowledge of Las Vegas addresses are **not evidence**. The share has been migrated; mtimes are meaningless.
4. **Never resolve a conflict yourself.** Two documents disagreeing is an ambiguity for Kalb to rule on, not a tie for you to break. Precedent: job number 25126 appeared on two rows and required a human ruling from Kalb, not a heuristic.
5. **Nothing is silently dropped.** Every folder you walk ends up in exactly one of: the batch file, the review queue, or the skipped-folders table with a reason.
6. All output goes to a **local** path you control. Give me the paths when you're done.

---

## 0b. Two facts confirmed by Kalb (2026-08-17)

**1. The job number encodes the year the job was OPENED.** The first two
digits + 2000: `26104` → 2026, `25130` → 2025, `24118` → 2024. This is
authoritative — use it for the `year` field and never read a year off a
folder name or a file date.

> **Do not mistake this for a completion filter.** The number says when a job
> *started*, not when it *finished*. A `24xxx` job may have completed in 2026,
> and a `23xxx` job may well have completed inside our 2024+ window. So:
> - **Scan every folder numbered `23xxx` and higher.** All of them.
> - Folders numbered `22xxx` or lower are unlikely to have finished after
>   2024-01-01, but multi-year jobs exist. If the folder count is manageable,
>   check them too. If you skip them, say so explicitly in the summary as a
>   known gap — do not let them vanish silently.
> - `B`-prefixed numbers (`B1329`, `B1335`, `B7035`) carry **no year**. Omit
>   `year` for them and determine the window purely from the completion date.
>
> The completion date from §3 is the only thing that decides whether a job is
> in scope. The number prefix only decides where to look first.

**2. The site address lives in the contract.** Treat the owner contract as the
authoritative source for `address`, `city`, and `state`. Use the building
permit or the Certificate of Occupancy only to confirm it, or when no contract
is present in the folder. If the contract and the permit disagree on the
address, that is an ambiguity for Kalb (§8) — do not pick one.

---

## 1. Phase 0 — reconnaissance before the full walk (do this first, then report)

Do not extract 500 folders against a guessed folder taxonomy.

1. List `U:\KIJOBS` one level deep. Report: total folder count, the naming pattern(s) you see (e.g. `24118 Dorrell Retail`, `2024\24118 ...`, `Completed\...`), and any non-job folders (templates, `_ADMIN`, `ZZ Old`, personal folders).
2. Open **5–10** folders spanning different years and report their actual internal structure — subfolder names verbatim.
3. Run the full pipeline on **3 folders only** and show me the 3 output records.
4. **Stop and report.** Do not proceed to the full walk until I confirm.

---

## 2. What a job folder contains and where to look

Expect roughly this shape; the real names will differ and Phase 0 tells us the truth. Search **recursively** — closeout documents are routinely filed in the wrong subfolder.

| Subfolder (typical) | Contains | What you read it for |
|---|---|---|
| `Contracts` / `01 Contract` | Owner contract, subcontracts, exhibits | Legal project name, site address, owner, scope, contract sq ft |
| `Permits` | Building permit, plan-check, **Certificate of Occupancy** | **Completion evidence**, jurisdiction, address as permitted, sq ft |
| `Closeout` / `Close Out` / `07 Closeout` | O&M manuals, warranties, as-builts, **AIA G704**, **Notice of Completion**, punch list, closeout transmittal | **Primary completion evidence + date** |
| `Pay Apps` / `Billing` / `Accounting` | AIA G702/G703 applications, retention release, final invoice | **Final pay app = completion evidence**; period-to date |
| `Submittals` / `Shop Drawings` | Product data, approvals | Rarely useful — ignore unless nothing else exists |
| `Schedule` | Baseline + updates, P6/MS Project exports, lookaheads | Actual finish date (weaker evidence — see §3) |
| `RFIs`, `Change Orders`, `Correspondence`, `Safety`, `Daily Reports` | Project admin | Ignore for extraction; may confirm a date in a dispute |
| `Drawings` / `Plans` | Architectural set, title block, site plan | Project name, address, sq ft, building count |
| `Insurance` / `COI` | Certificates | Ignore — different tool |
| `Photos` | Site photography | **Do not copy or reference.** Note the folder path in `source.photoFolder` only |

**Ignore entirely:** `Thumbs.db`, `desktop.ini`, `~$*` files, `.tmp`, empty folders, template/boilerplate folders, anything under an obvious admin or personal directory.

**Scans:** permits and CofOs are frequently scanned image PDFs. OCR them. If OCR confidence is poor, do not transcribe a half-read number — record the ambiguity.

---

## 3. Deciding a job is COMPLETE, and dating it

A job counts as complete only on **documentary evidence inside the folder**. Use this ladder; take the highest tier present and record which tier you used.

| Tier | Evidence | Date to use |
|---|---|---|
| **A — authoritative** | Certificate of Occupancy (or Temporary CofO) issued by the AHJ | Issue date printed on the certificate |
| **A** | AIA **G704** Certificate of Substantial Completion, signed | The **Date of Substantial Completion** field (not the signature date, if they differ — if they differ, note it) |
| **B — strong** | Recorded **Notice of Completion** (county recorder stamp) | Date of completion stated on the notice |
| **B** | Final pay application (G702 marked FINAL / retention billed at 100%) or final unconditional lien release | Period-ending date on the final application |
| **C — supporting only** | Signed-off punch list, closeout transmittal letter, warranty start date, owner acceptance letter | Date on the document |
| **Not evidence** | Folder sits under "Completed"/"Archive"; schedule shows a past finish; file mtimes; last invoice with no FINAL marking | — |

Rules:

- **Tier A or B → treat as complete.** Tier C only → treat as complete but add an ambiguity entry noting the weak evidence and the tier.
- **"Not evidence" only → the job is not complete.** Skip it with reason `no-completion-evidence`. Do not upgrade a folder location into a verdict.
- **Multiple tier-A/B dates that disagree by more than 30 days** → still emit the record using the **highest tier**, and raise an ambiguity listing every date and its source document. Do not average, do not take the latest.
- **Completion evidence exists but no legible date** → do **not** guess and do **not** drop it. Send the record to the **review queue** with rule `R-UNDATED-COMPLETE`, including the evidence you did find.
- **Window filter:** keep only completion dates `2024-01-01 ≤ d ≤ 2026-08-17`. Earlier → skip reason `completed-before-window`. Later (data-entry error or forward-dated CofO) → review queue, rule `R-DATE-FUTURE`.

---

## 4. Output — three local files

| File | Content |
|---|---|
| `kijobs-extract-2026-08-17.json` | **A JSON array of record objects** (§5). Nothing else in the file. |
| `kijobs-review-queue-2026-08-17.json` | A JSON array of `{ "folder", "rule", "reason", "partialRecord" }` — everything that could not be emitted as a clean record. |
| `kijobs-run-summary.md` | Counts, skipped-folder table, new enum values, and the ambiguity list (§8). |

The batch file must parse as one array of objects: UTF-8, no BOM, no comments, no trailing commas, no `NaN`/`Infinity`. **If any record cannot be made valid, it goes to the review queue — never emit a partially valid batch.** A parse error causes the wall to show a read error, which is not acceptable.

---

## 5. Record schema

Each array element has exactly two keys: `project` and `source`.

`project` must contain **only** keys from the list in §6 — the app's `Project` interface. Any extra key is a schema violation. Put everything else in `source`.

```jsonc
{
  "project": { /* §6 fields only */ },
  "source": {
    "folder": "U:\\KIJOBS\\...",           // required, absolute UNC/drive path
    "completionTier": "A",                  // A | B | C, per §3
    "completionEvidence": {                 // required
      "document": "Permits\\CofO_24118.pdf",
      "type": "Certificate of Occupancy",
      "date": "2025-04-18",
      "page": 1
    },
    "photoFolder": "U:\\KIJOBS\\...\\Photos",   // optional, path only
    "documentsRead": ["Contracts\\...", "Closeout\\..."],
    "provenance": {                         // required for EVERY key present in `project`
      "name": { "mode": "READ", "document": "Contracts\\Owner Agreement.pdf", "detail": "cover page" },
      "region": { "mode": "DERIVED", "rule": "city-region-table" },
      "featured": { "mode": "CONSTANT" }
    },
    "missing": ["lat", "lng", "sqFt"],      // required array; [] if nothing missing
    "ambiguities": []                       // required array; [] if none
  }
}
```

**Provenance modes — only three are legal:**

| Mode | Means | Requires |
|---|---|---|
| `READ` | Transcribed from a named document | `document`, plus `detail` (page/section/field) |
| `DERIVED` | Computed by a rule **stated in this brief** from other fields in this same record | `rule` (the rule name from §6) |
| `CONSTANT` | Fixed by this brief (`featured`, `heroImage`, `status`) | nothing |

Any value that would require information from outside the folder — geocoding, web lookup, your own knowledge of the city — is **forbidden**. Omit the key instead.

**A missing key is not an error. A wrong key is.** If it isn't in the documents, it belongs in `missing`, and the wall renders it as "—".

---

## 6. Field reference

Required in every record: `id`, `number`, `name`, `address`, `city`, `state`, `region`, `category`, `status`, `description`, `featured`, `heroImage`. If `city`, `state`, or `region` cannot be established, the record goes to the review queue — those three are grouping keys and a wrong or absent one breaks the index rail.

| Field | Type | Rule |
|---|---|---|
| `id` | string | `= number` for Kalb/B jobs. Must match `^[A-Za-z0-9][A-Za-z0-9-]*$` — no spaces, dots, slashes, `#`, `%`, accents. Must be unique in the batch **and** against the 51 existing ids in §7, compared case-insensitively. Collision → review queue, never rename to dodge it. |
| `number` | **string** | Job number exactly as printed: `"24118"`, `"B1335"`. **Always quoted** — a JSON number silently collapses the procedural building art. Missing `number` crashes the wall; no number → review queue. |
| `name` | string | Full project name as Kalb writes it — prefer the owner contract, then the permit, then the drawing title block. Not the folder name unless nothing else exists (then flag it). |
| `shortName` | string, optional | Only when `name` exceeds ~24 chars or contains a parenthetical. Omit otherwise. |
| `address` | string | Street address as printed. **Read it from the owner contract** — Kalb confirms that is where site addresses live. Permit/CofO is a cross-check, or the fallback when no contract exists. Contract and permit disagreeing → ambiguity, not a coin-flip. Intersection-only is acceptable — use the intersection and add the flag `"Street number not supplied"`. |
| `city` | string | **Grouping key — exact spelling from §7's city list** when the city already exists. A new spelling silently creates a duplicate filter chip and index section. New city (not in the list) is allowed but must be reported in the summary under "new enum values". |
| `state` | string | `"NV"` or `"AZ"` — two-letter postal only. |
| `region` | `LV` \| `NNV` \| `AZ` | `DERIVED`, rule `city-region-table`: Las Vegas / North Las Vegas / Henderson → `LV`; Carson City / Reno / Sparks / Dayton → `NNV`; any AZ city → `AZ`. City not in the table → omit `region`, add to `missing`, raise an ambiguity. |
| `lat`, `lng` | number | **Do not geocode. Ever.** Emit only if actual coordinates appear in a document (site plan, survey, ALTA). Otherwise omit both and list both in `missing` — a human geocodes them at merge. This is expected on most records. |
| `category` | enum | Exactly one of: `Retail`, `Restaurant`, `Office & TI`, `Industrial`, `Civic & Housing`, `Medical`, `Tavern & Gaming`, `Automotive & Storage`, `Recreation & Events`, `Civil & Sitework`, `Design-Build`. **Never invent a value** — a new one breaks the filter tray. Nothing fits → omit, list in `missing`, raise an ambiguity. |
| `projectType` | string, optional | Verbatim Kalb project-type wording if present (`"GU Retail"`, `"TI Office"`, `"Site Work (ROW)"`). Do not translate or tidy. |
| `team` | string, optional | Lowercase existing team id: `jj`, `rp`, `tp`, `mk`, `jb`, `rj`, `rc`, `sb`, `ng`, `dd`, `db`, `blak`. PM initials that map to none of these → omit, flag, report as new enum value. |
| `superintendent` | string \| null, optional | Initials or name as written. Two spellings across documents → carry neither silently: pick nothing, omit, and raise an ambiguity listing both. |
| `status` | `"Complete"` | `CONSTANT` for this batch. Everything you emit is complete by definition. |
| `progress` | 100 | `DERIVED`, rule `complete-implies-100`. |
| `estCompletion` | string, optional | The completion date **as printed on the evidence document** (`"04/18/2025"`, `"Completed FEB 2026"`). Despite the name, finished jobs carry the actual date here. |
| `estCompletionDate` | `YYYY-MM-DD` | `DERIVED`, rule `date-normalise` from `estCompletion`. Month-only → last day of that month (existing precedent). Unparseable → omit both this and the normalised form, and use the review queue. |
| `sqFt` | integer, optional | Digits only, no commas, no "approx". From permit, contract scope, or drawing title block. **Never convert acreage to square feet.** |
| `sqFtNote` | string, optional | Where a number isn't available or the measure isn't sq ft: `"71.32 acres, sitework"`. |
| `year` | number, optional | `DERIVED`, rule `year-from-number`: first two digits + 2000 (`"24118"` → `2024`). Confirmed by Kalb as the year the job was **opened**, not completed — the two routinely differ and that is fine. **B-jobs and BLAK records omit `year`.** |
| `featured` | boolean | `CONSTANT` `false`. Featuring is Kalb's editorial call, not extractable. |
| `heroImage` | null | `CONSTANT` literal `null`. This is the one legal null besides `superintendent`. |
| `photos` | — | **Never populate.** Put the folder path in `source.photoFolder`. |
| `siteId` / `siteName` | string, optional | Only when two or more jobs genuinely share one pad/campus. `siteId` is kebab-case. Do not invent groupings. |
| `flags` | string[], optional | Data-quality notes shown in an amber box on the wall. **Reuse the existing vocabulary verbatim** where it fits (§7). One flag per issue, plain sentence, no IDs or jargon. |
| `description` | string | Compose **only** from facts already in this record, template: `"{projectType} · {sqFt} sf in {city}. Completed {estCompletion}."` Drop any clause whose field is absent. Fewer than two facts available → omit `description`, list in `missing`. **No narrative, no adjectives, no marketing.** |
| `duration`, `budgetOutcome`, `developer` | | BLAK records only (§7). Omit for Kalb jobs. |
| anything else | | Not in the schema. Put it in `source`, never in `project`. |

**Forbidden values anywhere in `project`:** `"N/A"`, `"TBD"`, `"Unknown"`, `"None"`, `"-"`, `""`, `"null"`, `"undefined"`, `"0"`, `"00/00/0000"`, and `null` for anything other than `heroImage`/`superintendent`. These render verbatim on the lobby wall as though Kalb wrote them. The correct representation of "we don't know" is **key absent + entry in `missing`** (+ a flag where a viewer would otherwise wonder).

---

## 7. Reference lists — match these exactly

**Existing ids and job numbers (do not collide with any of these):**

```
24106 24114 24132 24136 24138 24139 24146 24700 24703 25126 25127 25130
25131 25132 25133 25134 25137 25140 25147 25152 25153 25154 25155 25701
25900 26101 26102 26103 26104 26105 26108 26109 26110 26111 26113 26119
26700 26701 26705 26706 26707 26708 26709 26900 B1329 B1335 B7035
blak-cheyenne-warehouse  blak-sunset-warehouse  blak-skye-pointe  blak-99th-mcdowell
```

Note 24138, 25153, 25154, 24146, 24114, 26103 are **already** in the atlas as Complete. If you find their folders, do not re-emit them — skip with reason `already-in-atlas`, and raise an ambiguity **only** if your evidence contradicts the existing record.

**City → state → region (existing spellings — match character for character):**

| City | State | Region |
|---|---|---|
| Las Vegas · North Las Vegas · Henderson | NV | LV |
| Carson City · Reno · Sparks · Dayton | NV | NNV |
| Gilbert · Avondale | AZ | AZ |

**Existing flag vocabulary — reuse these strings rather than paraphrasing:**

```
Street address not supplied        Street number not supplied
Street number not on file          Square footage not on file
Est. completion not on file        No completion date supplied
Project type not on file           Superintendent not on file
Superintendent unverified          Superintendent conflict: X vs Y
City derived from the coordinates — confirm
Shared pin: <intersection>
```

**BLAK Development jobs** (if any appear under KIJOBS): `id` = `"blak-" + kebab-case short name`, `number` = `"BLAK"`, `developer` = `"blak"`, `team` = `"blak"`, add `shortName`, omit `year`, and use `duration` / `budgetOutcome` only if a document states them.

---

## 8. Ambiguities, review queue, and the run summary

**Ambiguity entry** (in `source.ambiguities`, and repeated in the summary):

```json
{
  "field": "estCompletionDate",
  "candidates": [
    { "value": "2025-04-18", "source": "Permits\\CofO_24118.pdf", "tier": "A" },
    { "value": "2025-06-30", "source": "Pay Apps\\App 14 FINAL.pdf", "tier": "B" }
  ],
  "whyUnresolved": "CofO precedes final billing by 73 days; brief forbids picking one",
  "questionForKalb": "Which date should the wall show as completion for 24118?"
}
```

Raise an ambiguity — do not resolve — for: conflicting dates, conflicting names/addresses across documents, illegible OCR on a load-bearing value, a job number appearing in two folders, a category with no clean fit, a PM who maps to no existing team, and any tier-C-only completion.

**Review-queue rules** (each rejected row records its folder path and rule id):

| Rule | Trigger |
|---|---|
| `R-ID-CHARSET` | id contains anything outside `[A-Za-z0-9-]` |
| `R-ID-DUP` | id collides in-batch or with §7, case-insensitively |
| `R-NUM-MISSING` | no legible job number |
| `R-DUP-JOBNUM` | same job number in two folders — **emit neither**, queue both |
| `R-UNDATED-COMPLETE` | complete, but no legible date |
| `R-DATE-FUTURE` | completion date after 2026-08-17 |
| `R-GEO-KEY` | city, state, or region cannot be established |
| `R-ENUM` | a value would require inventing a category/region/status |
| `R-PLACEHOLDER` | a placeholder sentinel survived into a field |

**Skipped-folder table in the summary** — every folder you did not extract, with one reason from: `not-a-job-folder`, `no-completion-evidence`, `still-active`, `completed-before-window`, `already-in-atlas`, `access-denied`, `empty`, `non-Kalb`, `queued-for-review`. A silently discarded job is indistinguishable from a job Kalb never had.

**Summary also reports:** folders walked, records emitted, records queued, evidence-tier histogram, new enum values encountered (cities, categories, teams), total ambiguities, and any folder where OCR was required and unreliable.

---

## 9. Worked example

*Illustrative only — not real Kalb data.*

```json
[
  {
    "project": {
      "id": "24118",
      "number": "24118",
      "name": "Craig Road Medical Office",
      "address": "3820 W. Craig Rd.",
      "city": "North Las Vegas",
      "state": "NV",
      "region": "LV",
      "category": "Medical",
      "projectType": "GU Medical",
      "team": "rp",
      "superintendent": "MC",
      "status": "Complete",
      "progress": 100,
      "estCompletion": "04/18/2025",
      "estCompletionDate": "2025-04-18",
      "sqFt": 12400,
      "year": 2024,
      "featured": false,
      "description": "GU Medical · 12,400 sf in North Las Vegas. Completed 04/18/2025.",
      "heroImage": null,
      "flags": ["Superintendent unverified"]
    },
    "source": {
      "folder": "U:\\KIJOBS\\24118 Craig Road Medical Office",
      "completionTier": "A",
      "completionEvidence": {
        "document": "Permits\\CofO 24118 signed.pdf",
        "type": "Certificate of Occupancy",
        "date": "2025-04-18",
        "page": 1
      },
      "photoFolder": "U:\\KIJOBS\\24118 Craig Road Medical Office\\Photos",
      "documentsRead": [
        "Contracts\\Owner Agreement executed.pdf",
        "Permits\\CofO 24118 signed.pdf",
        "Closeout\\G704 Substantial Completion.pdf",
        "Drawings\\A0.0 Cover.pdf"
      ],
      "provenance": {
        "id":                { "mode": "DERIVED", "rule": "id-equals-number" },
        "number":            { "mode": "READ", "document": "Contracts\\Owner Agreement executed.pdf", "detail": "cover, Job No." },
        "name":              { "mode": "READ", "document": "Contracts\\Owner Agreement executed.pdf", "detail": "cover, Project" },
        "address":           { "mode": "READ", "document": "Permits\\CofO 24118 signed.pdf", "detail": "site address line" },
        "city":              { "mode": "READ", "document": "Permits\\CofO 24118 signed.pdf", "detail": "site address line" },
        "state":             { "mode": "READ", "document": "Permits\\CofO 24118 signed.pdf", "detail": "site address line" },
        "region":            { "mode": "DERIVED", "rule": "city-region-table" },
        "category":          { "mode": "READ", "document": "Contracts\\Owner Agreement executed.pdf", "detail": "scope of work — medical office building" },
        "projectType":       { "mode": "READ", "document": "Contracts\\Owner Agreement executed.pdf", "detail": "scope of work" },
        "team":              { "mode": "READ", "document": "Closeout\\G704 Substantial Completion.pdf", "detail": "contractor rep block" },
        "superintendent":    { "mode": "READ", "document": "Closeout\\Punch list signoff.pdf", "detail": "signature block initials" },
        "status":            { "mode": "CONSTANT" },
        "progress":          { "mode": "DERIVED", "rule": "complete-implies-100" },
        "estCompletion":     { "mode": "READ", "document": "Permits\\CofO 24118 signed.pdf", "detail": "issue date" },
        "estCompletionDate": { "mode": "DERIVED", "rule": "date-normalise" },
        "sqFt":              { "mode": "READ", "document": "Drawings\\A0.0 Cover.pdf", "detail": "title block, building area" },
        "year":              { "mode": "DERIVED", "rule": "year-from-number" },
        "featured":          { "mode": "CONSTANT" },
        "description":       { "mode": "DERIVED", "rule": "description-template" },
        "heroImage":         { "mode": "CONSTANT" },
        "flags":             { "mode": "DERIVED", "rule": "flag-from-ambiguity" }
      },
      "missing": ["lat", "lng"],
      "ambiguities": [
        {
          "field": "superintendent",
          "candidates": [
            { "value": "MC", "source": "Closeout\\Punch list signoff.pdf", "tier": "C" },
            { "value": "M. Cruz", "source": "Correspondence\\2025-02 weekly.pdf", "tier": "C" }
          ],
          "whyUnresolved": "Initials vs. full name; cannot confirm they are the same person",
          "questionForKalb": "Is MC on 24118 M. Cruz? Which form should the wall show?"
        }
      ]
    }
  }
]
```

Note what this example does **not** do: it does not geocode `3820 W. Craig Rd.`, it does not pick between `MC` and `M. Cruz`, and it does not write a sentence about the project that isn't assembled from its own fields.

---

## 10. Per-project checklist

Run this on every folder before emitting. Any unticked line means review queue or `missing` — never a filled-in guess.

```
[ ] Folder is a real Kalb job folder (not template/admin/personal)
[ ] Job number read from a document, emitted as a QUOTED string
[ ] year = 2000 + first two digits of the number (omit for B-jobs)
[ ] address taken from the owner contract (permit only as cross-check/fallback)
[ ] id = number, matches ^[A-Za-z0-9][A-Za-z0-9-]*$, collides with nothing in §7 or the batch
[ ] Completion evidence located; tier (A/B/C) and document path recorded
[ ] Completion date read off the document — not a file timestamp, not a folder name
[ ] Date falls inside 2024-01-01 … 2026-08-17
[ ] city spelled exactly as §7 (or reported as a new city); state is 2 letters; region from the table
[ ] category is one of the 11 allowed values — or omitted + flagged
[ ] lat/lng omitted unless read from a document (no geocoding)
[ ] No placeholder sentinels; no nulls except heroImage (and superintendent)
[ ] Only Project-interface keys inside `project`; everything else in `source`
[ ] provenance entry present for EVERY key emitted; every DERIVED names its rule
[ ] `missing` lists every field you could not source; `ambiguities` lists every conflict
[ ] description assembled from this record's own fields only
[ ] featured=false, heroImage=null, status="Complete", progress=100
[ ] Nothing was written, renamed, moved, or locked on U:\
```

---

## 11. When you're done

Report back with: the three local file paths; folders walked / records emitted / records queued; the evidence-tier histogram; the full ambiguity list; the skipped-folders table; and any new city, category, or team value you encountered. Flag anything about the share's structure that made the walk unreliable. Do not merge anything into the atlas — that step is a human's.