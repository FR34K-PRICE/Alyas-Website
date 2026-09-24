// Starts the production server on $PORT (Replit sets it) bound to all interfaces.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const port = process.env.PORT || "3000";
const child = spawn(process.execPath, [nextBin, "start", "-H", "0.0.0.0", "-p", port], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
