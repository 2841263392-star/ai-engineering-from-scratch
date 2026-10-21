---
id: inference-optimization
title: Inference Optimization: KV Cache, Quantization, Batching
code: IO
subtitle: KV cache, quantization and batching: where decode time goes and how to cut it.
hue: 200
sources: phases/07-transformers-deep-dive/12-kv-cache-flash-attention, phases/10-llms-from-scratch/11-quantization, phases/10-llms-from-scratch/12-inference-optimization, phases/17-infrastructure-and-production/04-vllm-serving-internals, phases/17-infrastructure-and-production/05-eagle3-speculative-decoding, phases/17-infrastructure-and-production/08-inference-metrics-goodput, phases/17-infrastructure-and-production/09-production-quantization
source_hash: 8b5a735e414be091
---

## Inference path
type: architecture
from: phases/17-infrastructure-and-production/04-vllm-serving-internals/code/main.py, phases/10-llms-from-scratch/12-inference-optimization/code/main.py, phases/10-llms-from-scratch/11-quantization/code/main.py, phases/07-transformers-deep-dive/12-kv-cache-flash-attention/code/main.py

```arch
node | req | 1,1 | Request | prompt and output lengths | client
node | sched | 1,2 | Scheduler | admit on free blocks | queue
node | pre | 2,1 | Prefill | prompt slices | process
node | kv | 3,1 | KV cache | K and V per layer | store
node | dec | 2,2 | Decode | one token per request | process
node | qw | 3,2 | Quantized weights | scale and round | model
edge | req | sched | queue
edge | sched | pre | admit
edge | pre | kv | write
edge | kv | dec | read K and V
edge | sched | dec | batch
edge | qw | dec | weights
```

## One decode step
type: flow
from: phases/17-infrastructure-and-production/04-vllm-serving-internals/code/main.py, phases/07-transformers-deep-dive/12-kv-cache-flash-attention/code/main.py

1. **Scheduler**: admits a waiting request when free blocks fit.
2. **Prefill**: processes the prompt in slices of `CHUNK_SIZE` tokens.
3. **Cache append**: stores the new K and V for this step.
4. **Attention**: scores the query against the cache, then applies softmax.
5. **Release**: frees the blocks of finished requests.

## Cached decode loop
type: annotated-code
lang: python
from: phases/07-transformers-deep-dive/12-kv-cache-flash-attention/code/main.py

```python
for q, k, v in zip(all_queries, all_K, all_V):
    cache.append(k, v)  # store this step's K and V
    out = attention_full(q, cache.K, cache.V)  # attend over the cache
    ops += len(cache)  # cost grows with cache length
    outputs.append(out)
```

## Run the code
type: task-table
from: phases/07-transformers-deep-dive/12-kv-cache-flash-attention/code/main.py, phases/10-llms-from-scratch/11-quantization/code/main.py, phases/17-infrastructure-and-production/04-vllm-serving-internals/code/main.py

| Task | Code |
|---|---|
| Naive decode, recomputes the prefix | `decode_naive(all_K, all_V, all_queries)` |
| Cached decode, appends K and V | `decode_cached(all_K, all_V, all_queries)` |
| Tiled softmax, Flash style | `tiled_softmax_dot(q, Ks, Vs, tile=4)` |
| KV cache bytes | `kv_cache_bytes(N, n_layers, n_heads_kv, d_head, dtype=2)` |
| Symmetric quantize | `quantize_symmetric(tensor, num_bits=8)` |
| Per-channel quantize | `quantize_per_channel(tensor, num_bits=8, axis=0)` |
| Continuous batching sim | `simulate_continuous(reqs, chunked)` |

## Default settings
type: defaults
from: phases/07-transformers-deep-dive/12-kv-cache-flash-attention/code/main.py, phases/10-llms-from-scratch/11-quantization/code/main.py, phases/17-infrastructure-and-production/04-vllm-serving-internals/code/main.py

| Setting | Default | Note |
|---|---|---|
| `dtype` | 2 | Bytes per element for fp16 or bf16 |
| `tile` | 4 | Tokens per tile in the Flash style loop |
| `num_bits` | 8 | Bits in symmetric quantization |
| `CHUNK_SIZE` | 512 | Prompt tokens per prefill slice |
| `KV_BLOCK_SIZE` | 16 | Tokens per KV block |
| `KV_BLOCKS_AVAILABLE` | 1800 | Toy KV block budget |

## Static vs continuous batching
type: comparison
from: phases/17-infrastructure-and-production/04-vllm-serving-internals/code/main.py

| Factor | Static | Continuous |
|---|---|---|
| Output length | Padded to the longest in the window | Each request ends at its own length |
| Admission | Fixed windows of the batch size | When free blocks fit |
| Finished requests | Kept until the window ends | Released each step |
| Prefill | Padded to the longest prompt | Sliced by the chunk size |

## Key formulas
type: concepts
from: phases/07-transformers-deep-dive/12-kv-cache-flash-attention/code/main.py, phases/10-llms-from-scratch/11-quantization/code/main.py

- **KV bytes**: `2 * N * n_layers * n_heads_kv * d_head * dtype` gives the cache size for N tokens.
- **Quantization scale**: `scale = abs_max / qmax` maps the largest weight to the top integer.
- **Rounding**: `np.clip(np.round(tensor / scale), qmin, qmax)` stores each weight as an integer.

## Troubleshooting
type: troubleshooting
from: phases/10-llms-from-scratch/12-inference-optimization/outputs/skill-inference-optimization.md

| Symptom | Cause | Fix |
|---|---|---|
| GPU mostly idle during decode | Decode at batch 1 is memory-bound | Raise batch size with continuous batching |
| KV memory wasted | Contiguous KV blocks | Use paged KV blocks |
| Fast tokens but slow responses | Only throughput was measured | Measure latency too |
| Speculative decoding slows down | High temperature lowers acceptance | Use low temperature |

## Glossary
type: glossary
from: phases/07-transformers-deep-dive/12-kv-cache-flash-attention/code/main.py, phases/17-infrastructure-and-production/04-vllm-serving-internals/code/main.py

- **KV block**: fixed number of tokens held by one cache block.
- **Chunk**: prompt tokens taken in one prefill step.
- **Naive decode**: recomputes attention over the full prefix at each step.
- **Continuous batching**: admits and releases requests at every step.

## Questions
type: qa
from: phases/07-transformers-deep-dive/12-kv-cache-flash-attention/code/main.py, phases/17-infrastructure-and-production/04-vllm-serving-internals/code/main.py

- **Why is cached decode faster?** It appends one K and V and reuses the rest.
- **Why does naive decode cost grow fast?** Its op count is N(N+1)/2.
- **Why slice the prefill?** Each step takes at most `CHUNK_SIZE` prompt tokens.

## Tips
type: tips
from: phases/10-llms-from-scratch/12-inference-optimization/outputs/skill-inference-optimization.md

- Use a draft model 5-10x smaller than the target.
- Aim for acceptance above 70%.
- Prefer EAGLE, then draft-target, then n-gram.
