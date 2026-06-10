# Hotkey Cross-Platform Fix — Hand-Off Document

**Branch**: `easy-wins-hotkey-hygiene`  
**Status**: Implemented — 2026-06-10  
**Goal**: Replace `RegisterHotKey`-based hotkey detection with low-level hooks on all platforms so arbitrary key combos (including Win+\*, Cmd+\*, Super+\*) work reliably.

---

## Problem

The Windows default hotkey `ctrl_l+win+space` silently failed because `Win+Space` is reserved by Windows (input language switcher). `RegisterHotKey` cannot intercept OS-reserved combos.

**Quick workaround already applied** (in two Rust files): changed default to `ctrl_l+alt_l+space`.

**Full fix needed**: Replace `RegisterHotKey` with `WH_KEYBOARD_LL` on Windows (equivalent of what AutoHotkey uses), and equivalent improvements on macOS and Linux.

---

## Files Already Modified

### `src-tauri/src/core/config.rs` — line ~583
```rust
// Windows branch: changed from "ctrl_l+win+space" → "ctrl_l+alt_l+space"
fn default_hotkey() -> String { ... }
```

### `src-tauri/src/core/trigger.rs` — line ~840
```rust
// Windows branch: changed from "ctrl_l+win+space" → "ctrl_l+alt_l+space"
fn default_hotkey() -> String { ... }
```

---

## Files to Rewrite (not yet done)

### 1. `vendor/global-hotkey/src/platform_impl/windows/mod.rs` — **PRIMARY TASK**

**Strategy**: Replace hidden-window + `RegisterHotKey` with `WH_KEYBOARD_LL` low-level keyboard hook.

**Architecture**:
- `GlobalHotKeyManager` becomes a unit struct (no HWND field, no Drop needed)
- One static `Lazy<Mutex<HashMap<u32, HotKey>>>` registry, shared across all manager instances
- One background thread (started via `OnceLock<()>`) installs the hook + runs Win32 message loop
- Hook callback uses `thread_local!` state (modifier tracking, active key ID, Win-key bleed flag)

**Imports needed** (all features already in `vendor/global-hotkey/Cargo.toml`):
```rust
use std::{cell::Cell, collections::HashMap};
use keyboard_types::{Code, Modifiers};
use once_cell::sync::{Lazy, OnceCell};
use windows_sys::Win32::{
    Foundation::{LPARAM, LRESULT, WPARAM},
    UI::{
        Input::KeyboardAndMouse::*,
        WindowsAndMessaging::{
            CallNextHookEx, DispatchMessageW, GetMessageW, SetWindowsHookExW,
            TranslateMessage, UnhookWindowsHookEx, WH_KEYBOARD_LL,
            KBDLLHOOKSTRUCT, MSG, WM_KEYDOWN, WM_KEYUP, WM_SYSKEYDOWN, WM_SYSKEYUP,
        },
    },
};
use crate::{hotkey::HotKey, GlobalHotKeyEvent, HotKeyState};
```

**Constants** (not exported by windows-sys, must define manually):
```rust
const LLKHF_INJECTED: u32 = 0x10;
```

**Static state**:
```rust
static HOTKEY_REGISTRY: Lazy<Mutex<HashMap<u32, HotKey>>> = Lazy::new(Default::default);
static HOOK_STARTED: OnceCell<()> = OnceCell::new();
```

**Thread-local state** (hook callback only runs on hook thread):
```rust
thread_local! {
    static MOD_STATE: Cell<Modifiers> = Cell::new(Modifiers::empty());
    static ACTIVE_ID:  Cell<Option<u32>> = Cell::new(None);
    static ACTIVE_VK:  Cell<u16> = Cell::new(0);
    static WIN_USED:   Cell<bool> = Cell::new(false);
}
```

**`GlobalHotKeyManager` impl**:
```rust
pub struct GlobalHotKeyManager;

impl GlobalHotKeyManager {
    pub fn new() -> crate::Result<Self> {
        ensure_hook_thread();
        Ok(Self)
    }
    pub fn register(&self, hotkey: HotKey) -> crate::Result<()> {
        if key_to_vk(&hotkey.key).is_none() {
            return Err(crate::Error::FailedToRegister(
                format!("Unknown VKCode for {}", hotkey.key)));
        }
        HOTKEY_REGISTRY.lock().unwrap().insert(hotkey.id(), hotkey);
        Ok(())
    }
    pub fn unregister(&self, hotkey: HotKey) -> crate::Result<()> {
        HOTKEY_REGISTRY.lock().unwrap().remove(&hotkey.id());
        Ok(())
    }
    pub fn register_all(&self, hotkeys: &[HotKey]) -> crate::Result<()> {
        for h in hotkeys { self.register(*h)?; }
        Ok(())
    }
    pub fn unregister_all(&self, hotkeys: &[HotKey]) -> crate::Result<()> {
        for h in hotkeys { self.unregister(*h)?; }
        Ok(())
    }
}
```

