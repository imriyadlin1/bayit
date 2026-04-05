"use client";

import { HeartPulse } from "lucide-react";
import { PersonalItemsBoard } from "@/components/me/personal-items-board";

export default function MeHealthPage() {
  return <PersonalItemsBoard section="health" icon={HeartPulse} />;
}
