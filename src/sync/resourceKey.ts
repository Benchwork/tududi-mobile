import {
    areasRepo,
    inboxRepo,
    notesRepo,
    projectsRepo,
    tasksRepo,
} from '../db/repositories';
import type { SyncEntity } from './outbox';

/**
 * Resolve the API path key for update/delete. Tududi 1.2+ routes use server `uid`
 * (not numeric id). Falls back to outbox `resource_uid`, then looks up by id when
 * the local row was already re-keyed after a successful create.
 */
export async function resolveResourceKey(
    entity: SyncEntity,
    resourceUid: string,
    resourceId: number | null
): Promise<string> {
    switch (entity) {
        case 'tasks': {
            let row = await tasksRepo.getByUid(resourceUid);
            if (!row && resourceId) row = await tasksRepo.getById(resourceId);
            if (row?.uid) return row.uid;
            break;
        }
        case 'projects': {
            let row = await projectsRepo.getByUid(resourceUid);
            if (!row && resourceId) row = await projectsRepo.getById(resourceId);
            if (row?.uid) return row.uid;
            break;
        }
        case 'areas': {
            let row = await areasRepo.getByUid(resourceUid);
            if (!row && resourceId) row = await areasRepo.getById(resourceId);
            if (row?.uid) return row.uid;
            break;
        }
        case 'notes': {
            let row = await notesRepo.getByUid(resourceUid);
            if (!row && resourceId) row = await notesRepo.getById(resourceId);
            if (row?.uid) return row.uid;
            break;
        }
        case 'inbox_items': {
            let row = await inboxRepo.getByUid(resourceUid);
            if (!row && resourceId) row = await inboxRepo.getById(resourceId);
            if (row?.uid) return row.uid;
            break;
        }
    }
    return resourceUid;
}
