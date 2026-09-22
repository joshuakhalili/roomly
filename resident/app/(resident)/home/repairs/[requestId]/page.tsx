import { renderApplication } from "@/lib/render";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ room?: string }>;
}) {
  const { requestId } = await params;
  return renderApplication(`/home/repairs/${requestId}`, {
    roomId: (await searchParams).room,
  });
}
