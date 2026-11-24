# AI Source Matrix

## Purpose

Define how every supported AI-related information source is represented. The goal is honest visibility, not guessed precision.

## Confidence labels

| Label | Meaning |
|---|---|
| `reported` | The provider or SDK explicitly returned the value. |
| `estimated` | The value was derived by a local heuristic. It is never presented as provider billing truth. |
| `unknown` | No trustworthy value is available. The UI must show this explicitly. |

## Source matrix

| Source | Access mode | Default | Confidence | Notes |
|---|---|---|---|---|
| Anthropic API response | Caller supplies response object | On when used | `reported` | Reads `usage.input_tokens`, `usage.output_tokens`, `usage.cache_read_input_tokens`, and cache creation fields. No API call by this project. |
| OpenAI API response | Caller supplies response object | On when used | `reported` | Reads `usage.prompt_tokens`, `usage.completion_tokens`, `total_tokens`, and detail buckets. Cached tokens are separated from input. |
| OpenTelemetry GenAI | Attributes in imported spans | On when imported | `reported` | Reads `gen_ai.usage.*`, `gen_ai.provider.name`, and request/response model attributes. |
| OpenInference | Attributes in imported spans | On when imported | `reported` | Reads `llm.token_count.*` and `llm.model_name`. |
| LangChain callback | Caller supplies callback metadata | On when used | `reported` | Reads provider usage when the callback contains it. |
| Explicit SDK event | `trace()` / `trackUsage()` | On when used | `reported` | Caller states the source and values. |
| Manual import | JSON/NDJSON supplied by user | On when supplied | `reported` | The value is trusted as user-entered, not vendor-verified. |
| Claude Code local transcript | Local file reader | **Off** | `reported` | Requires explicit opt-in, consent record, strict redaction, and source path allowlist. Never enabled by default. |
| claude.ai Web | Manual export or pasted data | **Off** | `reported` / `unknown` | No credentials, scraping, or browser automation. If no export is supplied, show `unknown`. |
| Local heuristic estimate | Text/message length | **Off** | `estimated` | Available for investigation only. Must be labelled and excluded from billing totals by default. |
| External AI explanation | Optional adapter | **Off** | n/a | Requires explicit consent and a caller-supplied transport. This project makes no external AI call by default. |

## Privacy rules for all sources

- No raw prompt, tool argument, transcript line, file path, token, or API key is stored by the usage ledger.
- Provider/model names are kept because they are needed for cost interpretation.
- Redaction counters are stored as counts only, never values.
- Claude Code and claude.ai sources require a consent record before ingestion.
- Any source outside the matrix is normalized as `unknown`, not guessed.

## Relationship to existing branches

`origin/feat/instrument-token-usage` contains an earlier word-count based token logger. It was reviewed but is not merged as-is because:

1. It labels estimated values as token counts without a `reported`/`estimated`/`unknown` distinction.
2. It writes a raw JSONL file under `logs/`.
3. It has no redaction or consent policy.

Its intent is preserved here through the explicit `estimated` path.
