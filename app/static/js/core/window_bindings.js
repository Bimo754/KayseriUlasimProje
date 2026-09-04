/**
   Kayseri Ulaşım - HTML Onclick Global Window Bridge (WindowBindings)
   Decouples HTML element onclick attributes from application modules.
 */

export function registerWindowBindings(bindings: Record<string, any>) {
    for (const [key, fn] of Object.entries(bindings)) {
        (window as any)[key] = fn;
    }
}
