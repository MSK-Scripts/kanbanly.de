'use client';
import { useEffect } from 'react';
import { useBoard, type MemberProfile } from '@/store/boardStore';
import Board from './Board';
import { CardModal } from './CardModal';

type Props = {
  boardId: string;
  initialLists: Array<{ id: string; title: string; position: number }>;
  initialCards: Array<{
    id: string;
    list_id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    position: number;
  }>;
  initialTasks: Array<{
    id: string;
    card_id: string;
    title: string;
    done: boolean;
    position: number;
  }>;
  initialAssignees: Array<{ card_id: string; user_id: string }>;
  initialMembers: MemberProfile[];
  initialLabels: Array<{
    id: string;
    name: string;
    color: string;
    created_at: string;
  }>;
  initialCardLabels: Array<{ card_id: string; label_id: string }>;
};

export function BoardClient({
  boardId,
  initialLists,
  initialCards,
  initialTasks,
  initialAssignees,
  initialMembers,
  initialLabels,
  initialCardLabels,
}: Props) {
  const hydrate = useBoard((s) => s.hydrate);

  useEffect(() => {
    hydrate(
      boardId,
      initialLists,
      initialCards,
      initialTasks,
      initialAssignees,
      initialMembers,
      initialLabels,
      initialCardLabels
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  return (
    <>
      <Board />
      <CardModal />
    </>
  );
}
