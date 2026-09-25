"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { searchWorkspace, type SearchHit } from "@/lib/actions/search";
import { NAV_ITEMS } from "@/components/nav/nav-items";
import { cn } from "@/lib/utils";
import {
  Building2,
  CornerDownLeft,
  DoorOpen,
  Loader2,
  Plus,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react";

type Entry = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  href: string;
  Icon: LucideIcon;
};

const HIT_ICON: Record<SearchHit["kind"], LucideIcon> = {
  tenant: UserRound,
  property: Building2,
  room: DoorOpen,
};

export const CREATE_ACTIONS = [
  { key: "property", href: "/properties?new=1", Icon: Building2 },
  { key: "tenant", href: "/tenants?new=1", Icon: UserRound },
  { key: "job", href: "/maintenance?new=1", Icon: Plus },
  { key: "expense", href: "/expenses?new=1", Icon: Plus },
] as const;

/**
 * One box that finds anything: a person, a building, a room, a screen or an
 * action. Opened from the header or with ⌘K / Ctrl+K from anywhere, so moving
 * around the workspace never depends on remembering which menu holds what.
 */
export function CommandMenu() {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [isSearching, startSearch] = useTransition();
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const timer = setTimeout(() => {
      startSearch(async () => setHits(await searchWorkspace(term)));
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  const entries = useMemo<Entry[]>(() => {
    const q = query.trim().toLocaleLowerCase();
    const matches = (s: string) => !q || s.toLocaleLowerCase().includes(q);
    const records: Entry[] = (query.trim().length < 2 ? [] : hits).map((h) => ({
      id: `${h.kind}-${h.id}`,
      group: t("command.records"),
      label: h.title,
      hint: h.subtitle,
      href: h.href,
      Icon: HIT_ICON[h.kind],
    }));
    const actions: Entry[] = CREATE_ACTIONS.map((a) => ({
      id: `new-${a.key}`,
      group: t("command.actions"),
      label: t(`command.new.${a.key}`),
      href: a.href,
      Icon: a.Icon,
    })).filter((e) => matches(e.label));
    const pages: Entry[] = NAV_ITEMS.map((i) => ({
      id: `go-${i.href}`,
      group: t("command.goTo"),
      label: t(`nav.${i.labelKey}`),
      href: i.href,
      Icon: i.Icon,
    })).filter((e) => matches(e.label));
    return [...records, ...actions, ...pages];
  }, [hits, query, t]);

  const current = Math.min(active, Math.max(entries.length - 1, 0));

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${current}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [current]);

  function go(entry: Entry | undefined) {
    if (!entry) return;
    setOpen(false);
    setQuery("");
    router.push(entry.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(current + 1, entries.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(current - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(entries[current]);
    }
  }

  let lastGroup = "";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shell-search group flex h-9 w-full max-w-md items-center gap-2 rounded-lg px-3 text-sm transition-colors"
        aria-label={t("command.open")}
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="truncate sm:hidden">{t("command.short")}</span>
        <span className="hidden truncate sm:inline">{t("command.placeholder")}</span>
        <kbd className="ml-auto hidden rounded border px-1.5 font-sans text-[11px] md:inline">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-[12vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
          onKeyDown={onKeyDown}
        >
          <DialogTitle className="sr-only">{t("command.open")}</DialogTitle>
          <DialogDescription className="sr-only">{t("command.placeholder")}</DialogDescription>
          <div className="flex items-center gap-3 border-b px-4">
            {isSearching ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <Search className="size-4 text-muted-foreground" aria-hidden />
            )}
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder={t("command.placeholder")}
              className="h-13 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              role="combobox"
              aria-expanded="true"
              aria-controls="command-list"
              aria-activedescendant={entries[current] ? `cmd-${entries[current].id}` : undefined}
            />
            <kbd className="rounded border px-1.5 text-[11px] text-muted-foreground">esc</kbd>
          </div>

          <ul id="command-list" ref={listRef} role="listbox" className="max-h-[min(60vh,440px)] overflow-y-auto p-2">
            {entries.length === 0 && (
              <li className="px-3 py-10 text-center text-sm text-muted-foreground">
                {isSearching ? t("command.searching") : t("command.empty")}
              </li>
            )}
            {entries.map((entry, index) => {
              const header = entry.group !== lastGroup ? entry.group : null;
              lastGroup = entry.group;
              const { Icon } = entry;
              return (
                <li key={entry.id} role="presentation">
                  {header && (
                    <p className="px-3 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {header}
                    </p>
                  )}
                  <button
                    id={`cmd-${entry.id}`}
                    type="button"
                    role="option"
                    aria-selected={index === current}
                    data-index={index}
                    onMouseMove={() => setActive(index)}
                    onClick={() => go(entry)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm",
                      index === current ? "bg-accent text-accent-foreground" : "text-foreground",
                    )}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{entry.label}</span>
                      {entry.hint && (
                        <span className="block truncate text-xs text-muted-foreground">{entry.hint}</span>
                      )}
                    </span>
                    {index === current && (
                      <CornerDownLeft className="size-3.5 text-muted-foreground" aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
