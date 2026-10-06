/**
 * Safely escapes all special regular expression metacharacters in a string.
 * Prevents ReDoS and regex syntax errors when constructing dynamic MongoDB $regex queries.
 */
export const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
