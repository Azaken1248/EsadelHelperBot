import * as chrono from "chrono-node";

export const parseNaturalDate = (input: string): Date | null => {
  const parsedDate = chrono.parseDate(input);
  if (parsedDate) {
    return parsedDate;
  }

  const fallbackDate = new Date(input);
  if (!isNaN(fallbackDate.getTime())) {
    return fallbackDate;
  }

  return null;
};
