import type { Participant } from "../../shared/types";

export const peopleGroups = ["一团", "二团", "三团", "四团"];
export const familyTypes = ["1大1小", "1大2小", "2大1小", "2大2小"];
export const roomTypes = ["大床", "标间", "亲子房", "其他"];
export const genders = ["男", "女"];

export function hasSecondParent(familyType: string) {
  return familyType.startsWith("2大");
}

export function hasSecondChild(familyType: string) {
  return familyType.endsWith("2小");
}

export function includesKeyword(values: string[], keyword: string) {
  const text = keyword.trim().toLowerCase();
  if (!text) return true;
  return values.some((value) => value.toLowerCase().includes(text));
}

export function sortBySequence<T extends { sequence: string }>(items: T[]) {
  return [...items].sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
}

export function parentNames(item: Participant) {
  return [item.parent1Name, item.parent2Name].filter(Boolean).join(" / ") || "-";
}

export function parentPhones(item: Participant) {
  return [item.parent1Phone, item.parent2Phone].filter(Boolean).join(" / ") || "-";
}

export function childNames(item: Participant) {
  return [item.childName, item.child2Name].filter(Boolean).join(" / ") || "-";
}