**Hook thread**:
```rust
fn ensure_hook_thread() {
    HOOK_STARTED.get_or_init(|| {
        std::thread::Builder::new()
            .name("global-hotkey-hook".into())
            .spawn(hook_thread_main)
            .expect("failed to spawn hotkey hook thread");
    });
}

fn hook_thread_main() {
    unsafe {
        let hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(ll_keyboard_proc), 0, 0);
        if hook == 0 {
            eprintln!("global-hotkey: failed to install WH_KEYBOARD_LL: {}",
                std::io::Error::last_os_error());
            return;
        }
        let mut msg: MSG = std::mem::zeroed();
        while GetMessageW(&mut msg, 0, 0, 0) > 0 {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
        UnhookWindowsHookEx(hook);
    }
}
```

**Hook callback**:
```rust
unsafe extern "system" fn ll_keyboard_proc(
    code: i32, wparam: WPARAM, lparam: LPARAM,
) -> LRESULT {
    if code < 0 {
        return CallNextHookEx(0, code, wparam, lparam);
    }
    let kb = &*(lparam as *const KBDLLHOOKSTRUCT);
    // Skip synthetic events (our own VK_F24 injections)
    if kb.flags & LLKHF_INJECTED != 0 {
        return CallNextHookEx(0, code, wparam, lparam);
    }
    let vk = kb.vkCode as u16;          // VIRTUAL_KEY = u16
    let is_down = wparam == WM_KEYDOWN as usize || wparam == WM_SYSKEYDOWN as usize;
    let is_up   = wparam == WM_KEYUP   as usize || wparam == WM_SYSKEYUP   as usize;

    // --- Modifier tracking ---
    if let Some(modifier) = vk_to_modifier(vk) {
        if is_down {
            MOD_STATE.with(|m| m.set(m.get() | modifier));
        } else if is_up {
            MOD_STATE.with(|m| { let mut v = m.get(); v.remove(modifier); m.set(v); });
            if modifier == Modifiers::SUPER {
                WIN_USED.with(|w| {
                    if w.get() { send_dummy_key(); w.set(false); }
                });
            }
        }
        return CallNextHookEx(0, code, wparam, lparam);
    }

    // --- Regular key down: check for hotkey match ---
    if is_down {
        let current_mods = MOD_STATE.with(|m| m.get());
        let event = HOTKEY_REGISTRY.try_lock().ok().and_then(|reg| {
            reg.iter().find_map(|(id, hotkey)| {
                key_to_vk(&hotkey.key)
                    .filter(|&hvk| hvk == vk && mods_match(hotkey.mods, current_mods))
                    .map(|_| (*id, hotkey.mods.intersects(Modifiers::SUPER | Modifiers::META)))
            })
        });
        if let Some((id, uses_win)) = event {
            ACTIVE_ID.with(|a| a.set(Some(id)));
            ACTIVE_VK.with(|a| a.set(vk));
            if uses_win { WIN_USED.with(|w| w.set(true)); }
            GlobalHotKeyEvent::send(GlobalHotKeyEvent { id, state: HotKeyState::Pressed });
            return 1;  // suppress key
        }
        return CallNextHookEx(0, code, wparam, lparam);
    }

    // --- Regular key up: fire Released if it was our hotkey ---
    if is_up {
        let maybe = ACTIVE_ID.with(|a| a.get()).zip(Some(ACTIVE_VK.with(|a| a.get())));
        if let Some((active_id, active_vk)) = maybe {
            if active_vk == vk {
                ACTIVE_ID.with(|a| a.set(None));
                ACTIVE_VK.with(|a| a.set(0));
                GlobalHotKeyEvent::send(GlobalHotKeyEvent {
                    id: active_id,
                    state: HotKeyState::Released,
                });
                return 1;  // suppress key-up of suppressed key
            }
        }
    }

    CallNextHookEx(0, code, wparam, lparam)
}
```

