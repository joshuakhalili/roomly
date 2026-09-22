import { renderApplication } from "@/lib/render";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const q = await searchParams;
  return renderApplication("/home/ask", { roomId: q.room });
}
