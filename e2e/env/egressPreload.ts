// `node --import tsx --import ./e2e/env/egressPreload.ts <entry>`: loopback-only child process.
import { installEgressGuard } from "./egress.js";

installEgressGuard();
