"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  renderTemplate,
  pickTemplate,
  whatsappLink,
  type MessageTemplate,
  type TemplateKey,
} from "@/lib/messaging";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MessageCircle, Copy, Send, CircleAlert } from "lucide-react";
import { APP_LANGUAGES, LANGUAGE_LABELS } from "@/lib/types";
import type { AppLanguage, TenantOnTenancy } from "@/lib/types";

/**
 * The regional tag each language's dates are written with.
 *
 * Not the same as the language code: a date for a British tenant is en-GB
 * (25 March 2026), and en alone gives the American order.
 */
const DATE_LOCALE: Record<AppLanguage, string> = {
  en: "en-GB",
  zh: "zh-CN",
  tr: "tr-TR",
};

/** WhatsApp and WeChat brand colours, so the buttons read at a glance. */
const WHATSAPP_GREEN = "#25D366";
const WECHAT_GREEN = "#07C160";

export function ReminderDialog({
  tenant,
  templates,
  templateKey,
  values,
  isoDates,
  trigger,
}: {
  tenant: TenantOnTenancy;
  templates: MessageTemplate[];
  templateKey: TemplateKey;
  values: Record<string, string | number | null | undefined>;
  /**
   * Dates as ISO strings, formatted in the message's own language rather
   * than the admin's. A Chinese message containing "January 31, 2026"
   * reads as half-translated to the person receiving it.
   */
  isoDates?: Record<string, string>;
  trigger?: React.ReactNode;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>(
    tenant.preferred_language,
  );

  const body = pickTemplate(templates, templateKey, language);
  const [message, setMessage] = useState("");

  const localisedDates = Object.fromEntries(
    Object.entries(isoDates ?? {}).map(([key, iso]) => [
      key,
      new Intl.DateTimeFormat(DATE_LOCALE[language], {
        dateStyle: "long",
      }).format(new Date(iso)),
    ]),
  );

  // Re-renders whenever the language changes, unless the admin has edited it.
  const rendered = body
    ? renderTemplate(body, {
        ...values,
        ...localisedDates,
        name: tenant.first_name,
      })
    : "";
  const text = message || rendered;

  const waLink = tenant.phone ? whatsappLink(tenant.phone, text) : null;

  async function copyForWeChat() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("reminder.copied", { name: tenant.first_name }));
    } catch {
      toast.error(t("common.error"));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setLanguage(tenant.preferred_language);
          setMessage("");
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Send className="size-4" aria-hidden />
            {t("rent.sendReminder")}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reminder.title")}</DialogTitle>
          <DialogDescription>
            {tenant.first_name} {tenant.surname}
            {tenant.phone && ` · ${tenant.phone}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {APP_LANGUAGES.map((lang) => (
              <Button
                key={lang}
                size="sm"
                variant={language === lang ? "default" : "outline"}
                onClick={() => {
                  setLanguage(lang);
                  setMessage("");
                }}
              >
                {LANGUAGE_LABELS[lang]}
              </Button>
            ))}
            {/* Shown whenever the selected language is the one they asked for,
                whichever that is — it used to say so only for Chinese. */}
            {language === tenant.preferred_language && (
              <span className="self-center text-xs text-muted-foreground">
                {t("reminder.preferred")}
              </span>
            )}
          </div>

          <Field label={t("reminder.preview")}>
            <Textarea
              value={text}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              aria-label={t("reminder.preview")}
            />
          </Field>

          {/* WhatsApp opens the chat with the text already in it. */}
          {waLink ? (
            <Button asChild style={{ backgroundColor: WHATSAPP_GREEN }}>
              <a href={waLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" aria-hidden />
                {t("reminder.whatsapp")}
              </a>
            </Button>
          ) : (
            <p className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
              <CircleAlert className="size-4 shrink-0" aria-hidden />
              {t("reminder.noPhone")}
            </p>
          )}

          {/* WeChat has no equivalent link, so this copies instead. */}
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={copyForWeChat}
              style={{ borderColor: WECHAT_GREEN, color: WECHAT_GREEN }}
            >
              <Copy className="size-4" aria-hidden />
              {t("reminder.wechat")}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t("reminder.wechatNote")}
              {tenant.wechat_id && (
                <>
                  {" "}
                  <span className="font-medium text-foreground">
                    {tenant.wechat_id}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
