import { create } from "zustand";

interface DragAndDropStore {
	hoveredFolderId: string | null;
	setHoveredFolderId: (folderId: string | null) => void;
}

export const useDragAndDropStore = create<DragAndDropStore>()((set) => ({
	hoveredFolderId: null,
	setHoveredFolderId: (folderId) => set({ hoveredFolderId: folderId }),
}));
