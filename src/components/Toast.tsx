"use client";

import { useEffect, useState } from "react";

const EVENT = "app-toast";

/** Show a short message at the bottom of the screen, from anywhere. */
export function toast(text: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: text }));
}

export function Toaster() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = (e: Event) => {
      setText((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setText(null), 2600);
    };
    window.addEventListener(EVENT, show);
    return () => {
      window.removeEventListener(EVENT, show);
      clearTimeout(timer);
    };
  }, []);
  if (!text) return null;
  return (
    <div className="toast" role="status">
      <span key={text}>{text}</span>
    </div>
  );
}
