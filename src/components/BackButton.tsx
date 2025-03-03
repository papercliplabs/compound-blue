"use client";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();
  return <Button onClick={() => router.back()}>Back</Button>;
}
