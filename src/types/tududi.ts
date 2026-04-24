import { z } from 'zod';

export const TaskStatus = z.enum(['pending', 'completed', 'archived']);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const Priority = z.enum(['low', 'medium', 'high']);
export type Priority = z.infer<typeof Priority>;

export const ProjectStatus = z.enum([
    'not_started',
    'planned',
    'in_progress',
    'waiting',
    'done',
    'cancelled',
]);
export type ProjectStatus = z.infer<typeof ProjectStatus>;

export const RecurringPattern = z.enum([
    'daily',
    'weekly',
    'monthly',
    'monthly_weekday',
    'monthly_last_day',
    'yearly',
]);
export type RecurringPattern = z.infer<typeof RecurringPattern>;

const isoDate = z.string().datetime({ offset: true }).or(z.string());

export const TagSchema = z.object({
    id: z.number(),
    uid: z.string().optional(),
    name: z.string(),
    created_at: isoDate.optional(),
    updated_at: isoDate.optional(),
});
export type Tag = z.infer<typeof TagSchema>;

export const AreaSchema = z.object({
    id: z.number(),
    uid: z.string().optional(),
    name: z.string(),
    description: z.string().nullable().optional(),
    created_at: isoDate.optional(),
    updated_at: isoDate.optional(),
});
export type Area = z.infer<typeof AreaSchema>;

export const ProjectSchema = z.object({
    id: z.number(),
    uid: z.string().optional(),
    name: z.string(),
    description: z.string().nullable().optional(),
    status: ProjectStatus.optional(),
    priority: Priority.nullable().optional(),
    area_id: z.number().nullable().optional(),
    pin_to_sidebar: z.boolean().optional(),
    active: z.boolean().optional(),
    tags: z.array(TagSchema).optional(),
    created_at: isoDate.optional(),
    updated_at: isoDate.optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

const TaskCoreSchema = z.object({
    id: z.number(),
    uid: z.string().optional(),
    name: z.string(),
    note: z.string().nullable().optional(),
    status: TaskStatus.optional(),
    priority: Priority.nullable().optional(),
    due_date: isoDate.nullable().optional(),
    project_id: z.number().nullable().optional(),
    parent_task_id: z.number().nullable().optional(),
    recurring_pattern: RecurringPattern.nullable().optional(),
    recurring_interval: z.number().nullable().optional(),
    recurring_end_date: isoDate.nullable().optional(),
    recurring_weekday: z.number().nullable().optional(),
    recurring_week_of_month: z.number().nullable().optional(),
    recurrence_completion_based: z.boolean().optional(),
    completed_at: isoDate.nullable().optional(),
    tags: z.array(TagSchema).optional(),
    created_at: isoDate.optional(),
    updated_at: isoDate.optional(),
});

export type Task = z.infer<typeof TaskCoreSchema> & {
    subtasks?: Task[];
};

export const TaskSchema: z.ZodType<Task> = TaskCoreSchema.extend({
    subtasks: z.lazy(() => z.array(TaskSchema)).optional(),
});

export const NoteSchema = z.object({
    id: z.number(),
    uid: z.string().optional(),
    title: z.string().nullable().optional(),
    content: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    project_id: z.number().nullable().optional(),
    tags: z.array(TagSchema).optional(),
    created_at: isoDate.optional(),
    updated_at: isoDate.optional(),
});
export type Note = z.infer<typeof NoteSchema>;

export const InboxItemSchema = z.object({
    id: z.number(),
    uid: z.string().optional(),
    content: z.string(),
    status: z.enum(['added', 'processed', 'ignored']).optional(),
    source: z.string().nullable().optional(),
    created_at: isoDate.optional(),
    updated_at: isoDate.optional(),
});
export type InboxItem = z.infer<typeof InboxItemSchema>;

export const LoginResponseSchema = z.object({
    user: z
        .object({
            id: z.number(),
            email: z.string().email().optional(),
            name: z.string().nullable().optional(),
            is_admin: z.boolean().optional(),
        })
        .passthrough(),
    token: z.string().optional(),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const VersionResponseSchema = z.object({
    version: z.string().optional(),
    api_version: z.string().optional(),
});

export const HealthResponseSchema = z.object({
    status: z.string(),
    timestamp: z.string().optional(),
});

export type ApiEntity = 'tasks' | 'projects' | 'areas' | 'notes' | 'tags' | 'inbox_items';

export const TaskFilter = z.enum(['today', 'upcoming', 'someday', 'completed', 'all']);
export type TaskFilter = z.infer<typeof TaskFilter>;

export const TaskSort = z.enum(['name', 'due_date', 'created_at', 'priority']);
export type TaskSort = z.infer<typeof TaskSort>;
