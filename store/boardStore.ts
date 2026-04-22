'use client';
import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import { notifyBoardEvent } from '@/app/(app)/webhook-actions';

const PULSE_DURATION_MS = 1200;
const PULSE_SUPPRESS_MS = 1500;
const pulseTimers = new Map<string, ReturnType<typeof setTimeout>>();
const suppressUntil = new Map<string, number>();

type ActivityKind =
  | 'created'
  | 'renamed'
  | 'described'
  | 'due_set'
  | 'due_cleared'
  | 'moved'
  | 'assignee_added'
  | 'assignee_removed'
  | 'label_added'
  | 'label_removed'
  | 'task_added'
  | 'task_done'
  | 'task_undone'
  | 'task_deleted';

async function logActivity(
  cardId: string,
  kind: ActivityKind,
  meta?: Record<string, unknown>
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('card_activity').insert({
    card_id: cardId,
    user_id: user.id,
    kind,
    meta: meta ?? null,
  });
  if (error) console.error('logActivity', error);
}

export type TaskT = { id: string; title: string; done: boolean };
export type CardT = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  tasks: TaskT[];
};
export type ListT = { id: string; title: string; cardIds: string[] };

type RawList = { id: string; title: string; position: number };
type RawCard = {
  id: string;
  list_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
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

type RawLabel = {
  id: string;
  name: string;
  color: string;
  created_at: string;
};

type RawCardLabel = { card_id: string; label_id: string };

export type LabelT = { id: string; name: string; color: string };

export type MemberProfile = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  role: string;
};

export type DueBucketFilter =
  | 'all'
  | 'overdue'
  | 'today'
  | 'week'
  | 'later'
  | 'none';

export type BoardFilters = {
  labels: string[];
  assignees: string[];
  due: DueBucketFilter;
};

const EMPTY_FILTERS: BoardFilters = {
  labels: [],
  assignees: [],
  due: 'all',
};

type State = {
  boardId: string | null;
  lists: Record<string, ListT>;
  cards: Record<string, CardT>;
  listOrder: string[];

  assignees: Record<string, string[]>;
  memberProfiles: Record<string, MemberProfile>;
  memberOrder: string[];

  labels: Record<string, LabelT>;
  labelOrder: string[];
  cardLabels: Record<string, string[]>;

  pulsingCards: Record<string, true>;
  suppressPulse: (cardIds: string[]) => void;
  maybePulse: (cardId: string) => void;

  filters: BoardFilters;
  setFilters: (next: Partial<BoardFilters>) => void;
  clearFilters: () => void;

  groupBy: 'none' | 'assignee' | 'label';
  setGroupBy: (g: 'none' | 'assignee' | 'label') => void;

  backgroundUrl: string | null;
  setBackgroundUrl: (url: string | null) => void;
  updateBoardBackground: (url: string | null) => Promise<void>;

  openCardId: string | null;
  setOpenCardId: (id: string | null) => void;

  selectedCardIds: Record<string, true>;
  toggleSelection: (cardId: string) => void;
  clearSelection: () => void;
  bulkDelete: () => Promise<void>;
  bulkMove: (targetListId: string) => Promise<void>;
  bulkToggleLabel: (labelId: string) => Promise<void>;

  hydrate: (
    boardId: string,
    lists: RawList[],
    cards: RawCard[],
    tasks: RawTask[],
    assignees: RawAssignee[],
    members: MemberProfile[],
    labels: RawLabel[],
    cardLabels: RawCardLabel[]
  ) => void;

  toggleAssignee: (cardId: string, userId: string) => Promise<void>;

  createLabel: (name: string, color: string) => Promise<void>;
  deleteLabel: (labelId: string) => Promise<void>;
  toggleCardLabel: (cardId: string, labelId: string) => Promise<void>;

  addList: (title: string) => Promise<void>;
  renameList: (listId: string, title: string) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
  moveList: (fromIndex: number, toIndex: number) => Promise<void>;
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
  updateCardDueDate: (cardId: string, due: string | null) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;

  addTask: (cardId: string, title: string) => Promise<void>;
  toggleTask: (cardId: string, taskId: string) => Promise<void>;
  deleteTask: (cardId: string, taskId: string) => Promise<void>;

  duplicateCard: (cardId: string) => Promise<void>;
};

