'use client';
import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';

export type TaskT = { id: string; title: string; done: boolean };
export type CardT = {
  id: string;
  title: string;
  description: string | null;
  tasks: TaskT[];
};
export type ListT = { id: string; title: string; cardIds: string[] };

type RawList = { id: string; title: string; position: number };
type RawCard = {
  id: string;
  list_id: string;
  title: string;
  description: string | null;
  position: number;
};
type RawTask = {
  id: string;
  card_id: string;
  title: string;
  done: boolean;
  position: number;
};

type RawAssignee = { card_id: string; user_id: string };

export type MemberProfile = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  role: string;
};

type State = {
  boardId: string | null;
  lists: Record<string, ListT>;
  cards: Record<string, CardT>;
  listOrder: string[];

  assignees: Record<string, string[]>;
  memberProfiles: Record<string, MemberProfile>;
  memberOrder: string[];

  openCardId: string | null;
  setOpenCardId: (id: string | null) => void;

  hydrate: (
    boardId: string,
    lists: RawList[],
    cards: RawCard[],
    tasks: RawTask[],
    assignees: RawAssignee[],
    members: MemberProfile[]
  ) => void;

  toggleAssignee: (cardId: string, userId: string) => Promise<void>;

  addList: (title: string) => Promise<void>;
  renameList: (listId: string, title: string) => Promise<void>;
  addCard: (listId: string, title: string) => Promise<void>;
  moveCard: (
    source: { listId: string; index: number },
    destination: { listId: string; index: number }
  ) => Promise<void>;
  updateCardTitle: (cardId: string, title: string) => Promise<void>;
  updateCardDescription: (
    cardId: string,
    description: string | null
  ) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;

  addTask: (cardId: string, title: string) => Promise<void>;
  toggleTask: (cardId: string, taskId: string) => Promise<void>;
  deleteTask: (cardId: string, taskId: string) => Promise<void>;
};

