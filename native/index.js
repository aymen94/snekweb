// The native addon is opt-in; importing the framework never requires a compiler.
export async function loadNative() {
  try { return await import('./build/Release/snekweb_native.node') }
  catch { return null }
}
