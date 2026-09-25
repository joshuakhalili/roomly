"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CREATE_ACTIONS } from "@/components/nav/command-menu";
import { Plus } from "lucide-react";

/** The four things people add most, one click from any screen. */
export function NewMenu() {
  const t = useTranslations();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="shell-new inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Plus className="size-4" aria-hidden />
        <span className="hidden sm:inline">{t("shell.new")}</span>
        <span className="sr-only sm:hidden">{t("shell.new")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {CREATE_ACTIONS.map(({ key, href, Icon }) => (
          <DropdownMenuItem key={key} asChild>
            <Link href={href}>
              <Icon className="size-4" aria-hidden />
              {t(`command.new.${key}`)}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
