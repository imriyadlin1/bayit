"use client";

import { Dumbbell } from "lucide-react";
import { PersonalItemsBoard } from "@/components/me/personal-items-board";

export default function MeSportPage() {
  return <PersonalItemsBoard section="sport" icon={Dumbbell} />;
}
