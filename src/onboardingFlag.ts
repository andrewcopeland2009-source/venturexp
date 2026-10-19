/**
 * Set synchronously when onboarding finishes, so the route guard doesn't bounce back to
 * /welcome while its live profile query is still catching up with the write.
 */
let justOnboarded = false;
export const markOnboarded = () => {
  justOnboarded = true;
};
export const wasJustOnboarded = () => justOnboarded;
export const resetOnboardedFlag = () => {
  justOnboarded = false;
};
