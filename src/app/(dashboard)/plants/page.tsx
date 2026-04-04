"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHousehold } from "@/hooks/use-household";
import { LoadingScreen } from "@/components/ui/loading";
import {
  Plus,
  X,
  Sprout,
  Droplets,
  Sun,
  CloudSun,
  Moon,
  MapPin,
  Loader2,
  Trash2,
  Clock,
  CalendarPlus,
} from "lucide-react";
import { googleCalendarUrl } from "@/lib/utils/calendar";
import type { Plant } from "@/lib/types/database";

const PLANT_DATABASE: Record<string, { watering_days: number; sunlight: string; tip: string }> = {
  "מונסטרה": { watering_days: 7, sunlight: "partial", tip: "אוהבת לחות גבוהה. רססו מים על העלים" },
  "פוטוס": { watering_days: 5, sunlight: "shade", tip: "צמח קשוח שסולח על שכחה. מעולה למתחילים" },
  "בזיליקום": { watering_days: 2, sunlight: "full", tip: "קטפו עלים מלמעלה לעודד צמיחה" },
  "רוזמרין": { watering_days: 7, sunlight: "full", tip: "לא להשקות יותר מדי. אוהב אדמה יבשה" },
  "נענע": { watering_days: 2, sunlight: "partial", tip: "צומחת מהר. שתלו בעציץ נפרד" },
  "אלוורה": { watering_days: 14, sunlight: "full", tip: "להשקות רק כשהאדמה יבשה לגמרי" },
  "סוקולנט": { watering_days: 10, sunlight: "full", tip: "ניקוז טוב חיוני. מעט מים" },
  "קקטוס": { watering_days: 14, sunlight: "full", tip: "מעט מאוד מים. שמש ישירה" },
  "פיקוס": { watering_days: 7, sunlight: "partial", tip: "לא לזיז אותו הרבה. לא אוהב שינויים" },
  "שרכים": { watering_days: 3, sunlight: "shade", tip: "אוהבים לחות. מצוינים לחדר אמבטיה" },
  "לבנדר": { watering_days: 7, sunlight: "full", tip: "גזום אחרי פריחה. אוהב שמש מלאה" },
  "פטרוזיליה": { watering_days: 3, sunlight: "partial", tip: "קטפו מבחוץ פנימה" },
  "עגבניות שרי": { watering_days: 2, sunlight: "full", tip: "צריכות תמיכה. השקו את הבסיס" },
  "פלפלים": { watering_days: 3, sunlight: "full", tip: "אוהבים חום. השקיה סדירה" },
};

function getWateringStatus(plant: Plant): "ok" | "soon" | "overdue" {
  if (!plant.next_watering) return "ok";
  const next = new Date(plant.next_watering);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "overdue";
  if (diff <= 1) return "soon";
  return "ok";
}

function getDaysUntilWatering(plant: Plant): string {
  if (!plant.next_watering) return "לא הוגדר";
  const next = new Date(plant.next_watering);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `איחור של ${Math.abs(diff)} ימים`;
  if (diff === 0) return "היום!";
  if (diff === 1) return "מחר";
  return `בעוד ${diff} ימים`;
}

const sunlightLabels: Record<string, { label: string; icon: typeof Sun }> = {
  full: { label: "שמש מלאה", icon: Sun },
  partial: { label: "שמש חלקית", icon: CloudSun },
  shade: { label: "צל", icon: Moon },
};