export const useBoard = create<State>((set, get) => ({
  boardId: null,
  lists: {},
  cards: {},
  listOrder: [],
  assignees: {},
  memberProfiles: {},
  memberOrder: [],
  labels: {},
  labelOrder: [],
  cardLabels: {},
  pulsingCards: {},
  filters: { ...EMPTY_FILTERS },
  openCardId: null,
  selectedCardIds: {},
  groupBy: 'none',
  backgroundUrl: null,

  setGroupBy: (g) => set({ groupBy: g }),
  setBackgroundUrl: (url) => set({ backgroundUrl: url }),

  async updateBoardBackground(url) {
    const bId = get().boardId;
    if (!bId) return;
    const clean = url?.trim() || null;
    if (clean) {
      try {
        const parsed = new URL(clean);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          console.warn('updateBoardBackground: only http(s) URLs allowed');
          return;
        }
      } catch {
        console.warn('updateBoardBackground: invalid URL');
        return;
      }
    }
    set({ backgroundUrl: clean });
    const supabase = createClient();
    const { error } = await supabase
      .from('boards')
      .update({ background_url: clean })
      .eq('id', bId);
    if (error) console.error('updateBoardBackground', error);
  },

  setOpenCardId: (id) => set({ openCardId: id }),

  toggleSelection: (cardId) =>
    set((s) => {
      const next = { ...s.selectedCardIds };
      if (next[cardId]) delete next[cardId];
      else next[cardId] = true;
      return { selectedCardIds: next };
    }),

  clearSelection: () => set({ selectedCardIds: {} }),

  async bulkDelete() {
    const ids = Object.keys(get().selectedCardIds);
    if (ids.length === 0) return;

    set((s) => {
      const newCards = { ...s.cards };
      const newAssignees = { ...s.assignees };
      const newCardLabels = { ...s.cardLabels };
      for (const id of ids) {
        delete newCards[id];
        delete newAssignees[id];
        delete newCardLabels[id];
      }
      const newLists: Record<string, ListT> = {};
      for (const [lid, list] of Object.entries(s.lists)) {
        newLists[lid] = {
          ...list,
          cardIds: list.cardIds.filter((cid) => !ids.includes(cid)),
        };
      }
      return {
        cards: newCards,
        assignees: newAssignees,
        cardLabels: newCardLabels,
        lists: newLists,
        selectedCardIds: {},
        openCardId: ids.includes(s.openCardId ?? '') ? null : s.openCardId,
      };
    });

    const supabase = createClient();
    await supabase.from('cards').delete().in('id', ids);
  },

  async bulkMove(targetListId) {
    const state = get();
    const ids = Object.keys(state.selectedCardIds);
    if (ids.length === 0) return;
    const target = state.lists[targetListId];
    if (!target) return;

    state.suppressPulse(ids);

    set((s) => {
      const newLists: Record<string, ListT> = {};
      for (const [lid, list] of Object.entries(s.lists)) {
        newLists[lid] = {
          ...list,
          cardIds: list.cardIds.filter((cid) => !ids.includes(cid)),
        };
      }
      const targetList = newLists[targetListId];
      newLists[targetListId] = {
        ...targetList,
        cardIds: [...targetList.cardIds, ...ids],
      };
      return { lists: newLists };
    });

    const supabase = createClient();
    const afterTarget = get().lists[targetListId];
    const promises: PromiseLike<unknown>[] = [];
    afterTarget.cardIds.forEach((cid, idx) => {
      promises.push(
        supabase
          .from('cards')
          .update({ list_id: targetListId, position: idx })
          .eq('id', cid)
      );
    });
    const affectedSourceListIds = Object.keys(state.lists).filter(
      (lid) => lid !== targetListId
    );
    for (const lid of affectedSourceListIds) {
      const list = get().lists[lid];
      if (!list) continue;
      list.cardIds.forEach((cid, idx) => {
        promises.push(
          supabase.from('cards').update({ position: idx }).eq('id', cid)
        );
      });
    }
    await Promise.all(promises);
    set({ selectedCardIds: {} });
  },

  async bulkToggleLabel(labelId) {
    const state = get();
    const ids = Object.keys(state.selectedCardIds);
    if (ids.length === 0) return;

    const allHave = ids.every((cid) =>
      (state.cardLabels[cid] ?? []).includes(labelId)
    );
    const supabase = createClient();

    if (allHave) {
      set((s) => {
        const next = { ...s.cardLabels };
        for (const id of ids) {
          next[id] = (next[id] ?? []).filter((lid) => lid !== labelId);
        }
        return { cardLabels: next };
      });
      await supabase
        .from('card_labels')
        .delete()
        .eq('label_id', labelId)
        .in('card_id', ids);
    } else {
      const toAdd = ids.filter(
        (cid) => !(state.cardLabels[cid] ?? []).includes(labelId)
      );
      set((s) => {
        const next = { ...s.cardLabels };
        for (const id of toAdd) {
          next[id] = [...(next[id] ?? []), labelId];
        }
        return { cardLabels: next };
      });
      if (toAdd.length > 0) {
        await supabase
          .from('card_labels')
          .insert(toAdd.map((cid) => ({ card_id: cid, label_id: labelId })));
      }
    }
  },

  setFilters(next) {
    set((s) => ({ filters: { ...s.filters, ...next } }));
  },

  clearFilters() {
    set({ filters: { ...EMPTY_FILTERS } });
  },

  suppressPulse(cardIds) {
    const until = Date.now() + PULSE_SUPPRESS_MS;
    for (const id of cardIds) suppressUntil.set(id, until);
  },

  maybePulse(cardId) {
    const now = Date.now();
    const expires = suppressUntil.get(cardId);
    if (expires && now < expires) {
      suppressUntil.delete(cardId);
      return;
    }
    const existing = pulseTimers.get(cardId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      pulseTimers.delete(cardId);
      set((s) => {
        if (!s.pulsingCards[cardId]) return s;
        const next = { ...s.pulsingCards };
        delete next[cardId];
        return { pulsingCards: next };
      });
    }, PULSE_DURATION_MS);
    pulseTimers.set(cardId, timer);
    set((s) =>
      s.pulsingCards[cardId]
        ? s
        : { pulsingCards: { ...s.pulsingCards, [cardId]: true } }
    );
  },

  hydrate(
    boardId,
    rawLists,
    rawCards,
    rawTasks,
    rawAssignees,
    members,
    rawLabels,
    rawCardLabels
  ) {
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
        due_date: c.due_date,
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

    const labelsObj: Record<string, LabelT> = {};
    const labelOrder: string[] = [];
    const sortedLabels = [...rawLabels].sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );
    for (const l of sortedLabels) {
      labelsObj[l.id] = { id: l.id, name: l.name, color: l.color };
      labelOrder.push(l.id);
    }

    const cardLabelsObj: Record<string, string[]> = {};
    for (const cl of rawCardLabels) {
      if (!cardLabelsObj[cl.card_id]) cardLabelsObj[cl.card_id] = [];
      cardLabelsObj[cl.card_id].push(cl.label_id);
    }

    set((s) => ({
      boardId,
      lists: listsObj,
      cards: cardsObj,
      listOrder,
      assignees: assigneesObj,
      memberProfiles: memberProfilesObj,
      memberOrder,
      labels: labelsObj,
      labelOrder,
      cardLabels: cardLabelsObj,
      filters: s.boardId === boardId ? s.filters : { ...EMPTY_FILTERS },
    }));
  },

  async createLabel(name, color) {
    const { boardId } = get();
    if (!boardId) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = crypto.randomUUID();

    set((state) => ({
      labels: {
        ...state.labels,
        [id]: { id, name: trimmed, color },
      },
      labelOrder: [...state.labelOrder, id],
    }));

    const supabase = createClient();
    const { error } = await supabase
      .from('labels')
      .insert({ id, board_id: boardId, name: trimmed, color });
    if (error) console.error('createLabel', error);
  },

  async deleteLabel(labelId) {
    set((state) => {
      const newLabels = { ...state.labels };
      delete newLabels[labelId];
      const newCardLabels: Record<string, string[]> = {};
      for (const [cid, ids] of Object.entries(state.cardLabels)) {
        const next = ids.filter((id) => id !== labelId);
        if (next.length > 0) newCardLabels[cid] = next;
      }
      return {
        labels: newLabels,
        labelOrder: state.labelOrder.filter((id) => id !== labelId),
        cardLabels: newCardLabels,
      };
    });

    const supabase = createClient();
    const { error } = await supabase.from('labels').delete().eq('id', labelId);
    if (error) console.error('deleteLabel', error);
  },

  async toggleCardLabel(cardId, labelId) {
    get().suppressPulse([cardId]);
    const current = get().cardLabels[cardId] ?? [];
    const applied = current.includes(labelId);

    set((state) => ({
      cardLabels: {
        ...state.cardLabels,
        [cardId]: applied
          ? current.filter((id) => id !== labelId)
          : [...current, labelId],
      },
    }));

    const supabase = createClient();
    const label = get().labels[labelId];
    const labelName = label?.name ?? '';
    const cardTitle = get().cards[cardId]?.title ?? '';
    const bId = get().boardId;
    if (applied) {
      const { error } = await supabase
        .from('card_labels')
        .delete()
        .eq('card_id', cardId)
        .eq('label_id', labelId);
      if (error) console.error('toggleCardLabel remove', error);
      else {
        logActivity(cardId, 'label_removed', { label: labelName });
        if (bId && cardTitle) {
          notifyBoardEvent(bId, {
            kind: 'label_removed',
            cardId,
            cardTitle,
            labelName,
          }).catch(() => {});
        }
      }
    } else {
      const { error } = await supabase
        .from('card_labels')
        .insert({ card_id: cardId, label_id: labelId });
      if (error) console.error('toggleCardLabel add', error);
      else {
        logActivity(cardId, 'label_added', { label: labelName });
        if (bId && cardTitle) {
          notifyBoardEvent(bId, {
            kind: 'label_added',
            cardId,
            cardTitle,
            labelName,
          }).catch(() => {});
        }
      }
    }
  },

  async toggleAssignee(cardId, userId) {
    get().suppressPulse([cardId]);
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
    const profile = get().memberProfiles[userId];
    const username = profile?.username ?? null;
    const who = username ? `@${username}` : 'jemand';
    const cardTitle = get().cards[cardId]?.title ?? '';
    const bId = get().boardId;
    if (isAssigned) {
      const { error } = await supabase
        .from('card_assignees')
        .delete()
        .eq('card_id', cardId)
        .eq('user_id', userId);
      if (error) console.error('toggleAssignee remove', error);
      else {
        logActivity(cardId, 'assignee_removed', { user_id: userId, username });
        if (bId && cardTitle) {
          notifyBoardEvent(bId, {
            kind: 'assignee_removed',
            cardId,
            cardTitle,
            who,
          }).catch(() => {});
        }
      }
    } else {
      const { error } = await supabase
        .from('card_assignees')
        .insert({ card_id: cardId, user_id: userId });
      if (error) console.error('toggleAssignee add', error);
      else {
        logActivity(cardId, 'assignee_added', { user_id: userId, username });
        if (bId && cardTitle) {
          notifyBoardEvent(bId, {
            kind: 'assignee_added',
            cardId,
            cardTitle,
            who,
          }).catch(() => {});
        }
      }
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

  async deleteList(listId) {
    const state = get();
    const list = state.lists[listId];
    if (!list) return;

    set((s) => {
      const newLists = { ...s.lists };
      delete newLists[listId];
      const newListOrder = s.listOrder.filter((id) => id !== listId);
      const newCards = { ...s.cards };
      const newAssignees = { ...s.assignees };
      const newCardLabels = { ...s.cardLabels };
      for (const cid of list.cardIds) {
        delete newCards[cid];
        delete newAssignees[cid];
        delete newCardLabels[cid];
      }
      const openWasInList =
        s.openCardId !== null && list.cardIds.includes(s.openCardId);
      return {
        lists: newLists,
        listOrder: newListOrder,
        cards: newCards,
        assignees: newAssignees,
        cardLabels: newCardLabels,
        openCardId: openWasInList ? null : s.openCardId,
      };
    });

    const supabase = createClient();
    const { error } = await supabase.from('lists').delete().eq('id', listId);
    if (error) console.error('deleteList', error);
  },

  async moveList(fromIndex, toIndex) {
    const { listOrder, boardId } = get();
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= listOrder.length) return;
    if (toIndex < 0 || toIndex >= listOrder.length) return;

    const nextOrder = [...listOrder];
    const [moved] = nextOrder.splice(fromIndex, 1);
    if (!moved) return;
    nextOrder.splice(toIndex, 0, moved);

    set({ listOrder: nextOrder });

    if (!boardId) return;
    const supabase = createClient();
    const promises = nextOrder.map((id, idx) =>
      supabase.from('lists').update({ position: idx }).eq('id', id)
    );
    await Promise.all(promises);
  },

  async addCard(listId, title) {
    const list = get().lists[listId];
    if (!list) return;
    const id = crypto.randomUUID();
    const position = list.cardIds.length;
    get().suppressPulse([id]);

    set((state) => ({
      cards: {
        ...state.cards,
        [id]: { id, title, description: null, due_date: null, tasks: [] },
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
    else {
      logActivity(id, 'created', { title });
      const bId = get().boardId;
      if (bId) {
        notifyBoardEvent(bId, {
          kind: 'card_created',
          cardId: id,
          cardTitle: title,
          listTitle: list.title,
        }).catch(() => {});
      }
    }
  },

  async moveCard(source, destination) {
    const state = get();
    const srcList = state.lists[source.listId];
    const dstList = state.lists[destination.listId];
    if (!srcList || !dstList) return;

    const affectedCards = Array.from(
      new Set([...srcList.cardIds, ...dstList.cardIds])
    );
    state.suppressPulse(affectedCards);

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
    if (source.listId !== destination.listId) {
      const fromTitle = srcList.title;
      const toTitle = dstList.title;
      logActivity(moved, 'moved', { from: fromTitle, to: toTitle });
      const bId = get().boardId;
      const movedCard = get().cards[moved];
      if (bId && movedCard) {
        notifyBoardEvent(bId, {
          kind: 'card_moved',
          cardId: moved,
          cardTitle: movedCard.title,
          fromList: fromTitle,
          toList: toTitle,
        }).catch(() => {});
      }
    }
  },

  async updateCardTitle(cardId, title) {
    const card = get().cards[cardId];
    if (!card) return;
    const trimmed = title.trim();
    if (!trimmed || trimmed === card.title) return;
    const fromTitle = card.title;
    get().suppressPulse([cardId]);

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
    else {
      logActivity(cardId, 'renamed', { from: fromTitle, to: trimmed });
      const bId = get().boardId;
      if (bId) {
        notifyBoardEvent(bId, {
          kind: 'card_renamed',
          cardId,
          fromTitle,
          toTitle: trimmed,
        }).catch(() => {});
      }
    }
  },

  async updateCardDueDate(cardId, due) {
    const card = get().cards[cardId];
    if (!card) return;
    const next = due && due.trim() ? due : null;
    if (next === card.due_date) return;
    get().suppressPulse([cardId]);

    set((state) => ({
      cards: {
        ...state.cards,
        [cardId]: { ...card, due_date: next },
      },
    }));

    const supabase = createClient();
    const { error } = await supabase
      .from('cards')
      .update({ due_date: next })
      .eq('id', cardId);
    if (error) console.error('updateCardDueDate', error);
    else {
      logActivity(cardId, next ? 'due_set' : 'due_cleared', { due: next });
      const bId = get().boardId;
      const cardTitle = card.title;
      if (bId) {
        if (next) {
          notifyBoardEvent(bId, {
            kind: 'card_due_set',
            cardId,
            cardTitle,
            due: next,
          }).catch(() => {});
        } else {
          notifyBoardEvent(bId, {
            kind: 'card_due_cleared',
            cardId,
            cardTitle,
          }).catch(() => {});
        }
      }
    }
  },

  async updateCardDescription(cardId, description) {
    const card = get().cards[cardId];
    if (!card) return;
    const next = description && description.trim() ? description : null;
    if ((next ?? '') === (card.description ?? '')) return;
    get().suppressPulse([cardId]);

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
    else logActivity(cardId, 'described');
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
      const newCardLabels = { ...s.cardLabels };
      delete newCardLabels[cardId];
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
        cardLabels: newCardLabels,
        lists: newLists,
        openCardId: s.openCardId === cardId ? null : s.openCardId,
      };
    });

    const supabase = createClient();
    const { error } = await supabase.from('cards').delete().eq('id', cardId);
    if (error) console.error('deleteCard', error);
    else {
      const bId = get().boardId;
      if (bId) {
        notifyBoardEvent(bId, {
          kind: 'card_deleted',
          cardTitle: card.title,
        }).catch(() => {});
      }
    }
  },

  async addTask(cardId, title) {
    const card = get().cards[cardId];
    if (!card) return;
    const id = crypto.randomUUID();
    const position = card.tasks.length;
    get().suppressPulse([cardId]);

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
    else {
      logActivity(cardId, 'task_added', { title });
      const bId = get().boardId;
      if (bId) {
        notifyBoardEvent(bId, {
          kind: 'task_added',
          cardId,
          cardTitle: card.title,
          taskTitle: title,
        }).catch(() => {});
      }
    }
  },

  async toggleTask(cardId, taskId) {
    const card = get().cards[cardId];
    if (!card) return;
    const task = card.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newDone = !task.done;
    get().suppressPulse([cardId]);

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
    else {
      logActivity(cardId, newDone ? 'task_done' : 'task_undone', {
        title: task.title,
      });
      const bId = get().boardId;
      if (bId) {
        notifyBoardEvent(bId, {
          kind: newDone ? 'task_done' : 'task_undone',
          cardId,
          cardTitle: card.title,
          taskTitle: task.title,
        }).catch(() => {});
      }
    }
  },

  async duplicateCard(cardId) {
    const state = get();
    const card = state.cards[cardId];
    if (!card) return;

    let targetListId: string | null = null;
    let sourceIndex = -1;
    for (const lid of state.listOrder) {
      const list = state.lists[lid];
      const idx = list.cardIds.indexOf(cardId);
      if (idx >= 0) {
        targetListId = lid;
        sourceIndex = idx;
        break;
      }
    }
    if (!targetListId) return;

    const list = state.lists[targetListId];
    const newId = crypto.randomUUID();
    const newTitle = card.title;
    const newPosition = sourceIndex + 1;
    state.suppressPulse([newId]);

    const newTasks = card.tasks.map((t) => ({
      id: crypto.randomUUID(),
      title: t.title,
      done: t.done,
    }));
    const sourceLabels = state.cardLabels[cardId] ?? [];
    const sourceAssignees = state.assignees[cardId] ?? [];

    set((s) => {
      const nextCardIds = [...list.cardIds];
      nextCardIds.splice(newPosition, 0, newId);
      return {
        cards: {
          ...s.cards,
          [newId]: {
            id: newId,
            title: newTitle,
            description: card.description,
            due_date: card.due_date,
            tasks: newTasks,
          },
        },
        lists: {
          ...s.lists,
          [targetListId!]: { ...list, cardIds: nextCardIds },
        },
        cardLabels: {
          ...s.cardLabels,
          [newId]: [...sourceLabels],
        },
        assignees: {
          ...s.assignees,
          [newId]: [...sourceAssignees],
        },
      };
    });

    const supabase = createClient();
    await supabase.from('cards').insert({
      id: newId,
      list_id: targetListId,
      title: newTitle,
      description: card.description,
      due_date: card.due_date,
      position: newPosition,
    });

    const listAfter = get().lists[targetListId];
    if (listAfter) {
      const promises = listAfter.cardIds.map((cid, idx) =>
        supabase.from('cards').update({ position: idx }).eq('id', cid)
      );
      await Promise.all(promises);
    }

    if (newTasks.length > 0) {
      await supabase.from('tasks').insert(
        newTasks.map((t, i) => ({
          id: t.id,
          card_id: newId,
          title: t.title,
          done: t.done,
          position: i,
        }))
      );
    }
    if (sourceLabels.length > 0) {
      await supabase
        .from('card_labels')
        .insert(sourceLabels.map((lid) => ({ card_id: newId, label_id: lid })));
    }
    if (sourceAssignees.length > 0) {
      await supabase
        .from('card_assignees')
        .insert(
          sourceAssignees.map((uid) => ({ card_id: newId, user_id: uid }))
        );
    }
    logActivity(newId, 'created', { title: newTitle, duplicated_from: cardId });
  },

  async deleteTask(cardId, taskId) {
    const card = get().cards[cardId];
    if (!card) return;
    const task = card.tasks.find((t) => t.id === taskId);
    get().suppressPulse([cardId]);

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
    else {
      logActivity(cardId, 'task_deleted', { title: task?.title ?? null });
      const bId = get().boardId;
      if (bId && task?.title) {
        notifyBoardEvent(bId, {
          kind: 'task_deleted',
          cardId,
          cardTitle: card.title,
          taskTitle: task.title,
        }).catch(() => {});
      }
    }
  },
}));
