import { useEffect, useRef } from "react";
import { connectSocket } from "../api/socket";

/**
 * Abonnement à un événement temps réel Socket.IO, désabonné au démontage.
 * Le handler courant est toujours utilisé (pas besoin de le mémoïser).
 */
export function useSocketEvent<T>(event: string, handler: (payload: T) => void) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;
    const listener = (payload: T) => handlerRef.current(payload);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [event]);
}
