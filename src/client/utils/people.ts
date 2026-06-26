import type { Participant } from "../../shared/types";
export {
  familyTypes,
  formatAbsentMembers,
  genders,
  hasSecondChild,
  hasSecondParent,
  hasThirdParent,
  inferFamilyType,
  isIndependentCamp,
  listAttendanceMembers,
  peopleGroups,
  roomTypes
} from "../../shared/people";

export function includesKeyword(values: string[], keyword: string) {
  const text = keyword.trim().toLowerCase();
  if (!text) return true;
  return values.some((value) => value.toLowerCase().includes(text));
}

export function sortBySequence<T extends { sequence: string }>(items: T[]) {
  return [...items].sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
}

export function parentNames(item: Participant) {
  return [item.parent1Name, item.parent2Name, item.parent3Name].filter(Boolean).join(" / ") || "-";
}

export function parentPhones(item: Participant) {
  return [item.parent1Phone, item.parent2Phone, item.parent3Phone].filter(Boolean).join(" / ") || "-";
}

export function childNames(item: Participant) {
  return [item.childName, item.child2Name].filter(Boolean).join(" / ") || "-";
}
