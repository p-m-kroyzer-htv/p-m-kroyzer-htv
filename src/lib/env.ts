export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`חסר משתנה סביבה: ${name}`);
  return value;
}

export function envOr(name: string, fallback: string): string {
  return process.env[name] || fallback;
}
