/**
 * Partage natif quand il existe (mobile), sinon copie dans le presse-papiers.
 * Renvoie "shared", "copied" ou "failed".
 */
export async function shareOrCopy(data: { text: string; url: string }): Promise<"shared" | "copied" | "failed"> {
  if (navigator.share) {
    try {
      await navigator.share({ text: data.text, url: data.url });
      return "shared";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "failed";
    }
  }
  return (await copyText(`${data.text} ${data.url}`)) ? "copied" : "failed";
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
