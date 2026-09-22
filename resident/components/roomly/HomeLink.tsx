"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import { homeHref } from "@/lib/home-navigation";
export function useHomeHref() {
  const room = useSearchParams().get("room");
  return (path: string) => homeHref(path, room);
}
export function HomeLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const destination = useHomeHref();
  return <Link href={destination(href)} {...props} />;
}
