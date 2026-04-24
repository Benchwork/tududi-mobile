import { useQuery } from '@tanstack/react-query';
import { tagsRepo } from '../../db/repositories';

export function useTags() {
    return useQuery({
        queryKey: ['tags', 'list'],
        queryFn: () => tagsRepo.list(),
    });
}
