"use client";

import { HeartPulse } from "lucide-react";
import { PersonalActivitySection } from "@/components/me/personal-activity-section";

export default function MeHealthPage() {
  return <PersonalActivitySection section="health" icon={HeartPulse} />;
}
