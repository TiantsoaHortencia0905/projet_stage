import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface AlertsState {
  /** Nombre d'alertes non résolues (null : pas encore chargé). */
  openCount: number | null;
  /** Incrémenté à chaque changement (nouvelle alerte, résolution) : les vues abonnées se rechargent. */
  version: number;
}

const alertsSlice = createSlice({
  name: "alerts",
  initialState: { openCount: null, version: 0 } as AlertsState,
  reducers: {
    setOpenCount(state, action: PayloadAction<number>) {
      state.openCount = action.payload;
    },
    alertsChanged(state) {
      state.version += 1;
    },
  },
});

export const { setOpenCount, alertsChanged } = alertsSlice.actions;
export default alertsSlice.reducer;
