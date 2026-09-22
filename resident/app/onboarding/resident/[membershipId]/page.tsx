import { renderApplication } from "@/lib/render";
export default async function Page({
  params,
}: {
  params: Promise<{ membershipId: string }>;
}) {
  const { membershipId } = await params;
  return renderApplication(`/onboarding/resident/${membershipId}`, {
    membershipId,
  });
}
