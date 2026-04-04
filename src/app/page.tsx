import Link from "next/link";
import {
  Home,
  Wallet,
  ShoppingCart,
  Sprout,
  ListChecks,
  Users,
  BarChart3,
  Wrench,
  ArrowLeft,
  Sparkles,
  Shield,
  Smartphone,
} from "lucide-react";

const features = [
  {
    icon: Wallet,
    title: "ניהול הוצאות",
    description: "מעקב אחרי כל שקל - חשבונות, שכירות, סופר ועוד. גרפים וסינון לפי חודשים.",
    color: "bg-indigo-100 text-indigo-600",
  },
  {
    icon: ShoppingCart,
    title: "רשימת קניות חכמה",
    description: "רשימה משותפת בזמן אמת. אחד בסופר, השני מוסיף מהבית.",
    color: "bg-emerald-100 text-emerald-600",
  },
  {
    icon: Sprout,
    title: "צמחים ותזכורות",
    description: "הוסיפו צמח, המערכת תדע מתי להשקות. תזכורות אוטומטיות ויומן טיפול.",
    color: "bg-green-100 text-green-600",
  },
  {
    icon: ListChecks,
    title: "מטלות בית",
    description: "חלוקה הוגנת של משימות. רוטציה אוטומטית ומעקב מי עשה מה.",
    color: "bg-amber-100 text-amber-600",
  },
  {
    icon: Users,
    title: "ממשק משותף",
    description: "זוגות, שותפים או משפחה - כולם על אותו חשבון, הכל מסונכרן.",
    color: "bg-blue-100 text-blue-600",
  },
  {
    icon: BarChart3,
    title: "תובנות ונתוני עבר",
    description: "השוואת הוצאות, מגמות צריכה, והתראות חריגה חכמות.",
    color: "bg-purple-100 text-purple-600",
  },
  {
    icon: Wrench,
    title: "תחזוקת בית",
    description: "מעקב אחריות מכשירים, תזכורות לפילטר מזגן, ורשימת בעלי מקצוע.",
    color: "bg-orange-100 text-orange-600",
  },
  {
    icon: Sparkles,
    title: "מלאי מזון",
    description: "יודעים מה יש בבית. התראה כשמשהו עומד להיגמר או לפוג.",
    color: "bg-pink-100 text-pink-600",
  },
];

const steps = [
  {
    num: "1",
    title: "נרשמים בחינם",
    description: "יוצרים חשבון תוך שניות",
  },
  {
    num: "2",
    title: "מזמינים את בני הבית",
    description: "שולחים קוד הזמנה לשותפים, בן/בת זוג או משפחה",
  },
  {
    num: "3",
    title: "מתחילים לנהל",
    description: "הוצאות, קניות, צמחים, מטלות - הכל במקום אחד",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b bg-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
              <Home className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold">בית</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              התחברות
            </Link>
            <Link
              href="/register"
              className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
            >
              הרשמה בחינם
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-bl from-primary/8 via-transparent to-accent/5" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              ניהול בית חכם, סוף סוף
            </div>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl md:leading-tight">
              הבית שלך.{" "}
              <span className="bg-gradient-to-l from-primary to-emerald-500 bg-clip-text text-transparent">
                מסודר.
              </span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted md:text-xl">
              פלטפורמה אחת שמנהלת לך את הכל — הוצאות, קניות, מלאי מזון, צמחים,
              מטלות ותחזוקה. שיתוף מלא עם בני הבית.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/register"
                className="flex items-center gap-2 rounded-2xl bg-primary px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-primary/25 hover:bg-primary-dark transition-all hover:shadow-xl hover:shadow-primary/30"
              >
                התחילו בחינם
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <Link
                href="#features"
                className="rounded-2xl border px-8 py-3.5 text-base font-medium hover:bg-surface-dim transition-colors"
              >
                מה בפנים?
              </Link>
            </div>
          </div>

          {/* Trust indicators */}
          <div className="mx-auto mt-16 flex max-w-lg flex-wrap items-center justify-center gap-6 text-sm text-muted">
            <div className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-primary" />
              <span>מאובטח</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Smartphone className="h-4 w-4 text-primary" />
              <span>עובד מכל מכשיר</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" />
              <span>שיתוף מלא</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t bg-surface py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">
              הכל מה שצריך לנהל בית
            </h2>
            <p className="mt-4 text-lg text-muted">
              כל הכלים במקום אחד. בלי אקסלים, בלי פתקים על המקרר.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group rounded-2xl border bg-background p-6 transition-all hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5"
                >
                  <div
                    className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl ${feature.color}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2 font-bold">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">איך זה עובד?</h2>
            <p className="mt-4 text-lg text-muted">שלושה צעדים ואתם בפנים</p>
          </div>
          <div className="mx-auto grid max-w-3xl gap-8 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.num} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-white">
                  {step.num}
                </div>
                <h3 className="mb-2 text-lg font-bold">{step.title}</h3>
                <p className="text-sm text-muted">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-gradient-to-bl from-primary/10 via-background to-accent/5 py-20">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            מוכנים לעשות סדר בבית?
          </h2>
          <p className="mt-4 text-lg text-muted">
            הצטרפו עכשיו בחינם. בלי כרטיס אשראי.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-primary/25 hover:bg-primary-dark transition-all"
          >
            יאללה, בואו נתחיל
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white">
              <Home className="h-3.5 w-3.5" />
            </div>
            <span className="font-semibold text-foreground">בית</span>
          </div>
          <p>© 2026 בית. כל הזכויות שמורות.</p>
        </div>
      </footer>
    </div>
  );
}
