import { useState, useEffect } from 'react';

export function useLocalAuth() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let id = localStorage.getItem('parsepilot_user_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('parsepilot_user_id', id);
    }
    setUserId(id);
  }, []);

  return { userId };
}
