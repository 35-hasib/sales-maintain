const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
function toBn(str: string): string {
  return str.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

export function formatTaka(value: string | number | null | undefined): string {
  const num = value === null || value === undefined || value === "" ? 0 : Number(value);
  const fixed = num.toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const last3 = intPart.length > 3 ? intPart.slice(-3) : intPart;
  let rest = intPart.length > 3 ? intPart.slice(0, -3) : "";
  const groups = [last3];
  while (rest.length > 0) {
    const chunk = rest.slice(-2);
    groups.unshift(chunk);
    rest = rest.slice(0, -2);
  }
  return `৳${toBn(groups.join(","))}.${toBn(decPart)}`;
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  const d = new Date(dateString);
  const day = d.getDate();
  const month = d.toLocaleDateString("bn-BD", { month: "short" });
  const year = d.getFullYear();
  return `${toBn(String(day))} ${month} ${toBn(String(year))}`;
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "বাকি",
    partially_collected: "আংশিক আদায়",
    fully_collected: "সম্পূর্ণ আদায়",
    partially_disbursed: "আংশিক পরিশোধ",
    settled: "সম্পন্ন",
    cancelled: "বাতিল",
  };
  return map[status] ?? status;
}
