"use client";

import { BookOpen } from "lucide-react";
import { PersonalActivitySection } from "@/components/me/personal-activity-section";

export default function MeStudiesPage() {
  return <PersonalActivitySection section="studies" icon={BookOpen} />;
}
