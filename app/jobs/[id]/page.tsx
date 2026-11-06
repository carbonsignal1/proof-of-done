import { paypalMode } from "@/lib/paypal";
import { JobClient } from "./JobClient";

export const dynamic = "force-dynamic";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // The client id is public by design (it's embedded in PayPal's checkout script).
  const clientId = paypalMode() === "sandbox" ? process.env.PAYPAL_CLIENT_ID! : null;
  return <JobClient id={id} clientId={clientId} />;
}
