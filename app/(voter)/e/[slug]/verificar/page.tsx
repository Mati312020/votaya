import { notFound } from "next/navigation";
import VerificarClient from "./VerificarClient";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ m?: string }>;
}

export default async function VerificarPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { m } = await searchParams;

  if (!m || !["dni_qr", "otp_email", "renaper", "face_cloud", "face_client"].includes(m)) {
    notFound();
  }

  return <VerificarClient slug={slug} metodo={m as "dni_qr" | "otp_email" | "renaper" | "face_cloud" | "face_client"} />;
}
