import { api } from './client';
import type {
    Area,
    InboxItem,
    LoginResponse,
    Note,
    Project,
    Tag,
    Task,
} from '../types/tududi';

export interface PaginatedList<T> {
    items?: T[];
    total?: number;
}

function coerceList<T>(data: unknown, key?: string): T[] {
    if (Array.isArray(data)) return data as T[];
    if (data && typeof data === 'object') {
        if (key && key in data) {
            const v = (data as Record<string, unknown>)[key];
            if (Array.isArray(v)) return v as T[];
        }
        const obj = data as Record<string, unknown>;
        for (const candidate of ['items', 'data', 'results']) {
            if (Array.isArray(obj[candidate])) return obj[candidate] as T[];
        }
    }
    return [];
}

export const auth = {
    login: (email: string, password: string) =>
        api.post<LoginResponse>('/login', { email, password }, { public: true }),
    logout: () => api.post<void>('/logout'),
    currentUser: () => api.get<{ user: LoginResponse['user'] }>('/current_user'),
    createApiKey: (name: string) =>
        api.post<{ key: string; name: string; id: number }>('/api_keys', { name }),
};

export interface TaskListParams {
    status?: 'pending' | 'completed' | 'archived' | 'all';
    filter?: 'today' | 'upcoming' | 'someday' | 'completed';
    project_id?: number;
    tag?: string;
    updated_since?: string;
    limit?: number;
    offset?: number;
    order_by?: 'name' | 'due_date' | 'created_at' | 'priority';
    direction?: 'asc' | 'desc';
    [key: string]: string | number | boolean | null | undefined;
}

export const tasks = {
    list: async (params: TaskListParams = {}): Promise<Task[]> => {
        const data = await api.get<unknown>('/tasks', { query: params });
        return coerceList<Task>(data, 'tasks');
    },
    get: (id: number | string) => api.get<{ task: Task } | Task>(`/task/${id}`),
    create: (input: Partial<Task>) => api.post<Task>('/task', input),
    update: (id: number | string, input: Partial<Task>) =>
        api.patch<Task>(`/task/${id}`, input),
    complete: (id: number | string) =>
        api.patch<Task>(`/task/${id}`, { status: 'completed' }),
    delete: (id: number | string) => api.delete<void>(`/task/${id}`),
    toggle: (id: number | string, completed: boolean) =>
        api.patch<Task>(`/task/${id}`, { status: completed ? 'completed' : 'pending' }),
    subtasks: async (parentId: number | string): Promise<Task[]> => {
        const data = await api.get<unknown>(`/task/${parentId}/subtasks`);
        return coerceList<Task>(data, 'subtasks');
    },
};

export const projects = {
    list: async (params: { updated_since?: string } = {}): Promise<Project[]> => {
        const data = await api.get<unknown>('/projects', { query: params });
        return coerceList<Project>(data, 'projects');
    },
    get: (id: number | string) => api.get<{ project: Project } | Project>(`/project/${id}`),
    create: (input: Partial<Project>) => api.post<Project>('/project', input),
    update: (id: number | string, input: Partial<Project>) =>
        api.patch<Project>(`/project/${id}`, input),
    delete: (id: number | string) => api.delete<void>(`/project/${id}`),
};

export const areas = {
    list: async (): Promise<Area[]> => {
        const data = await api.get<unknown>('/areas');
        return coerceList<Area>(data, 'areas');
    },
    get: (id: number | string) => api.get<{ area: Area } | Area>(`/area/${id}`),
    create: (input: Partial<Area>) => api.post<Area>('/area', input),
    update: (id: number | string, input: Partial<Area>) =>
        api.patch<Area>(`/area/${id}`, input),
    delete: (id: number | string) => api.delete<void>(`/area/${id}`),
};

export const notes = {
    list: async (): Promise<Note[]> => {
        const data = await api.get<unknown>('/notes');
        return coerceList<Note>(data, 'notes');
    },
    get: (id: number | string) => api.get<{ note: Note } | Note>(`/note/${id}`),
    create: (input: Partial<Note>) => api.post<Note>('/note', input),
    update: (id: number | string, input: Partial<Note>) =>
        api.patch<Note>(`/note/${id}`, input),
    delete: (id: number | string) => api.delete<void>(`/note/${id}`),
};

export const tags = {
    list: async (): Promise<Tag[]> => {
        const data = await api.get<unknown>('/tags');
        return coerceList<Tag>(data, 'tags');
    },
    create: (input: Partial<Tag>) => api.post<Tag>('/tag', input),
    update: (id: number | string, input: Partial<Tag>) =>
        api.patch<Tag>(`/tag/${id}`, input),
    delete: (id: number | string) => api.delete<void>(`/tag/${id}`),
};

export const inbox = {
    list: async (): Promise<InboxItem[]> => {
        const data = await api.get<unknown>('/inbox');
        return coerceList<InboxItem>(data, 'inbox');
    },
    create: (content: string) => api.post<InboxItem>('/inbox', { content }),
    update: (id: number | string, input: Partial<InboxItem>) =>
        api.patch<InboxItem>(`/inbox/${id}`, input),
    delete: (id: number | string) => api.delete<void>(`/inbox/${id}`),
    process: (id: number | string, as: 'task' | 'note' | 'project', payload?: unknown) =>
        api.post<unknown>(`/inbox/${id}/process`, { as, payload }),
};

export const search = {
    global: (q: string) => api.get<unknown>('/search', { query: { q } }),
};

export const endpoints = { auth, tasks, projects, areas, notes, tags, inbox, search };
