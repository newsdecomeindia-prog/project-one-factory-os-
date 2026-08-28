import { useState, useEffect, useCallback } from 'react';

const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export const useInactivityLock = (onLock?: () => void) => {
  const [isLocked, setIsLocked] = useState(false);

  const resetTimer = useCallback(() => {
    if (!isLocked) {
      localStorage.setItem('p1_last_activity', Date.now().toString());
    }
  }, [isLocked]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];

    const handleUserActivity = () => {
      resetTimer();
    };

    events.forEach((event) => window.addEventListener(event, handleUserActivity));

    const interval = setInterval(() => {
      const lastActivity = parseInt(localStorage.getItem('p1_last_activity') || '0', 10);
      if (lastActivity && Date.now() - lastActivity >= LOCK_TIMEOUT_MS && !isLocked) {
        setIsLocked(true);
        if (onLock) onLock();
      }
    }, 5000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleUserActivity));
      clearInterval(interval);
    };
  }, [isLocked, onLock, resetTimer]);

  const unlock = () => {
    setIsLocked(false);
    resetTimer();
  };

  return { isLocked, unlock };
};
