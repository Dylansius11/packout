# PACKOUT: Lessons

Read the headlines before starting work. Format: `### YYYY-MM-DD: headline`, then what happened, root cause, rule going forward. Newest on top.

### 2026-10-23: The Portaldot mapped account can be computed, no console needed
- What happened: funding an EVM key needs the native `5…` address mapped to it. The guide only shows the node console runtime call.
- Root cause: with `AutoMap = true`, `reviveApi.accountId(h160)` returns the H160 followed by twelve `0xEE` bytes. Encoding that as SS58 with prefix 42 reproduces the guide's own example exactly.
- Rule: compute mapped addresses in code (`ss58(42, h160 ‖ 0xEE×12)`), and still confirm funding with `eth_getBalance` before any deploy.
