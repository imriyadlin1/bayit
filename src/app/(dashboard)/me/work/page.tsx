"use client";

import { Briefcase } from "lucide-react";
import { PersonalActivitySection } from "@/components/me/personal-activity-section";

export default function MeWorkPage() {
  return <PersonalActivitySection section="work" icon={Briefcase} />;
}
