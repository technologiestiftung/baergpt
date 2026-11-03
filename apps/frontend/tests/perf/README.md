# Frontend context stress test

Measures how the chat UI copes with large prompts, long answers and long
conversations. Not part of `test:e2e`.

`context-stress.spec.ts` replaces `fetch` for `/llm/just-chatting` with a
stream that sends ~4 tokens every 20 ms (~200 tokens/s). Playwright's
`route.fulfill` cannot be used, because it delivers the whole body at once.
Prompts are pasted through the clipboard: `locator.fill` takes ~13 s for
250 KB of text, even in a bare `<textarea>`, while a real paste takes ~0.2 s.
Token counts use `cl100k_base`.

## Run

Use a production build. React's development build is much slower.

```sh
npx vite build --outDir /tmp/baergpt-dist
npx vite preview --port 4173 --outDir /tmp/baergpt-dist
VITE_PORT=4173 npx playwright test tests/perf --project=chromium --workers=1
```

Run one scenario with `STRESS_ONLY=prompt-128000`. Results are written to
`test-results/perf/<scenario>.json`.

## Metrics

| Metric     | Meaning                                                           |
| ---------- | ----------------------------------------------------------------- |
| Slowdown   | Time to render the stream ÷ time the stream needs. 1.0 = no lag.  |
| Max freeze | Longest gap between two frames. Above ~100 ms the UI feels stuck. |
| Blocking   | Sum of long-task time above 50 ms while the answer streams.       |
| Heap       | Used JS heap after the answer.                                    |

Recording starts at send, so pasting is not counted.

## Results (2026-11-03, Chromium, Apple Silicon Mac)

Limits from the backend (`apps/backend/src/constants.ts`): answers stop at
8,192 tokens, or 24,576 with extended thinking. GLM 5.3 has a 1M-token context
window.

### Before and after the render fix

Every streamed token used to re-render all messages and re-parse their
markdown, including a large pasted prompt. Now only the streaming message
re-renders (`updateMessage` replaces the message object, `ChatMessage` is
memoized).

| Scenario           | Slowdown before → after | Blocking before → after |
| ------------------ | ----------------------- | ----------------------- |
| Prompt 8k tokens   | 1.20× → 1.07×           | 22 ms → 0 ms            |
| Prompt 32k tokens  | 3.81× → 1.07×           | 2.9 s → 0.06 s          |
| Prompt 64k tokens  | 7.81× → 1.07×           | 23.4 s → 0.13 s         |
| Prompt 128k tokens | 16.1× → 1.11×           | 65.8 s → 0.33 s         |
| 20 earlier turns   | 1.34× → 1.07×           | 23 ms → 0 ms            |

### Limits after the fix

Answer length, short prompt:

| Answer tokens | Slowdown | Max freeze | Heap   |
| ------------- | -------- | ---------- | ------ |
| 1,000         | 1.06×    | 17 ms      | 26 MB  |
| 8,192         | 1.07×    | 59 ms      | 40 MB  |
| 16,000        | 1.13×    | 91 ms      | 111 MB |
| 24,576        | 1.45×    | 221 ms     | 48 MB  |

Pasted prompt, 1k-token answer:

| Prompt tokens | Paste  | Send → shown | Slowdown | Max freeze | Heap   |
| ------------- | ------ | ------------ | -------- | ---------- | ------ |
| 8,000         | 0.03 s | 0.3 s        | 1.07×    | 33 ms      | 48 MB  |
| 32,000        | 0.08 s | 0.3 s        | 1.07×    | 108 ms     | 26 MB  |
| 128,000       | 0.2 s  | 0.7 s        | 1.10×    | 404 ms     | 98 MB  |
| 256,000       | 0.4 s  | 1.2 s        | 1.10×    | 725 ms     | 78 MB  |
| 512,000       | 0.7 s  | 2.7 s        | 1.20×    | 1.7 s      | 190 MB |
| 1,000,000     | 1.4 s  | 6.5 s        | 2.68×    | 4.4 s      | 631 MB |

Conversation history of 8,192-token answers, 1k-token answer:

| Earlier turns (≈ tokens) | Slowdown | Max freeze | Heap   |
| ------------------------ | -------- | ---------- | ------ |
| 10 (≈ 80k)               | 1.07×    | 17 ms      | 43 MB  |
| 30 (≈ 250k)              | 1.10×    | 49 ms      | 87 MB  |
| 60 (≈ 490k)              | 1.20×    | 142 ms     | 133 MB |
| 120 (≈ 1M)               | 1.58×    | 391 ms     | 215 MB |

### Takeaways

- Up to ~256k tokens of input and 8,192 tokens of output, the UI stays smooth.
- Near the 1M-token context window, sending freezes the page for seconds and
  uses ~600 MB of heap.
- Long answers are the remaining bottleneck: the streaming message is still
  re-parsed in full on every token. Throttling updates to one per frame would
  likely fix this.
- Not covered: reasoning traces (extended thinking streams them separately),
  slower machines (try Chrome CPU throttling), Firefox and Safari.