export default function PlantsPage() {
  const { household, userId, loading: hhLoading } = useHousehold();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggestion, setSuggestion] = useState<typeof PLANT_DATABASE[string] | null>(null);

  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [location, setLocation] = useState("");
  const [waterDays, setWaterDays] = useState("");
  const [sunlight, setSunlight] = useState("partial");
  const [addToCalendar, setAddToCalendar] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (!household) return;
    loadPlants();
  }, [household]);

  async function loadPlants() {
    setLoading(true);
    const { data } = await supabase
      .from("plants")
      .select("*")
      .eq("household_id", household!.id)
      .order("next_watering", { ascending: true, nullsFirst: false });

    if (data) setPlants(data as Plant[]);
    setLoading(false);
  }

  function handleNameChange(val: string) {
    setName(val);
    const match = PLANT_DATABASE[val];
    if (match) {
      setSuggestion(match);
      setWaterDays(String(match.watering_days));
      setSunlight(match.sunlight);
    } else {
      setSuggestion(null);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!household || !userId) return;
    setSaving(true);

    const freq = parseInt(waterDays) || 7;
    const today = new Date().toISOString().split("T")[0];
    const nextWater = new Date();
    nextWater.setDate(nextWater.getDate() + freq);

    await supabase.from("plants").insert({
      household_id: household.id,
      name,
      species: species || null,
      location: location || null,
      watering_frequency_days: freq,
      sunlight_needs: sunlight as "full" | "partial" | "shade",
      last_watered: today,
      next_watering: nextWater.toISOString().split("T")[0],
      added_by: userId,
    });

    if (addToCalendar) {
      const nextWaterDate = new Date();
      nextWaterDate.setDate(nextWaterDate.getDate() + freq);
      window.open(
        googleCalendarUrl({
          title: `🌱 השקיה: ${name}`,
          date: nextWaterDate.toISOString().split("T")[0],
          recurrence: freq <= 3 ? "DAILY" : "WEEKLY",
        }),
        "_blank"
      );
    }

    setName("");
    setSpecies("");
    setLocation("");
    setWaterDays("");
    setSunlight("partial");
    setAddToCalendar(false);
    setSuggestion(null);
    setShowForm(false);
    setSaving(false);
    loadPlants();
  }

  async function waterPlant(plant: Plant) {
    const today = new Date().toISOString().split("T")[0];
    const nextWater = new Date();
    nextWater.setDate(nextWater.getDate() + (plant.watering_frequency_days || 7));

    await supabase
      .from("plants")
      .update({
        last_watered: today,
        next_watering: nextWater.toISOString().split("T")[0],
      })
      .eq("id", plant.id);

    await supabase.from("plant_care_logs").insert({
      plant_id: plant.id,
      action: "water",
      done_by: userId,
    });

    loadPlants();
  }

  async function deletePlant(id: string) {
    await supabase.from("plants").delete().eq("id", id);
    setPlants((prev) => prev.filter((p) => p.id !== id));
  }

  if (hhLoading) return <LoadingScreen />;

  const statusColors = {
    ok: "border-success/30 bg-success/5",
    soon: "border-accent/30 bg-accent/5",
    overdue: "border-danger/30 bg-danger/5",
  };

  const statusDotColors = {
    ok: "bg-success",
    soon: "bg-accent",
    overdue: "bg-danger",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">הצמחים שלי</h1>
          <p className="text-muted">
            {plants.length} צמחים ·{" "}
            {plants.filter((p) => getWateringStatus(p) !== "ok").length} צריכים
            השקיה
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
        >
          <Plus className="h-4 w-4" />
          צמח חדש
        </button>
      </div>

      {/* Plants Grid */}
      {loading ? (
        <LoadingScreen />
      ) : plants.length === 0 ? (
        <div className="rounded-2xl border bg-surface p-12 text-center">
          <Sprout className="mx-auto mb-3 h-10 w-10 text-muted" />
          <p className="font-medium">אין צמחים עדיין</p>
          <p className="mt-1 text-sm text-muted">
            הוסיפו את הצמח הראשון שלכם
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plants.map((plant) => {
            const status = getWateringStatus(plant);
            const SunIcon = sunlightLabels[plant.sunlight_needs || "partial"]?.icon || CloudSun;
            return (
              <div
                key={plant.id}
                className={`rounded-2xl border p-5 transition-all ${statusColors[status]}`}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${statusDotColors[status]}`} />
                    <h3 className="font-bold">{plant.name}</h3>
                  </div>
                  <button
                    onClick={() => deletePlant(plant.id)}
                    className="rounded-lg p-1 text-muted hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {plant.species && (
                  <p className="mb-2 text-xs text-muted">{plant.species}</p>
                )}

                <div className="mb-4 flex flex-wrap gap-2 text-xs">
                  {plant.location && (
                    <span className="flex items-center gap-1 rounded-full bg-white/60 px-2 py-1">
                      <MapPin className="h-3 w-3" />
                      {plant.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1 rounded-full bg-white/60 px-2 py-1">
                    <SunIcon className="h-3 w-3" />
                    {sunlightLabels[plant.sunlight_needs || "partial"]?.label}
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-white/60 px-2 py-1">
                    <Clock className="h-3 w-3" />
                    כל {plant.watering_frequency_days} ימים
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-medium ${
                      status === "overdue"
                        ? "text-danger"
                        : status === "soon"
                        ? "text-amber-600"
                        : "text-muted"
                    }`}
                  >
                    השקיה: {getDaysUntilWatering(plant)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {plant.next_watering && (
                      <a
                        href={googleCalendarUrl({
                          title: `🌱 השקיה: ${plant.name}`,
                          date: plant.next_watering,
                          recurrence:
                            plant.watering_frequency_days && plant.watering_frequency_days <= 3
                              ? "DAILY"
                              : "WEEKLY",
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-lg border border-primary/20 bg-white/80 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                        תזכורת
                      </a>
                    )}
                    <button
                      onClick={() => waterPlant(plant)}
                      className="flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 transition-colors"
                    >
                      <Droplets className="h-3 w-3" />
                      השקיתי
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Plant Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">צמח חדש</h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setSuggestion(null);
                }}
                className="rounded-lg p-1.5 hover:bg-surface-dim"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  שם הצמח
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="למשל: מונסטרה, בזיליקום, פוטוס..."
                  className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                  required
                  list="plant-suggestions"
                />
                <datalist id="plant-suggestions">
                  {Object.keys(PLANT_DATABASE).map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>

              {suggestion && (
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-sm">
                  <p className="font-medium text-primary">זיהינו את הצמח!</p>
                  <p className="mt-1 text-muted">{suggestion.tip}</p>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  מיקום בבית
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="סלון, מרפסת, מטבח..."
                  className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    השקיה כל (ימים)
                  </label>
                  <input
                    type="number"
                    value={waterDays}
                    onChange={(e) => setWaterDays(e.target.value)}
                    placeholder="7"
                    className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                    min="1"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    שמש
                  </label>
                  <select
                    value={sunlight}
                    onChange={(e) => setSunlight(e.target.value)}
                    className="w-full rounded-xl border bg-background py-3 px-4 text-sm"
                  >
                    <option value="full">שמש מלאה</option>
                    <option value="partial">שמש חלקית</option>
                    <option value="shade">צל</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm cursor-pointer hover:bg-primary/10 transition-colors">
                <input
                  type="checkbox"
                  checked={addToCalendar}
                  onChange={(e) => setAddToCalendar(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <CalendarPlus className="h-4 w-4 text-primary" />
                <span className="font-medium">תזכורת השקיה ביומן Google</span>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "שומר..." : "הוספת צמח"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
