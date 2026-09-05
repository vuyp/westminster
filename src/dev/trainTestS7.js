// Dev: trainTest with only the S7 (for per-train draw-call / triangle accounting in the harness).
import { build as buildAll } from './trainTest.js';
export function build(ctx) { ctx.__trainTestOnly = 's7'; return buildAll(ctx); }
