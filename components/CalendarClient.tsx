'use client';
import { type MemberProfile } from '@/store/boardStore';
import type { Automation } from '@/lib/automations';
import { useBoardSync } from '@/lib/useBoardSync';
import { Calendar } from './Calendar';
import { CardModal } from './CardModal';

type Props = {
  boardId: string;
  initialLists: Array<{
    id: string;
    title: string;
    position: number;
    wip_limit: number | null;
  }>;
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
  initialAutomations: Automation[];
};

export function CalendarClient(props: Props) {
  useBoardSync(props);

  return (
    <>
      <Calendar />
      <CardModal />
    </>
  );
}
