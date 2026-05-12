// Hide the extra terminal window on Windows outside debug builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Force X11/XWayland on Linux to avoid Wayland Gdk Error 71 crashes
    // (transparent/decorationless overlay + WebKitGTK bugs on native Wayland)
    #[cfg(target_os = "linux")]
    {
        unsafe {
            std::env::set_var("GDK_BACKEND", "x11");
            // WebKitGTK's DMA-BUF renderer breaks larger XWayland webviews on some Linux setups
            // with `Failed to create GBM buffer ...`. Keep compositing on, but disable that path.
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
            // Keep compositing enabled by default so transparent overlay windows stay transparent.
            // If a specific Linux setup still needs the older compatibility path, allow opting back in.
            if std::env::var_os("WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING").is_some() {
                std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
            } else {
                std::env::remove_var("WEBKIT_DISABLE_COMPOSITING_MODE");
            }
            // WebKitGTK also reads WAYLAND_DISPLAY directly — hide it so it falls back to X11
            if let Ok(wayland_display) = std::env::var("WAYLAND_DISPLAY") {
                std::env::set_var("WORDSCRIPT_WAS_WAYLAND", "1");
                std::env::set_var("WORDSCRIPT_WAYLAND_DISPLAY", wayland_display);
                std::env::remove_var("WAYLAND_DISPLAY");
            }
        }
    }

    wordscript_lib::run();
}
