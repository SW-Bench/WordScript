// WordScript Overlay Pin — force the overlay window onto KWin's OverlayLayer.
//
// Background: on KDE Plasma 6 / Wayland, `alwaysOnTop` (EWMH /
// gtk_window_set_keep_above) is compositor policy and KWin ignores it for
// xdg_toplevel clients. The only reliable always-on-top path on Wayland is to
// place the window on KWin's OverlayLayer (above fullscreen), which is only
// reachable via the KWin scripting API. See docs/STATUS.md ("Linux Wayland –
// Overlay Click-Through nicht loesbar") and docs/handoffs/OVERLAY_LINUX_BLACK_BLOCK_HANDOFF.md.
//
// Match: a WordScript window WITH skipTaskbar — that is the transparent overlay
// only. The Settings and Diagnostics windows keep their normal layer.
//
// `client.layer` may be read-only on some KWin 6 builds; the try/catch keeps the
// script safe and falls back to keepAbove (weaker, but still a stacking hint).

const WM_CLASS = "wordscript";

function pin(client) {
    const cls = (client.resourceClass || "").toLowerCase();
    if (cls !== WM_CLASS || !client.skipTaskbar) {
        return;
    }
    try {
        client.layer = 4; // KWin WindowLayer.OverlayLayer
    } catch (_) {
        // layer not settable on this KWin build — keepAbove is the fallback.
    }
    client.keepAbove = true;
}

workspace.windowAdded.connect(pin);

// Re-apply to already-existing windows (script reload / KWin reconfigure).
for (const client of workspace.windows) {
    pin(client);
}
