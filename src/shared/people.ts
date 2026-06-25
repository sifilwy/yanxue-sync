export const peopleGroups = ["一团", "二团", "三团", "四团"];
export const familyTypes = ["独立营", "1大1小", "1大2小", "2大1小", "2大2小", "3大1小", "3大2小"] as const;
export const roomTypes = ["大床", "标间", "亲子房", "其他"];
export const genders = ["男", "女"];

export type FamilyType = typeof familyTypes[number];

export function isFamilyType(value: string): value is FamilyType {
  return (familyTypes as readonly string[]).includes(value);
}

export function hasSecondParent(familyType: string) {
  return familyType.startsWith("2大") || familyType.startsWith("3大");
}

export function hasThirdParent(familyType: string) {
  return familyType.startsWith("3大");
}

export function hasSecondChild(familyType: string) {
  return familyType.endsWith("2小");
}

export function isIndependentCamp(familyType: string) {
  return familyType === "独立营";
}

export function inferFamilyType(input: {
  familyType?: string;
  parent2Name?: string;
  parent2IdCard?: string;
  parent2Phone?: string;
  parent3Name?: string;
  parent3IdCard?: string;
  parent3Phone?: string;
  child2Name?: string;
  child2IdCard?: string;
  child2Gender?: string;
  child2Height?: string;
  child2Weight?: string;
  child2Size?: string;
}) {
  if (input.familyType && isFamilyType(input.familyType)) return input.familyType;

  const hasParent2 = Boolean(input.parent2Name || input.parent2IdCard || input.parent2Phone);
  const hasParent3 = Boolean(input.parent3Name || input.parent3IdCard || input.parent3Phone);
  const hasChild2 = Boolean(
    input.child2Name ||
    input.child2IdCard ||
    input.child2Gender ||
    input.child2Height ||
    input.child2Weight ||
    input.child2Size
  );

  if (hasParent3 && hasChild2) return "3大2小";
  if (hasParent3) return "3大1小";
  if (hasParent2 && hasChild2) return "2大2小";
  if (hasParent2) return "2大1小";
  if (hasChild2) return "1大2小";
  return "1大1小";
}
