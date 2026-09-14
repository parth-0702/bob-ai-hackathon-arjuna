# SambaNova integration

The user explicitly authorized SambaNova as an alternative to the previous Bob-only constraint. SambaNova is now selected with `LLM_PROVIDER=sambanova`. Bob remains an optional separate adapter; no credential or request is silently forwarded between providers.

## Configuration

In `src/backend/.env`:

```dotenv
LLM_PROVIDER=sambanova
SAMBANOVA_API_KEY=
SAMBANOVA_MODEL=Meta-Llama-3.3-70B-Instruct
```

Paste the real SambaNova key locally and restart the backend. Do not put a SambaNova key into `BOB_API_KEY`. The documented endpoint is `https://api.sambanova.ai/v1/chat/completions`, using Bearer authentication and JSON output mode. No extra dependency is needed; the existing HTTP client sends the request.

Llama 3.3 70B Instruct is the initial model because it is listed as a production model and supports the structured output required here. This is a starting choice, not a benchmark claim that it is best for all port problems.

## Responsibility and UI

In Approvals, **Explain with AI** sends the report's backend facts to the chosen provider. The model selects relevant facts and their order. The backend validates identifiers, preserves the recommendation/human-authority/limitations facts, and renders exact source text. It does not yet generate arbitrary new operational interventions. Deterministic engines still evaluate and rank available responses. Existing approval and audit behavior remains intact.

Settings identifies the provider, model and configuration/last request status. Until a successful provider response, configuration is not treated as verification. Failures return clearly labeled backend explanations. Changing providers does not relabel a historical explanation as output from the new provider.

## Validation

14 backend tests pass after this change, including mocked SambaNova authentication, exact request/context, grounded responses, authentication failures and missing-key isolation. TypeScript validation passes. Real requests were attempted with the saved SambaNova key. The application request returned HTTP 429; a minimal direct diagnostic returned HTTP 402 with PAYMENT_METHOD_REQUIRED. No successful model completion has been verified. The account requires a payment method according to the provider response. The app preserves a labeled deterministic fallback.

## Sources

- [Production models](https://docs.sambanova.ai/docs/en/models/sambacloud-models)
- [Quickstart and authentication](https://docs.sambanova.ai/docs/en/get-started/quickstart)
- [JSON output support](https://docs.sambanova.ai/docs/en/features/function-calling)
