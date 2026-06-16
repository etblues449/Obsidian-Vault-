/*
 * jarvis_setup.js — one-time secret setup (QuickAdd user script)
 * --------------------------------------------------------------
 * Stores secrets in DEVICE-LOCAL storage (window.localStorage). These never
 * touch the vault, never sync, never get committed — satisfying the vault's
 * "never write secrets into notes" rule. Run this once per device (phone, PC).
 *
 * Re-run any time to rotate a key. Leave a prompt blank to keep the current
 * value.
 */
module.exports = async (params) => {
  const { quickAddApi } = params;
  const { Notice } = require("obsidian");

  const ask = async (label, key, hint) => {
    const current = window.localStorage.getItem(key);
    const shown = current ? " (set — blank to keep)" : "";
    const val = await quickAddApi.inputPrompt(label + shown, hint || "");
    if (val && val.trim()) window.localStorage.setItem(key, val.trim());
  };

  await ask("Anthropic API key", "jarvis-anthropic-key", "sk-ant-...");
  await ask("Home Assistant URL", "jarvis-ha-url", "http://192.168.0.200:8123");
  await ask("Home Assistant token", "jarvis-ha-token", "long-lived access token");

  const have = [
    window.localStorage.getItem("jarvis-anthropic-key") ? "API key ✓" : "API key ✗",
    window.localStorage.getItem("jarvis-ha-url") ? "HA url ✓" : "HA url ✗",
    window.localStorage.getItem("jarvis-ha-token") ? "HA token ✓" : "HA token ✗",
  ].join("  ·  ");
  new Notice("JARVIS setup saved on this device — " + have, 8000);
};
