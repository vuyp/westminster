// Dev: trainTest with only the standing 1996 TS (for per-train draw-call / triangle accounting in the harness).
import { build as buildAll } from './trainTest.js';
export function build(ctx) { ctx.__trainTestOnly = '1996'; return buildAll(ctx); }