**Helper functions**:
```rust
// Inject VK_F24 down+up to prevent Start menu when Win key combo was used
fn send_dummy_key() {
    unsafe {
        let inputs = [
            INPUT { r#type: INPUT_KEYBOARD, Anonymous: INPUT_0 {
                ki: KEYBDINPUT { wVk: VK_F24, wScan: 0, dwFlags: 0, time: 0, dwExtraInfo: 0 }
            }},
            INPUT { r#type: INPUT_KEYBOARD, Anonymous: INPUT_0 {
                ki: KEYBDINPUT { wVk: VK_F24, wScan: 0, dwFlags: KEYEVENTF_KEYUP, time: 0, dwExtraInfo: 0 }
            }},
        ];
        SendInput(inputs.len() as u32, inputs.as_ptr(), std::mem::size_of::<INPUT>() as i32);
    }
}

// Normalize SUPER/META to same bit before comparing
fn mods_match(registered: Modifiers, current: Modifiers) -> bool {
    fn norm(m: Modifiers) -> Modifiers {
        let base = Modifiers::SHIFT | Modifiers::CONTROL | Modifiers::ALT | Modifiers::SUPER;
        let mut n = m;
        if n.contains(Modifiers::META) { n.remove(Modifiers::META); n.insert(Modifiers::SUPER); }
        n & base
    }
    norm(registered) == norm(current)
}

fn vk_to_modifier(vk: u16) -> Option<Modifiers> {
    match vk {
        v if v == VK_LCONTROL || v == VK_RCONTROL || v == VK_CONTROL => Some(Modifiers::CONTROL),
        v if v == VK_LMENU    || v == VK_RMENU    || v == VK_MENU    => Some(Modifiers::ALT),
        v if v == VK_LSHIFT   || v == VK_RSHIFT   || v == VK_SHIFT   => Some(Modifiers::SHIFT),
        v if v == VK_LWIN     || v == VK_RWIN                        => Some(Modifiers::SUPER),
        _ => None,
    }
}
```

**KEEP UNCHANGED**: The entire `key_to_vk(key: &Code) -> Option<VIRTUAL_KEY>` function (lines ~200–340 of current file). It maps all keyboard codes to Win32 VK constants. Copy it verbatim.

**REMOVE**: `encode_wide`, `get_instance_handle`, `global_hotkey_proc`, `HIWORD`, `Drop for GlobalHotKeyManager`.

---

### 2. `vendor/global-hotkey/src/platform_impl/macos/mod.rs` — **SECONDARY TASK**

**Strategy**: Add a second `CGEventTap` (separate from the existing media-key tap) as fallback for regular keys when `RegisterEventHotKey` fails for system-reserved combos.

**What to add to `GlobalHotKeyManager`**:
```rust
// New fields:
key_tap: Mutex<Option<CFMachPortRef>>,
key_tap_source: Mutex<Option<CFRunLoopSourceRef>>,
tap_hotkeys: Arc<Mutex<HashMap<u32, (HotKey, u32)>>>,  // id → (hotkey, scancode)
```

**Modified `register()` logic**:
```rust
pub fn register(&self, hotkey: HotKey) -> crate::Result<()> {
    // (existing media key path unchanged)

    // Try Carbon RegisterEventHotKey first
    let result = unsafe { RegisterEventHotKey(...) };
    if result == noErr {
        self.hotkeys.lock().unwrap().insert(hotkey.id(), HotKeyWrapper { ptr, hotkey });
        return Ok(());
    }

    // RegisterEventHotKey failed → try CGEventTap fallback
    if let Some(sc) = key_to_scancode(hotkey.key) {
        self.tap_hotkeys.lock().unwrap().insert(hotkey.id(), (hotkey, sc));
        self.ensure_key_tap()?;
        return Ok(());
    }

    // No scan code → real failure
    Err(crate::Error::OsError(std::io::Error::last_os_error()))
}
```

**`ensure_key_tap()`**: Creates the `CGEventTap` for `KeyDown` + `KeyUp` + `FlagsChanged` events using `CGEventTapOptions::ListenOnly`. Requires macOS Accessibility permission — if `CGEventTapCreate` returns null, return `Err(OsError)`.

**New callback `key_event_callback`**:
```rust
unsafe extern "C" fn key_event_callback(
    _proxy: CGEventTapProxy, ev_type: CGEventType,
    event: CGEventRef, user_info: *const c_void,
) -> CGEventRef {
    if ev_type == CGEventType::KeyDown || ev_type == CGEventType::KeyUp {
        let ns_event: Retained<NSEvent> = msg_send![NSEvent::class(), eventWithCGEvent: event];
        let key_code: u16 = msg_send![&*ns_event, keyCode];
        let flags: NSEventModifierFlags = ns_event.modifierFlags();

        let mut mods = Modifiers::empty();
        if flags.contains(NSEventModifierFlags::Shift)   { mods |= Modifiers::SHIFT; }
        if flags.contains(NSEventModifierFlags::Control) { mods |= Modifiers::CONTROL; }
        if flags.contains(NSEventModifierFlags::Option)  { mods |= Modifiers::ALT; }
        if flags.contains(NSEventModifierFlags::Command) { mods |= Modifiers::META; }
        // Normalize META → SUPER (same as HotKey::new does)
        if mods.contains(Modifiers::META) { mods.remove(Modifiers::META); mods.insert(Modifiers::SUPER); }

        let tap_hotkeys = &*(user_info as *const Mutex<HashMap<u32, (HotKey, u32)>>);
        if let Ok(hk_map) = tap_hotkeys.try_lock() {
            for (id, (hotkey, scancode)) in hk_map.iter() {
                if *scancode == key_code as u32 && hotkey.mods == mods {
                    let state = if ev_type == CGEventType::KeyDown {
                        HotKeyState::Pressed
                    } else {
                        HotKeyState::Released
                    };
                    GlobalHotKeyEvent::send(GlobalHotKeyEvent { id: *id, state });
                }
            }
        }
    }
    event
}
```

