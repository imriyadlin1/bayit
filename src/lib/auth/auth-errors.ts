export function isAuthRateLimitMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("rate limit") ||
    m.includes("email rate limit") ||
    m.includes("too many requests") ||
    m.includes("too_many_requests") ||
    m.includes("too many") ||
    m.includes("over_email_send") ||
    m.includes("over request") ||
    m.includes("429") ||
    m.includes("exceeded")
  );
}

export function isAuthRateLimitError(err: { message: string; status?: number }): boolean {
  if (typeof err.status === "number" && err.status === 429) return true;
  return isAuthRateLimitMessage(err.message);
}

export function signupErrorToHebrew(message: string): string {
  const m = message.toLowerCase();
  if (isAuthRateLimitMessage(message)) {
    return "כבר שלחנו מייל לאחרונה. חכו כמה דקות ונסו שוב.";
  }
  if (
    m.includes("already registered") ||
    m.includes("already been registered") ||
    m.includes("user already") ||
    m.includes("email address is already")
  ) {
    return "האימייל הזה כבר רשום. נסו להתחבר.";
  }
  if (m.includes("password") && (m.includes("least") || m.includes("short") || m.includes("weak"))) {
    return "הסיסמה קצרה מדי. צריך לפחות 6 תווים.";
  }
  if (m.includes("invalid") && m.includes("email")) {
    return "כתובת האימייל לא תקינה. בדקו הקלדה.";
  }
  return "משהו השתבש. נסו שוב בעוד רגע.";
}

export function loginErrorToHebrew(message: string): string {
  const m = message.toLowerCase();
  if (isAuthRateLimitMessage(message)) {
    return "כבר שלחנו מייל לאחרונה. חכו כמה דקות ונסו שוב.";
  }
  if (
    m.includes("email not confirmed") ||
    m.includes("email_not_confirmed") ||
    m.includes("not confirmed") ||
    m.includes("confirm your email")
  ) {
    return "עדיין לא אישרתם את המייל. בדקו את התיבה (גם ספאם), לחצו על הקישור, ואז נסו שוב.";
  }
  if (
    m.includes("invalid login") ||
    m.includes("invalid credentials") ||
    m.includes("invalid_grant") ||
    m.includes("wrong password") ||
    m.includes("invalid password")
  ) {
    return "אימייל או סיסמה לא מתאימים. בדקו שוב.";
  }
  if (m.includes("invalid") && m.includes("email")) {
    return "כתובת האימייל לא תקינה.";
  }
  return "לא הצלחנו להתחבר. נסו שוב.";
}

export function resendErrorToHebrew(message: string): string {
  if (isAuthRateLimitMessage(message)) {
    return "בדקו את המייל שכבר שלחנו. אפשר לבקש חדש בעוד כמה דקות.";
  }
  return "לא הצלחנו לשלוח עכשיו. נסו שוב בעוד רגע.";
}
