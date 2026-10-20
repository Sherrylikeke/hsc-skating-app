import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const coachAssignments = sqliteTable('coach_assignments', {
  skaterId: text('skater_id').primaryKey(),
  coach: text('coach').notNull().default(''),
  revision: integer('revision').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
});
export const appMeta = sqliteTable('app_meta',{key:text('key').primaryKey(),value:text('value').notNull()});
export const historyRecords = sqliteTable('history_records',{id:text('id').primaryKey(),eventId:text('event_id').notNull(),payload:text('payload').notNull()});
export const historyEvents = sqliteTable('history_events',{id:text('id').primaryKey(),payload:text('payload').notNull()});
export const liveEvents = sqliteTable('live_events',{id:text('id').primaryKey(),payload:text('payload').notNull(),updatedAt:text('updated_at').notNull()});
export const sourceRevisions = sqliteTable('source_revisions',{id:text('id').primaryKey(),eventId:text('event_id').notNull(),kind:text('kind').notNull(),url:text('url').notNull(),hash:text('hash').notNull(),checkedAt:text('checked_at').notNull()});
export const coachPlans = sqliteTable('coach_plans',{id:text('id').primaryKey(),skaterId:text('skater_id').notNull(),eventId:text('event_id').notNull(),meetingTime:text('meeting_time').notNull().default(''),note:text('note').notNull().default(''),revision:integer('revision').notNull().default(1)});