**Note**: `CGEventTapOptions::ListenOnly` requires macOS Accessibility in System Preferences → Privacy & Security → Accessibility. Without it, `CGEventTapCreate` returns null. The `ffi.rs` already has everything needed (`CGEventType::KeyDown = 10`, `CGEventType::KeyUp = 11`, `CGEventTapOptions::ListenOnly`).

**`unregister()` modification**: Also remove from `tap_hotkeys`. If `tap_hotkeys` becomes empty AND `media_hotkeys` is also empty, stop both taps.

---

### 3. `vendor/global-hotkey/src/platform_impl/x11/mod.rs` — **MINOR TASK**

**Strategy**: Reduce polling latency from 50ms to 1ms.

**Current code** (around line ~265 in the events thread loop):
```rust
std::thread::sleep(std::time::Duration::from_millis(50));
```

**Change to**:
```rust
std::thread::sleep(std::time::Duration::from_millis(1));
```

That's the entire Linux change. One line. XGrabKey already delivers events at the X server level before applications see them (equivalent to WH_KEYBOARD_LL for X11). The only real limitation is compositor-reserved keys (Super+D, Super+L, etc.) which cannot be overcome without XRecord/XInput2 — not worth the added complexity.

---

## Cargo.toml Changes

**No changes needed** to `vendor/global-hotkey/Cargo.toml`. All required windows-sys features are already present.

---

## Key Facts to Keep in Mind

### Modifiers normalization (SUPER vs META)
`HotKey::new()` in `hotkey.rs` normalizes `Modifiers::META` → `Modifiers::SUPER`. Hotkeys in the registry always have `SUPER`, never `META`. When reading live key state, use `mods_match()` (Windows) or manual normalization (macOS) to compare.

### VIRTUAL_KEY type
In windows-sys 0.59, `VIRTUAL_KEY` is a type alias for `u16`. So `kb.vkCode as u16` = `kb.vkCode as VIRTUAL_KEY`.

### KBDLLHOOKSTRUCT.flags
- `LLKHF_INJECTED = 0x10` — set when key was injected via SendInput
- `LLKHF_UP = 0x80` — set on key-up (redundant, use wparam instead)

Neither constant is exported by windows-sys; must be defined as `const`.

### Hook thread requirement
`WH_KEYBOARD_LL` callbacks are delivered to the thread that called `SetWindowsHookExW`. That thread MUST run a Win32 message loop (`GetMessageW`) or the hook never fires.

### Win key Start menu prevention
When a Win+X combo is intercepted and the Win key is later released, Windows may open the Start menu. Prevent this by injecting `VK_F24` down+up immediately on Win release (only when `WIN_USED` flag is set). The injected event has `LLKHF_INJECTED` flag → skipped by our hook → no infinite loop.

### Pre-existing test failures (unrelated to this work)
These 4 tests fail on `cargo test` BEFORE any of our changes:
```
core::insertion::tests::wayland_platform_status_names_missing_helpers_in_driver_chain
core::insertion::tests::x11_platform_status_marks_missing_xdotool_as_recovery_only
core::insertion::tests::clipboard_fallback_surfaces_auto_paste_failure
core::providers::local_preview::tests::local_preview_status_flags_runner_probe_failure...
```
117 tests pass. After our changes, these 4 must still be the only failures.

---

## Validation Steps

```bash
# After implementing:
cd src-tauri
cargo test

# If that passes (117 pass, same 4 fail):
npm run tauri dev
# Test with ctrl_l+alt_l+space (current default) → should work
# Test with ctrl_l+win+space (the originally broken combo) → should now work
```

---

## Implementation Order

1. **Windows `windows/mod.rs`** — full file replacement (~280 lines). The `key_to_vk()` function at the bottom stays verbatim; everything above it gets replaced.
2. **Linux `x11/mod.rs`** — one-line change (50 → 1 in thread::sleep).
3. **macOS `macos/mod.rs`** — medium change (~80 lines new code, modify `register()`/`unregister()`).
4. **`cargo test`** — validate no regressions.
