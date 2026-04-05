"use client";

import { Dumbbell } from "lucide-react";
import { PersonalActivitySection } from "@/components/me/personal-activity-section";

export default function MeSportPage() {
  return <PersonalActivitySection section="sport" icon={Dumbbell} />;
}
