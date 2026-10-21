# Evidence: cheatsheets/inference-optimization.md

Abbreviations: A = phases/07-transformers-deep-dive/12-kv-cache-flash-attention/code, B = phases/10-llms-from-scratch/11-quantization/code, C = phases/17-infrastructure-and-production/04-vllm-serving-internals/code, D = phases/10-llms-from-scratch/12-inference-optimization/code, E = phases/10-llms-from-scratch/12-inference-optimization/outputs.

## Architecture: Inference path (architecture, 6 nodes)
- Request, prompt and output lengths: C/main.py:32-33
- Scheduler, admit on free blocks: C/main.py:133-136
- Prefill, prompt slices: C/main.py:147-151
- KV cache, K and V per layer: D/main.py:21-25
- Decode, one token per request: C/main.py:155-156
- Quantized weights, scale and round: B/main.py:82-90

## One decode step (flow, 5 steps)
- Scheduler admits when free blocks fit: C/main.py:133-136
- Prefill slices by chunk size: C/main.py:147-151
- Cache append stores K and V: A/main.py:93
- Attention scores and softmax: A/main.py:26-27, 94
- Release frees finished blocks: C/main.py:170-173

## Cached decode loop (annotated-code, 5 lines)
- Loop over queries, K and V: A/main.py:92
- Append K and V to the cache: A/main.py:93
- Attend over the cache: A/main.py:94
- Cost grows with cache length: A/main.py:95
- Collect outputs: A/main.py:96

## Run the code (task-table, 7 rows)
- decode_naive: A/main.py:72
- decode_cached: A/main.py:87
- tiled_softmax_dot: A/main.py:35
- kv_cache_bytes: A/main.py:100
- quantize_symmetric: B/main.py:82
- quantize_per_channel: B/main.py:97
- simulate_continuous: C/main.py:123

## Default settings (defaults, 6 rows)
- dtype 2: A/main.py:100
- tile 4: A/main.py:35
- num_bits 8: B/main.py:82
- CHUNK_SIZE 512: C/main.py:24
- KV_BLOCK_SIZE 16: C/main.py:25
- KV_BLOCKS_AVAILABLE 1800: C/main.py:26

## Static vs continuous batching (comparison, 4 rows)
- Output length, static pads to max output: C/main.py:106 (static); C/main.py:170-173 (continuous)
- Admission, static fixed windows: C/main.py:101-103 (static); C/main.py:133-136 (continuous)
- Finished requests, static kept to window end: C/main.py:115-119 (static); C/main.py:170-173 (continuous)
- Prefill, static pads prompt, continuous chunked: C/main.py:105 (static); C/main.py:149 (continuous)

## Key formulas (concepts, 3)
- KV bytes formula: A/main.py:102
- Quantization scale: B/main.py:88
- Rounding and clipping: B/main.py:89

## Troubleshooting (troubleshooting, 4 rows)
- Decode at batch 1 is memory-bound: E/skill-inference-optimization.md:66
- Contiguous KV blocks waste memory: E/skill-inference-optimization.md:67
- Only throughput measured: E/skill-inference-optimization.md:70
- High temperature lowers acceptance: E/skill-inference-optimization.md:71

## Glossary (glossary, 4)
- KV block size constant: C/main.py:25
- Chunk size constant: C/main.py:24
- Naive decode recomputes prefix: A/main.py:73
- Continuous batching admits and releases each step: C/main.py:123

## Questions (qa, 3)
- Cached decode reuses K and V: A/main.py:93-94
- Naive op count N(N+1)/2: A/main.py:74
- Each prefill step takes at most chunk size: C/main.py:149

## Tips (tips, 3)
- Draft model 5-10x smaller: E/skill-inference-optimization.md:58
- Acceptance above 70%: E/skill-inference-optimization.md:59
- EAGLE, then draft-target, then n-gram: E/skill-inference-optimization.md:62