export const useBoard = create<State>((set, get) => ({
  boardId: null,
  lists: {},
  cards: {},
  listOrder: [],
  assignees: {},
  memberProfiles: {},
  memberOrder: [],
  openCardId: null,

  setOpenCardId: (id) => set({ openCardId: id }),

  hydrate(boardId, rawLists, rawCards, rawTasks, rawAssignees, members) {
    const listsObj: Record<string, ListT> = {};
    const cardsObj: Record<string, CardT> = {};

    const sortedLists = [...rawLists].sort((a, b) => a.position - b.position);
    const listOrder = sortedLists.map((l) => l.id);

    for (const l of sortedLists) {
      const listCards = rawCards
        .filter((c) => c.list_id === l.id)
        .sort((a, b) => a.position - b.position);
      listsObj[l.id] = {
        id: l.id,
        title: l.title,
        cardIds: listCards.map((c) => c.id),
      };
    }

    for (const c of rawCards) {
      const cardTasks = rawTasks
        .filter((t) => t.card_id === c.id)
        .sort((a, b) => a.position - b.position)
        .map((t) => ({ id: t.id, title: t.title, done: t.done }));
      cardsObj[c.id] = {
        id: c.id,
        title: c.title,
        description: c.description,
        tasks: cardTasks,
      };
    }

    const assigneesObj: Record<string, string[]> = {};
    for (const a of rawAssignees) {
      if (!assigneesObj[a.card_id]) assigneesObj[a.card_id] = [];
      assigneesObj[a.card_id].push(a.user_id);
    }

    const memberProfilesObj: Record<string, MemberProfile> = {};
    const memberOrder: string[] = [];
    for (const m of members) {
      memberProfilesObj[m.user_id] = m;
      memberOrder.push(m.user_id);
    }

    set({
      boardId,
      lists: listsObj,
      cards: cardsObj,
      listOrder,
      assignees: assigneesObj,
      memberProfiles: memberProfilesObj,
      memberOrder,
    });
  },

  async toggleAssignee(cardId, userId) {
    const current = get().assignees[cardId] ?? [];
    const isAssigned = current.includes(userId);

    set((state) => ({
      assignees: {
        ...state.assignees,
        [cardId]: isAssigned
          ? current.filter((id) => id !== userId)
          : [...current, userId],
      },
    }));

    const supabase = createClient();
    if (isAssigned) {
      const { error } = await supabase
        .from('card_assignees')
        .delete()
        .eq('card_id', cardId)
        .eq('user_id', userId);
      if (error) console.error('toggleAssignee remove', error);
    } else {
      const { error } = await supabase
        .from('card_assignees')
        .insert({ card_id: cardId, user_id: userId });
      if (error) console.error('toggleAssignee add', error);
    }
  },

  async addList(title) {
    const { boardId, listOrder } = get();
    if (!boardId) return;
    const id = crypto.randomUUID();
    const position = listOrder.length;

    set((state) => ({
      lists: { ...state.lists, [id]: { id, title, cardIds: [] } },
      listOrder: [...state.listOrder, id],
    }));

    const supabase = createClient();
    const { error } = await supabase
      .from('lists')
      .insert({ id, board_id: boardId, title, position });
    if (error) console.error('addList', error);
  },

  async renameList(listId, title) {
    const list = get().lists[listId];
    if (!list) return;
    const trimmed = title.trim();
    if (!trimmed || trimmed === list.title) return;

    set((state) => ({
      lists: {
        ...state.lists,
        [listId]: { ...list, title: trimmed },
      },
    }));

    const supabase = createClient();
    const { error } = await supabase
      .from('lists')
      .update({ title: trimmed })
      .eq('id', listId);
    if (error) console.error('renameList', error);
  },

  async addCard(listId, title) {
    const list = get().lists[listId];
    if (!list) return;
    const id = crypto.randomUUID();
    const position = list.cardIds.length;

    set((state) => ({
      cards: {
        ...state.cards,
        [id]: { id, title, description: null, tasks: [] },
      },
      lists: {
        ...state.lists,
        [listId]: { ...list, cardIds: [...list.cardIds, id] },
      },
    }));

    const supabase = createClient();
    const { error } = await supabase
      .from('cards')
      .insert({ id, list_id: listId, title, position });
    if (error) console.error('addCard', error);
  },

  async moveCard(source, destination) {
    const state = get();
    const srcList = state.lists[source.listId];
    const dstList = state.lists[destination.listId];
    if (!srcList || !dstList) return;

    const srcCardIds = [...srcList.cardIds];
    const [moved] = srcCardIds.splice(source.index, 1);
    if (moved === undefined) return;

    let newLists: Record<string, ListT>;
    if (source.listId === destination.listId) {
      srcCardIds.splice(destination.index, 0, moved);
      newLists = {
        ...state.lists,
        [source.listId]: { ...srcList, cardIds: srcCardIds },
      };
    } else {
      const dstCardIds = [...dstList.cardIds];
      dstCardIds.splice(destination.index, 0, moved);
      newLists = {
        ...state.lists,
        [source.listId]: { ...srcList, cardIds: srcCardIds },
        [destination.listId]: { ...dstList, cardIds: dstCardIds },
      };
    }

    set({ lists: newLists });

    const supabase = createClient();
    const affectedListIds =
      source.listId === destination.listId
        ? [source.listId]
        : [source.listId, destination.listId];

    const promises: PromiseLike<unknown>[] = [];
    for (const listId of affectedListIds) {
      const list = newLists[listId];
      if (!list) continue;
      list.cardIds.forEach((cardId, idx) => {
        promises.push(
          supabase
            .from('cards')
            .update({ list_id: listId, position: idx })
            .eq('id', cardId)
        );
      });
    }
    await Promise.all(promises);
  },

  async updateCardTitle(cardId, title) {
    const card = get().cards[cardId];
    if (!card) return;
    const trimmed = title.trim();
    if (!trimmed || trimmed === card.title) return;

    set((state) => ({
      cards: {
        ...state.cards,
        [cardId]: { ...card, title: trimmed },
      },
    }));

    const supabase = createClient();
    const { error } = await supabase
      .from('cards')
      .update({ title: trimmed })
      .eq('id', cardId);
    if (error) console.error('updateCardTitle', error);
  },

  async updateCardDescription(cardId, description) {
    const card = get().cards[cardId];
    if (!card) return;
    const next = description && description.trim() ? description : null;
    if ((next ?? '') === (card.description ?? '')) return;

    set((state) => ({
      cards: {
        ...state.cards,
        [cardId]: { ...card, description: next },
      },
    }));

    const supabase = createClient();
    const { error } = await supabase
      .from('cards')
      .update({ description: next })
      .eq('id', cardId);
    if (error) console.error('updateCardDescription', error);
  },

  async deleteCard(cardId) {
    const state = get();
    const card = state.cards[cardId];
    if (!card) return;

    let targetListId: string | null = null;
    for (const [lid, list] of Object.entries(state.lists)) {
      if (list.cardIds.includes(cardId)) {
        targetListId = lid;
        break;
      }
    }

    set((s) => {
      const newCards = { ...s.cards };
      delete newCards[cardId];
      const newAssignees = { ...s.assignees };
      delete newAssignees[cardId];
      const newLists = targetListId
        ? {
            ...s.lists,
            [targetListId]: {
              ...s.lists[targetListId],
              cardIds: s.lists[targetListId].cardIds.filter(
                (id) => id !== cardId
              ),
            },
          }
        : s.lists;
      return {
        cards: newCards,
        assignees: newAssignees,
        lists: newLists,
        openCardId: s.openCardId === cardId ? null : s.openCardId,
      };
    });

    const supabase = createClient();
    const { error } = await supabase.from('cards').delete().eq('id', cardId);
    if (error) console.error('deleteCard', error);
  },

  async addTask(cardId, title) {
    const card = get().cards[cardId];
    if (!card) return;
    const id = crypto.randomUUID();
    const position = card.tasks.length;

    set((state) => ({
      cards: {
        ...state.cards,
        [cardId]: {
          ...card,
          tasks: [...card.tasks, { id, title, done: false }],
        },
      },
    }));

    const supabase = createClient();
    const { error } = await supabase
      .from('tasks')
      .insert({ id, card_id: cardId, title, position });
    if (error) console.error('addTask', error);
  },

  async toggleTask(cardId, taskId) {
    const card = get().cards[cardId];
    if (!card) return;
    const task = card.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newDone = !task.done;

    set((state) => ({
      cards: {
        ...state.cards,
        [cardId]: {
          ...card,
          tasks: card.tasks.map((t) =>
            t.id === taskId ? { ...t, done: newDone } : t
          ),
        },
      },
    }));

    const supabase = createClient();
    const { error } = await supabase
      .from('tasks')
      .update({ done: newDone })
      .eq('id', taskId);
    if (error) console.error('toggleTask', error);
  },

  async deleteTask(cardId, taskId) {
    const card = get().cards[cardId];
    if (!card) return;

    set((state) => ({
      cards: {
        ...state.cards,
        [cardId]: {
          ...card,
          tasks: card.tasks.filter((t) => t.id !== taskId),
        },
      },
    }));

    const supabase = createClient();
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) console.error('deleteTask', error);
  },
}));
