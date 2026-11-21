"use client";

import { useEffect, useRef } from "react";

type Command =
  | { label: string; title: string; command: string; value?: string }
  | { label: string; title: string; link: true };

const COMMANDS: Command[] = [
  { label: "Heading", title: "Section heading", command: "formatBlock", value: "h2" },
  { label: "Subheading", title: "Smaller heading", command: "formatBlock", value: "h3" },
  { label: "Text", title: "Ordinary paragraph", command: "formatBlock", value: "p" },
  { label: "Bold", title: "Bold", command: "bold" },
  { label: "Italic", title: "Italic", command: "italic" },
  { label: "• List", title: "Bulleted list", command: "insertUnorderedList" },
  { label: "1. List", title: "Numbered list", command: "insertOrderedList" },
  { label: "Link", title: "Turn the selected words into a link", link: true },
  { label: "Clear", title: "Remove formatting from the selection", command: "removeFormat" },
];

/**
 * A plain rich-text box for staff: type, or paste from a document, and use
 * the buttons for headings, lists and links. It edits HTML in place, so a
 * page reads here the way it reads on the site. Whatever comes out is cleaned
 * on the server when the page is saved; nothing here is trusted.
 *
 * The starting text is set once per mount. Give the editor a `key` that
 * changes when a different page is opened.
 */
export function RichTextEditor({
  initialHtml,
  onChange,
  labelledBy,
}: {
  initialHtml: string;
  onChange: (html: string) => void;
  labelledBy: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !box.current) return;
    started.current = true;
    box.current.innerHTML = initialHtml;
  }, [initialHtml]);

  function report() {
    if (box.current) onChange(box.current.innerHTML);
  }

  function run(item: Command) {
    const el = box.current;
    if (!el) return;
    el.focus();
    if ("link" in item) {
      const url = window.prompt("Link address (https://… or an email address)");
      if (!url) return;
      const trimmed = url.trim();
      const href = /^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/.test(trimmed)
        ? `mailto:${trimmed}`
        : /^(https?:|mailto:|tel:|\/)/i.test(trimmed)
          ? trimmed
          : `https://${trimmed}`;
      document.execCommand("createLink", false, href);
    } else {
      document.execCommand(item.command, false, item.value);
    }
    report();
  }

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2"
      >
        {COMMANDS.map((item) => (
          <button
            key={item.label}
            type="button"
            title={item.title}
            // Keep the selection in the text while the button is pressed.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(item)}
            className="min-h-10 rounded-full border border-border bg-page px-3 font-display text-sm font-medium text-brown hover:bg-primary/15"
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        ref={box}
        role="textbox"
        aria-multiline="true"
        aria-labelledby={labelledBy}
        contentEditable
        suppressContentEditableWarning
        onInput={report}
        onBlur={report}
        className="prose-cms min-h-64 max-w-none px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
    </div>
  );
}
