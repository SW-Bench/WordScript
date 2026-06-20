// Hide the extra terminal window on Windows outside debug builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Linux backend selection (see handoff OVERLAY_LINUX_BLACK_BLOCK_HANDOFF.md).
    // DEFAULT = XWayland (GDK_BACKEND=x11). Rationale: docs/STATUS.md:108 documents
    // that on native Wayland `startDragging`/`setPosition` are unreliable for the
    // overlay window (xdg_toplevel.move / Compositor-ownership) — drag regressed
    // when the default was switched to native Wayland. XWayland keeps drag working.
    // The black-block bug is handled by the shadow fix (overlay-pill.css) on both
    // backends, so XWayland is safe again. Opt into native Wayland for testing via
    // WORDSCRIPT_NATIVE_WAYLAND=1 (skips the GDK_BACKEND/WAYLAND_DISPLAY override).
    #[cfg(target_os = "linux")]
    {
        unsafe {
            let native_wayland = std::env::var_os("WORDSCRIPT_NATIVE_WAYLAND").is_some();
            if !native_wayland {
                std::env::set_var("GDK_BACKEND", "x11");
                // WebKitGTK also reads WAYLAND_DISPLAY directly — hide it so it
                // falls back to X11.
                if let Ok(wayland_display) = std::env::var("WAYLAND_DISPLAY") {
                    std::env::set_var("WORDSCRIPT_WAS_WAYLAND", "1");
                    std::env::set_var("WORDSCRIPT_WAYLAND_DISPLAY", wayland_display);
                    std::env::remove_var("WAYLAND_DISPLAY");
                }
            }

            // Transparent, undecorated overlay windows only composite correctly on
            // Linux/WebKitGTK when the GPU compositor is OFF. With compositing ON +
            // DMABUF disabled (the previous default), WebKitGTK on Nvidia hybrid GPUs
            // paints the rounded/transparent areas of the window solid black — the
            // overlay pill's soft box-shadow turns into an opaque dark block
            // (tauri-apps/tauri#14924, "rounded corners become solid black squares").
            // Disabling the GPU compositor falls back to the cairo path, which honours
            // per-pixel alpha; the earliest working build (cc94f19) used exactly this.
            // Cost: no GPU-accelerated webview compositing — negligible for a tiny
            // overlay plus a static settings UI. Opt back into GPU compositing on
            // hardware where it works via WORDSCRIPT_ENABLE_WEBKIT_COMPOSITING.
            if std::env::var_os("WORDSCRIPT_ENABLE_WEBKIT_COMPOSITING").is_some() {
                std::env::remove_var("WEBKIT_DISABLE_COMPOSITING_MODE");
                // DMA-BUF renderer breaks larger XWayland webviews on some setups
                // (`Failed to create GBM buffer ...`); keep it off while compositing on.
                std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
            } else {
                std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
            }
        }
    }

    wordscript_lib::run();
}
