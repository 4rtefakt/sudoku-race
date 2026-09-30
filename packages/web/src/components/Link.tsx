import type { AnchorHTMLAttributes } from "react";
import { navigate } from "../lib/router.js";

/** Lien interne : navigation sans rechargement, clic milieu et Ctrl+clic préservés. */
export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(href);
        window.scrollTo(0, 0);
      }}
      {...rest}
    />
  );
}
