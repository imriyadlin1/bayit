"use client";

import { BookOpen } from "lucide-react";
import { PersonalItemsBoard } from "@/components/me/personal-items-board";

export default function MeStudiesPage() {
  return <PersonalItemsBoard section="studies" icon={BookOpen} />;
}
