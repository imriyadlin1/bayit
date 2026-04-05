"use client";

import { PiggyBank } from "lucide-react";
import { PersonalItemsBoard } from "@/components/me/personal-items-board";

export default function MeFinancePage() {
  return <PersonalItemsBoard section="finance" icon={PiggyBank} />;
}
