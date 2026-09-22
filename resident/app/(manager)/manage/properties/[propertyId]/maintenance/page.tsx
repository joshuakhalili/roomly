import { renderApplication } from "@/lib/render";
export default async function Page({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  return renderApplication(`/manage/properties/${propertyId}/maintenance`, {
    propertyId,
  });
}
