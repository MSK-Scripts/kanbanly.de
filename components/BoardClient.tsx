'use client';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useBoard, type MemberProfile } from '@/store/boardStore';
import { useBoardSync } from '@/lib/useBoardSync';
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

export function BoardClient(props: Props) {
  useBoardSync(props);
  const searchParams = useSearchParams();
  const cardFromUrl = searchParams.get('card');
  const setOpenCardId = useBoard((s) => s.setOpenCardId);

  useEffect(() => {
    if (!cardFromUrl) return;
    const handle = setTimeout(() => {
      const state = useBoard.getState();
      if (state.cards[cardFromUrl]) {
        setOpenCardId(cardFromUrl);
      }
    }, 50);
    return () => clearTimeout(handle);
  }, [cardFromUrl, setOpenCardId]);

  return (
    <>
      <Board />
      <CardModal />
    </>
  );
}
