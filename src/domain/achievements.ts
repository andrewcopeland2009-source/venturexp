export interface AchievementStats {
  /** Distinct lessons completed. */
  lessonsCompleted: number;
  /** Total completions including replays. */
  lessonCompletions: number;
  perfectLessons: number;
  coursesCompleted: number;
  masteredModules: number;
  longestStreak: number;
  totalXp: number;
  cardsReviewed: number;
  simulationsCompleted: number;
  dailyChallenges: number;
  practiceSessions: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold';
  target: number;
  value: (s: AchievementStats) => number;
}

const def = (
  id: string,
  title: string,
  description: string,
  icon: string,
  tier: AchievementDef['tier'],
  target: number,
  value: AchievementDef['value'],
): AchievementDef => ({ id, title, description, icon, tier, target, value });

export const ACHIEVEMENTS: AchievementDef[] = [
  def('first-lesson', 'First Step', 'Complete your first lesson.', 'Footprints', 'bronze', 1, (s) => s.lessonsCompleted),
  def('lessons-5', 'Warming Up', 'Complete 5 different lessons.', 'Flame', 'bronze', 5, (s) => s.lessonsCompleted),
  def('lessons-25', 'Committed', 'Complete 25 different lessons.', 'BookOpenCheck', 'silver', 25, (s) => s.lessonsCompleted),
  def('lessons-100', 'Centurion', 'Finish 100 lessons (replays count).', 'Trophy', 'gold', 100, (s) => s.lessonCompletions),
  def('streak-3', 'Three in a Row', 'Learn on 3 calendar days in a row.', 'CalendarCheck', 'bronze', 3, (s) => s.longestStreak),
  def('streak-7', 'Week Strong', 'Learn on 7 calendar days in a row.', 'CalendarRange', 'silver', 7, (s) => s.longestStreak),
  def('streak-30', 'Habit Formed', 'Learn on 30 calendar days in a row.', 'CalendarHeart', 'gold', 30, (s) => s.longestStreak),
  def('perfect-1', 'Flawless', 'Finish a lesson with every answer right first try.', 'Sparkles', 'bronze', 1, (s) => s.perfectLessons),
  def('perfect-10', 'Precision', 'Get 10 perfect lessons.', 'Gem', 'silver', 10, (s) => s.perfectLessons),
  def('course-1', 'Graduate', 'Complete every lesson in a course.', 'GraduationCap', 'silver', 1, (s) => s.coursesCompleted),
  def('course-3', 'Polymath', 'Complete three courses.', 'Library', 'gold', 3, (s) => s.coursesCompleted),
  def('topic-master', 'Topic Master', 'Get every lesson in a module perfect.', 'Crown', 'silver', 1, (s) => s.masteredModules),
  def('xp-1000', 'Four Digits', 'Earn 1,000 total XP.', 'Zap', 'silver', 1000, (s) => s.totalXp),
  def('cards-1', 'Recall Rookie', 'Review your first flashcard.', 'Layers', 'bronze', 1, (s) => s.cardsReviewed),
  def('cards-100', 'Memory Bank', 'Review 100 flashcards.', 'Brain', 'silver', 100, (s) => s.cardsReviewed),
  def('practice-1', 'Practice Makes Progress', 'Finish a practice session.', 'Dumbbell', 'bronze', 1, (s) => s.practiceSessions),
  def('daily-1', 'Challenge Accepted', 'Complete a daily challenge.', 'Target', 'bronze', 1, (s) => s.dailyChallenges),
  def('sim-1', 'Brand Launcher', 'Finish the Launch a POD Brand simulation.', 'Rocket', 'bronze', 1, (s) => s.simulationsCompleted),
];

export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

/** Ids of achievements whose rule is satisfied by `stats` but which are not yet unlocked. */
export function newlyEarned(stats: AchievementStats, unlocked: Set<string>): string[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.has(a.id) && a.value(stats) >= a.target).map((a) => a.id);
}
