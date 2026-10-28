import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { canonicalDistrict } from './geo';

const Ctx = createContext(null);

export function ChampionsProvider({ children }) {
  const [champions, setChampions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async (opts) => {
    try {
      setError(null);
      const list = await api.listChampions(opts);
      setChampions(list.map((c) => ({ ...c, district: canonicalDistrict(c.district) })));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const value = useMemo(() => ({ champions, loading, error, reload, setChampions }), [champions, loading, error, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useChampions = () => useContext(Ctx);
