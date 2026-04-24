import { useEffect, useMemo, useState } from 'react';
import {
    notesRepo,
    projectsRepo,
    tasksRepo,
    areasRepo,
} from '../../db/repositories';
import type { Area, Note, Project, Task } from '../../types/tududi';

export interface SearchResults {
    tasks: Task[];
    projects: Project[];
    notes: Note[];
    areas: Area[];
}

const EMPTY: SearchResults = { tasks: [], projects: [], notes: [], areas: [] };

/**
 * Local fuzzy search over cached SQLite data. Works fully offline.
 */
export function useLocalSearch(query: string): {
    results: SearchResults;
    loading: boolean;
} {
    const trimmed = query.trim();
    const [results, setResults] = useState<SearchResults>(EMPTY);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        if (trimmed.length < 2) {
            setResults(EMPTY);
            setLoading(false);
            return;
        }
        setLoading(true);
        void (async () => {
            try {
                const [allTasks, allProjects, allNotes, allAreas] = await Promise.all([
                    tasksRepo.list({ filter: 'all', search: trimmed }),
                    projectsRepo.list(),
                    notesRepo.list(),
                    areasRepo.list(),
                ]);
                if (cancelled) return;
                const q = trimmed.toLowerCase();
                setResults({
                    tasks: allTasks.slice(0, 50),
                    projects: allProjects
                        .filter(
                            (p) =>
                                p.name.toLowerCase().includes(q) ||
                                p.description?.toLowerCase().includes(q)
                        )
                        .slice(0, 20),
                    notes: allNotes
                        .filter(
                            (n) =>
                                n.title?.toLowerCase().includes(q) ||
                                n.content?.toLowerCase().includes(q)
                        )
                        .slice(0, 20),
                    areas: allAreas
                        .filter(
                            (a) =>
                                a.name.toLowerCase().includes(q) ||
                                a.description?.toLowerCase().includes(q)
                        )
                        .slice(0, 10),
                });
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [trimmed]);

    return useMemo(() => ({ results, loading }), [results, loading]);
}
