/**
 * Tiny Chrome DevTools Protocol driver for the project's browser checks. No npm dependency: it starts Chrome or Edge
 * headless and talks to it over Node's built-in WebSocket (Node 22+). Used by scripts/video-check.mjs.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function findBrowser() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const pf = process.env.ProgramFiles || "C:\\Program Files";
  const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const local = process.env.LOCALAPPDATA || "";
  return [
    `${pf}\\Google\\Chrome\\Application\\chrome.exe`, `${pf86}\\Google\\Chrome\\Application\\chrome.exe`, `${local}\\Google\\Chrome\\Application\\chrome.exe`,
    `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`, `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium",
  ].find((p) => p && fs.existsSync(p));
}

/** Starts a headless browser. `extraArgs` lets a check set e.g. --autoplay-policy. */
export async function startBrowser(extraArgs = []) {
  const exe = findBrowser();
  if (typeof WebSocket !== "function" || !exe) return null;
  const port = 9300 + Math.floor(Math.random() * 500);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "alyas-cdp-"));
  const proc = spawn(exe, [
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-extensions",
    "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--hide-scrollbars", "--mute-audio", ...extraArgs, "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; ; i++) {
    try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { if (i > 60) throw new Error("the browser did not start"); await sleep(250); }
  }
  const close = () => { try { proc.kill(); } catch {} setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} }, 800); };
  process.on("exit", close);

  async function newPage() {
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    const pending = new Map(), handlers = new Map();
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && pending.has(d.id)) { const { res, rej } = pending.get(d.id); pending.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); }
      else if (d.method) (handlers.get(d.method) || []).forEach((h) => h(d.params));
    };
    const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
    const on = (ev, fn) => handlers.set(ev, [...(handlers.get(ev) || []), fn]);
    const evaluate = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "evaluate failed");
      return r.result.value;
    };
    /** A real user tap: touch (phone) or mouse click at page coordinates. */
    const tap = async (x, y, touch) => {
      if (touch) {
        await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
        await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      } else {
        await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
        await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
      }
    };
    const close = async () => { try { ws.close(); await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`); } catch {} };
    return { send, on, evaluate, tap, close };
  }
  return { exe, newPage, close };
}
