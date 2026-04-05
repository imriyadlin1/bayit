"use client";

import { Briefcase } from "lucide-react";
import { PersonalItemsBoard } from "@/components/me/personal-items-board";

export default function MeWorkPage() {
  return <PersonalItemsBoard section="work" icon={Briefcase} />;
}
