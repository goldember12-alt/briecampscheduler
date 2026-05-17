import type { Activity, CamperActivityRule, CamperActivityRuleType } from "@prisma/client";

export type RuleDecision = {
  blocked: boolean;
  message?: string;
  rule?: CamperActivityRule;
};

const dayOrDatePattern = /\b(mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/i;

export function classifyChecklistValue(rawValue: string): CamperActivityRuleType {
  const value = rawValue.trim();
  if (/^no\b/i.test(value) || /\bno\s+(horses?|canoes?|ropes?)\b/i.test(value)) {
    return "exclude";
  }

  if (/waiver|review|do not discuss|decision/i.test(value)) {
    return "requires_review";
  }

  if (dayOrDatePattern.test(value)) {
    return "preassigned_or_signed_up";
  }

  return "note";
}

export function activityFamily(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes("horse")) {
    return "horses";
  }
  if (normalized.includes("canoe")) {
    return "canoes";
  }
  if (normalized.includes("rope")) {
    return "high ropes";
  }
  return normalized.replace(/[^a-z0-9]+/g, " ").trim();
}

export function ruleAppliesToActivity(rule: CamperActivityRule, activity: Activity): boolean {
  if (rule.activityId && rule.activityId === activity.id) {
    return true;
  }

  const activityKey = activityFamily(activity.activityFamily || activity.name);
  const ruleFamilyKey = activityFamily(rule.activityFamily || rule.activityNameRaw);
  const ruleColumnKey = activityFamily(rule.activityNameRaw);

  return activityKey === ruleFamilyKey || activityKey === ruleColumnKey;
}

export function camperRuleDecision(rules: CamperActivityRule[], activity: Activity): RuleDecision {
  const relevantRules = rules.filter((rule) => ruleAppliesToActivity(rule, activity));
  const exclusion = relevantRules.find((rule) => rule.ruleType === "exclude");
  if (exclusion) {
    return {
      blocked: true,
      message: "Camper is excluded from this activity.",
      rule: exclusion
    };
  }

  const review = relevantRules.find((rule) => rule.ruleType === "requires_review");
  if (review) {
    return {
      blocked: true,
      message: "Camper requires review before assignment to this activity.",
      rule: review
    };
  }

  return { blocked: false };
}
