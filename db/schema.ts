import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const coachAssignments = sqliteTable('coach_assignments', {
  skaterId: text('skater_id').primaryKey(),
  coach: text('coach').notNull().default(''),
  revision: integer('revision').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
});
